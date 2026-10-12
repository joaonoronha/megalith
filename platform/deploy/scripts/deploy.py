#!/usr/bin/env python3
"""
Megalith Host-Side Deployment and Rollback Engine (Task 010).

Executes controlled, immutable application releases and crash-safe rollbacks per
ADR-008, ADR-010, and Task 010 requirements:
- Rejects self-declared approval metadata in manifests as proof of authorization.
- Enforces authenticated, operator-initiated host deployment authorization.
- Prevents concurrent mutations via Linux fcntl.flock deployment lock.
- Tracks discrete deployment transaction phases with durable fsync state transitions.
- Detects and safely recovers from interrupted deployments (process crash / VM reboot).
- Inspects real container state and Alembic revision state during recovery.
- Never automatically drops, restores, or downgrades production databases.
- Selectively recreates changed containers while preserving persistent volumes.
- Emits human-readable host audit logs with restrictive permissions.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from release import (  # type: ignore
    AuthorizationValidationError,
    DeploymentAuthorization,
    MigrationDeclaration,
    ReleaseManifest,
    ReleaseValidationError,
    UntrustedApprovalError,
    create_deployment_authorization,
    validate_release_dict,
)
from verify_ci_provenance import CIProvenanceError, verify_ci_provenance  # type: ignore

DEFAULT_REPO_ROOT = SCRIPT_DIR.parent.parent.parent
DEFAULT_COMPOSE_BASE = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.yaml"
DEFAULT_COMPOSE_PROD = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
DEFAULT_COMPOSE_MICRO = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.micro.yaml"
DEFAULT_COMPOSE_EXTERNAL_DB = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.external-db.yaml"
DEFAULT_STATE_DIR = (
    Path("/opt/megalith/deploy")
    if Path("/opt/megalith/deploy").exists()
    else (DEFAULT_REPO_ROOT / "platform" / "deploy" / ".state")
)

# Deployment phases
PHASE_PREPARED = "prepared"
PHASE_PULLING = "pulling"
PHASE_MIGRATING = "migrating"
PHASE_APPLYING = "applying"
PHASE_VERIFYING = "verifying"
PHASE_SUCCEEDED = "succeeded"
PHASE_FAILED = "failed"
PHASE_RECOVERING = "recovering"
PHASE_ROLLED_BACK = "rolled_back"
PHASE_MANUAL_INTERVENTION_REQUIRED = "manual_intervention_required"


class DeploymentLockError(RuntimeError):
    """Raised when the deployment lock cannot be acquired."""
    pass


class DeploymentExecutionError(RuntimeError):
    """Raised when a deployment step or health verification fails."""
    pass


class InterruptedDeploymentError(RuntimeError):
    """Raised when an unfinished deployment transaction is detected."""
    pass


def _save_atomic(path: Path, data: dict[str, Any]) -> None:
    """Durably writes data to path using temporary file, fsync, and atomic replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.parent / f".tmp_{path.name}_{os.getpid()}_{time.time_ns()}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2) + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)
    try:
        dir_fd = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except OSError:
        pass


class DeploymentLock:
    """Linux kernel file lock (fcntl.flock) ensuring atomic, non-concurrent deployments."""

    def __init__(self, lock_file: Path):
        self.lock_file = lock_file
        self.fd: Optional[int] = None

    def __enter__(self) -> DeploymentLock:
        self.lock_file.parent.mkdir(parents=True, exist_ok=True)
        self.fd = os.open(str(self.lock_file), os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError) as err:
            info = ""
            try:
                content = self.lock_file.read_text(encoding="utf-8").strip()
                if content:
                    info = f" Lock info: {content}"
            except Exception:
                pass
            os.close(self.fd)
            self.fd = None
            raise DeploymentLockError(
                f"Another deployment is currently in progress on this host.{info}"
            ) from err

        metadata = json.dumps({
            "pid": os.getpid(),
            "acquired_at": datetime.now(timezone.utc).isoformat(),
        })
        os.ftruncate(self.fd, 0)
        os.write(self.fd, metadata.encode("utf-8"))
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.fd is not None:
            try:
                os.ftruncate(self.fd, 0)
                fcntl.flock(self.fd, fcntl.LOCK_UN)
            except Exception:
                pass
            try:
                os.close(self.fd)
            except Exception:
                pass
            self.fd = None


class DeploymentState:
    """
    Manages persistent on-host deployment state, release history,
    and durable transaction phase journaling.
    """

    def __init__(self, state_file: Path):
        self.state_file = state_file
        self.data: dict[str, Any] = {
            "current_release": None,
            "previous_release": None,
            "last_successful_release": None,
            "status": "idle",
            "active_transaction": None,
            "updated_at": None,
            "history": [],
        }
        self.load()

    def load(self) -> None:
        if self.state_file.is_file():
            try:
                content = json.loads(self.state_file.read_text(encoding="utf-8"))
                if isinstance(content, dict):
                    self.data.update(content)
            except Exception as err:
                print(f"[Warning] Failed to read state file {self.state_file}: {err}", file=sys.stderr)

    def save(self) -> None:
        self.data["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_atomic(self.state_file, self.data)

    def start_transaction(
        self,
        tx_id: str,
        operator: str,
        target_manifest: ReleaseManifest,
        previous_manifest: Optional[ReleaseManifest],
    ) -> dict[str, Any]:
        tx = {
            "tx_id": tx_id,
            "operator": operator,
            "phase": PHASE_PREPARED,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "target_release": target_manifest.to_dict(),
            "previous_release": previous_manifest.to_dict() if previous_manifest else None,
            "completed_operations": [],
            "migration_outcome": None,
            "health_outcome": None,
            "recovery_decision": None,
            "error": None,
        }
        self.data["active_transaction"] = tx
        self.data["status"] = "in_progress"
        self._append_history("transaction_started", target_manifest.release_id, target_manifest.git_sha, tx_id=tx_id)
        self.save()
        return tx

    def transition_phase(
        self,
        phase: str,
        completed_op: Optional[str] = None,
        migration_outcome: Optional[str] = None,
        health_outcome: Optional[str] = None,
        recovery_decision: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        tx = self.data.get("active_transaction")
        if not tx:
            return

        tx["phase"] = phase
        tx["updated_at"] = datetime.now(timezone.utc).isoformat()
        if completed_op and completed_op not in tx["completed_operations"]:
            tx["completed_operations"].append(completed_op)
        if migration_outcome:
            tx["migration_outcome"] = migration_outcome
        if health_outcome:
            tx["health_outcome"] = health_outcome
        if recovery_decision:
            tx["recovery_decision"] = recovery_decision
        if error:
            tx["error"] = error

        self.data["status"] = "in_progress" if phase not in (
            PHASE_SUCCEEDED, PHASE_ROLLED_BACK, PHASE_FAILED, PHASE_MANUAL_INTERVENTION_REQUIRED
        ) else phase
        self.save()

    def record_deployment_success(self, manifest: ReleaseManifest) -> None:
        prev = self.data.get("current_release")
        if prev:
            self.data["previous_release"] = prev

        self.data["current_release"] = manifest.to_dict()
        self.data["last_successful_release"] = manifest.to_dict()
        self.data["status"] = "active"

        tx = self.data.get("active_transaction")
        tx_id = tx.get("tx_id") if tx else None
        if tx:
            tx["phase"] = PHASE_SUCCEEDED
            tx["updated_at"] = datetime.now(timezone.utc).isoformat()

        self._append_history("deploy_success", manifest.release_id, manifest.git_sha, tx_id=tx_id)
        self.data["active_transaction"] = None
        self.save()

    def record_deployment_failure(self, manifest: ReleaseManifest, error_msg: str) -> None:
        self.data["status"] = PHASE_FAILED
        tx = self.data.get("active_transaction")
        tx_id = tx.get("tx_id") if tx else None
        if tx:
            tx["phase"] = PHASE_FAILED
            tx["error"] = error_msg
            tx["updated_at"] = datetime.now(timezone.utc).isoformat()

        self._append_history("deploy_failed", manifest.release_id, manifest.git_sha, tx_id=tx_id, error=error_msg)
        self.save()

    def record_rollback_success(self, rolled_back_manifest: ReleaseManifest) -> None:
        self.data["current_release"] = rolled_back_manifest.to_dict()
        self.data["last_successful_release"] = rolled_back_manifest.to_dict()
        self.data["status"] = "rolled_back"

        tx = self.data.get("active_transaction")
        tx_id = tx.get("tx_id") if tx else None
        if tx:
            tx["phase"] = PHASE_ROLLED_BACK
            tx["updated_at"] = datetime.now(timezone.utc).isoformat()

        self._append_history("rollback_success", rolled_back_manifest.release_id, rolled_back_manifest.git_sha, tx_id=tx_id)
        self.data["active_transaction"] = None
        self.save()

    def record_manual_intervention_required(self, reason: str) -> None:
        self.data["status"] = PHASE_MANUAL_INTERVENTION_REQUIRED
        tx = self.data.get("active_transaction")
        if tx:
            tx["phase"] = PHASE_MANUAL_INTERVENTION_REQUIRED
            tx["error"] = reason
            tx["recovery_decision"] = "manual_intervention_required"
            tx["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.save()

    def _append_history(self, event: str, release_id: str, git_sha: str, **kwargs: Any) -> None:
        entry = {
            "event": event,
            "release_id": release_id,
            "git_sha": git_sha,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }
        history = self.data.setdefault("history", [])
        history.append(entry)
        self.data["history"] = history[-50:]


class Deployer:
    """Orchestrates Docker Compose deployments, migrations, and health checks."""

    def __init__(
        self,
        compose_files: list[Path],
        project_name: Optional[str] = None,
        state_dir: Optional[Path] = None,
        host_port: Optional[int] = None,
        environment: str = "production",
        profile: str = "full",
        provider: str = "oci",
        dry_run: bool = False,
        repo_root: Optional[Path] = None,
        database_mode: str = "local",
    ):
        if profile not in ("full", "micro"):
            raise ValueError(f"Invalid deployment profile '{profile}'. Must be 'full' or 'micro'.")

        if database_mode not in ("local", "external"):
            raise ValueError(f"Invalid database_mode '{database_mode}'. Must be 'local' or 'external'.")

        if profile == "micro" and environment == "production":
            raise DeploymentExecutionError(
                "CRITICAL POLICY VIOLATION: The 'micro' profile is strictly intended for experimental "
                "bootstrap testing and cannot be deployed in production. Production deployments strictly "
                "require the 'full' profile."
            )

        self.profile = profile
        self.provider = provider
        self.database_mode = database_mode
        self.repo_root = repo_root or DEFAULT_REPO_ROOT
        self.compose_files = list(compose_files)
        self.project_name = project_name or os.environ.get("COMPOSE_PROJECT_NAME", "megalith")
        self.state_dir = Path(state_dir) if state_dir else DEFAULT_STATE_DIR
        self.lock_file = self.state_dir / "deploy.lock"
        self.audit_log_file = self.state_dir / "audit.log"
        self.state = DeploymentState(self.state_dir / "state.json")
        self.host_port = host_port or int(os.environ.get("PORT", "80"))
        self.environment = environment
        self.dry_run = dry_run

        if self.database_mode == "external" and self.profile != "micro":
            if DEFAULT_COMPOSE_EXTERNAL_DB not in self.compose_files:
                self.compose_files.append(DEFAULT_COMPOSE_EXTERNAL_DB)
            self.validate_database_configuration()

    def validate_database_configuration(self) -> None:
        """Validates that external database environment variables are set and properly formatted."""
        if self.database_mode != "external" or self.profile == "micro":
            return

        db_url = os.environ.get("DATABASE_URL")
        migrate_url = os.environ.get("DATABASE_MIGRATE_URL")

        if not db_url or not migrate_url:
            missing = []
            if not db_url:
                missing.append("DATABASE_URL")
            if not migrate_url:
                missing.append("DATABASE_MIGRATE_URL")
            raise DeploymentExecutionError(
                f"External database mode requires both DATABASE_URL and DATABASE_MIGRATE_URL environment variables. Missing: {', '.join(missing)}."
            )

        from sqlalchemy.engine import make_url

        parsed_urls: dict[str, Any] = {}
        for name, url_str in [("DATABASE_URL", db_url), ("DATABASE_MIGRATE_URL", migrate_url)]:
            try:
                u = make_url(url_str)
            except Exception as err:
                raise DeploymentExecutionError(f"Malformed {name}: {type(err).__name__}") from err

            if not u.drivername.startswith("postgresql"):
                raise DeploymentExecutionError(
                    f"{name} driver must be postgresql (got '{u.drivername}')."
                )
            if not u.host:
                raise DeploymentExecutionError(f"{name} is missing a host.")

            # External mode cannot target internal Compose service name
            if u.host.lower() == "postgres":
                raise DeploymentExecutionError(
                    f"{name} cannot target internal Docker Compose service 'postgres' in external database mode."
                )

            # In production, external database cannot target local loopback hostnames
            if self.environment == "production" and u.host.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
                raise DeploymentExecutionError(
                    f"{name} cannot target local loopback host '{u.host}' in production environment."
                )

            # Production TLS policy enforcement
            if self.environment == "production":
                sslmode = u.query.get("sslmode")
                safe_str = u.render_as_string(hide_password=True)
                if sslmode != "verify-full":
                    raise DeploymentExecutionError(
                        f"External production database connection strictly requires sslmode=verify-full "
                        f"(got '{sslmode or 'missing'}'): {safe_str}"
                    )
                sslrootcert = u.query.get("sslrootcert")
                if sslrootcert and not Path(sslrootcert).exists():
                    raise DeploymentExecutionError(
                        f"{name} specifies sslrootcert='{sslrootcert}' which does not exist on disk."
                    )

            parsed_urls[name] = u

        u_db = parsed_urls["DATABASE_URL"]
        u_mig = parsed_urls["DATABASE_MIGRATE_URL"]

        # Enforce distinct roles between runtime DML and migration DDL
        if u_db.username and u_mig.username and u_db.username == u_mig.username:
            raise DeploymentExecutionError(
                f"External database mode requires distinct roles for runtime DML (DATABASE_URL) and "
                f"migration DDL (DATABASE_MIGRATE_URL). Both specify user '{u_db.username}'."
            )

        # Enforce that both URLs target the same database environment
        if u_db.host != u_mig.host or u_db.database != u_mig.database or u_db.port != u_mig.port:
            raise DeploymentExecutionError(
                f"DATABASE_URL and DATABASE_MIGRATE_URL must target the same database environment. "
                f"Mismatch: host ({u_db.host} vs {u_mig.host}), database ({u_db.database} vs {u_mig.database}), "
                f"port ({u_db.port} vs {u_mig.port})."
            )

    def verify_database_reachability(self, timeout_sec: int = 10) -> None:
        """Verifies reachability and authentication of the external database without logging credentials."""
        if self.database_mode != "external" or self.profile == "micro":
            return

        migrate_url = os.environ.get("DATABASE_MIGRATE_URL")
        if not migrate_url:
            raise DeploymentExecutionError("DATABASE_MIGRATE_URL is required to verify database reachability.")

        from sqlalchemy.engine import make_url
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import NullPool

        safe_url = make_url(migrate_url).render_as_string(hide_password=True)
        print(f"--> Verifying external database connectivity to: {safe_url}")

        try:
            engine = create_engine(
                migrate_url,
                poolclass=NullPool,
                connect_args={"connect_timeout": timeout_sec, "prepare_threshold": None},
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1;"))
            engine.dispose()
            print("  -> External database reachability and authentication verified successfully.")
        except Exception as err:
            raise DeploymentExecutionError(
                f"Failed to reach external database ({safe_url}): {type(err).__name__}"
            ) from err

    def _log_audit(self, action: str, operator: str, release_id: str, outcome: str, details: str = "") -> None:
        """Appends an immutable audit event to audit.log with restrictive permissions."""
        self.state_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).isoformat()
        entry = f"[{ts}] ACTION={action} OPERATOR={operator} RELEASE={release_id} OUTCOME={outcome} DETAILS={details}\n"
        try:
            # Ensure audit log is created with 0600 mode
            if not self.audit_log_file.exists():
                fd = os.open(str(self.audit_log_file), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                with os.fdopen(fd, "a", encoding="utf-8") as f:
                    f.write(entry)
            else:
                with open(self.audit_log_file, "a", encoding="utf-8") as f:
                    f.write(entry)
        except Exception as err:
            print(f"[Warning] Failed to write audit log: {err}", file=sys.stderr)

    def _build_env(self, manifest: Optional[ReleaseManifest] = None) -> dict[str, str]:
        env = os.environ.copy()
        env.setdefault("PORT", str(self.host_port))
        env.setdefault("INGRESS_PORT", str(self.host_port))
        if manifest:
            if "demo-api" in manifest.images:
                env["IMAGE_DEMO_API"] = manifest.images["demo-api"]
            if "demo-web" in manifest.images:
                env["IMAGE_DEMO_WEB"] = manifest.images["demo-web"]
        return env

    def _run_compose(
        self,
        args: list[str],
        manifest: Optional[ReleaseManifest] = None,
        check: bool = True,
        capture: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        cmd = ["docker", "compose", "-p", self.project_name]
        for f in self.compose_files:
            cmd.extend(["-f", str(f)])
        cmd.extend(args)

        env = self._build_env(manifest)
        if self.dry_run:
            print(f"[DRY-RUN] Running: {' '.join(cmd)}")
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

        res = subprocess.run(cmd, env=env, text=True, capture_output=capture)
        if check and res.returncode != 0:
            cmd_str = " ".join(cmd)
            raise DeploymentExecutionError(
                f"Command '{cmd_str}' failed with exit code {res.returncode}:\n{res.stderr}\n{res.stdout}"
            )
        return res

    def validate_manifest(self, manifest_path: Path | str) -> ReleaseManifest:
        """Validate release manifest structure, digests, and declarative contents."""
        print(f"--> Validating release manifest: {manifest_path}")
        manifest = ReleaseManifest.from_file(manifest_path, require_approval=False)
        print(f"  -> Release ID   : {manifest.release_id}")
        print(f"  -> Git Commit   : {manifest.git_sha}")
        print(f"  -> Environment  : {manifest.environment}")
        print(f"  -> Canonical SHA: {manifest.canonical_digest()}")
        print(f"  -> Services     : {', '.join(manifest.services)}")
        for svc, img in manifest.images.items():
            print(f"     * {svc}: {img}")
        return manifest

    def authorize_deployment(
        self,
        manifest: ReleaseManifest,
        operator: str,
        auth_file: Optional[Path | str] = None,
        confirm_release_id: Optional[str] = None,
        verify_ci: bool = False,
        ci_runs_file: Optional[Path | str] = None,
        expected_repo: str = "megalith/megalith",
    ) -> DeploymentAuthorization:
        """
        Enforce the authenticated host deployment boundary:
        - Rejects self-declared approval objects in manifests as proof of authorization.
        - Verifies either an authenticated operator authorization file, or an explicit
          operator CLI confirmation matching release_id.
        - Enforces out-of-repository location, strict permissions (0600/0400), UID ownership, and TTL.
        - Verifies exact-commit CI provenance when required.
        """
        # Security Boundary 1: Manifest self-approval cannot authorize deployment
        if manifest.approval is not None:
            print("  [Security Notice] Ignoring self-declared manifest approval object. "
                  "Deployment requires independent operator authorization.", file=sys.stderr)

        # CI Provenance verification gate
        if verify_ci or ci_runs_file:
            print(f"--> Verifying exact-commit CI provenance for commit: {manifest.git_sha[:10]}...")
            runs_data = None
            if ci_runs_file:
                with open(ci_runs_file, "r", encoding="utf-8") as rf:
                    runs_data = json.load(rf)
            else:
                # Query gh cli if available
                cmd = [
                    "gh", "run", "list",
                    "--repo", expected_repo,
                    "--commit", manifest.git_sha,
                    "--workflow", "ci.yaml",
                    "--json", "databaseId,headSha,headBranch,workflowName,path,event,status,conclusion",
                ]
                try:
                    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
                    runs_data = json.loads(res.stdout)
                except Exception as gh_err:
                    self._log_audit("AUTHORIZE_CI", operator or "unknown", manifest.release_id, "FAILED", f"GH CLI error: {gh_err}")
                    raise AuthorizationValidationError(
                        f"CI Provenance verification failed: unable to query CI runs for {manifest.git_sha[:10]}: {gh_err}"
                    )

            try:
                run_record = verify_ci_provenance(
                    target_sha=manifest.git_sha,
                    expected_repo=expected_repo,
                    runs_data=runs_data,
                )
                print(f"  -> Exact-commit CI provenance verified (Run ID: {run_record.get('databaseId')}, Conclusion: {run_record.get('conclusion')}).")
            except CIProvenanceError as prov_err:
                self._log_audit("AUTHORIZE_CI", operator or "unknown", manifest.release_id, "FAILED", str(prov_err))
                raise AuthorizationValidationError(f"CI Provenance gate failed: {prov_err}") from prov_err

        if auth_file:
            print(f"--> Validating operator authorization record: {auth_file}")
            auth = DeploymentAuthorization.from_file(
                auth_file,
                enforce_permissions=True,
                enforce_out_of_tree=True,
                repo_root=self.repo_root,
            )
            auth.validate_against_manifest(manifest, self.environment)
            self._log_audit("AUTHORIZE_VIA_FILE", auth.operator, manifest.release_id, "SUCCESS")
            return auth

        if operator and confirm_release_id:
            if confirm_release_id != manifest.release_id:
                self._log_audit("AUTHORIZE_CLI", operator, manifest.release_id, "FAILED", "Mismatched confirm_release_id")
                raise AuthorizationValidationError(
                    f"Operator confirmation failed: confirm_release_id '{confirm_release_id}' "
                    f"does not match manifest release_id '{manifest.release_id}'."
                )
            if not operator.strip():
                raise AuthorizationValidationError("Operator identity cannot be empty.")

            auth = create_deployment_authorization(
                operator=operator,
                manifest=manifest,
                environment=self.environment,
                notes=f"Operator CLI confirmed deployment on host ({self.provider}/{self.profile})",
            )
            # Persist host authorization record in state dir
            auth_path = self.state_dir / f"{manifest.release_id}.auth.json"
            auth.save(auth_path)
            self._log_audit("AUTHORIZE_CLI", operator, manifest.release_id, "SUCCESS", f"Recorded at {auth_path}")
            return auth

        self._log_audit("AUTHORIZE", operator or "unknown", manifest.release_id, "FAILED", "Missing authorization")
        raise AuthorizationValidationError(
            "Deployment authorization missing. Deployments strictly require an authenticated operator "
            "(--operator <id> --confirm-release-id <id>) or an authorization record (--auth <path>)."
        )

    def prepare_release(self, manifest: ReleaseManifest) -> None:
        """Validate Compose syntax and configuration with release images."""
        print(f"--> Preparing release '{manifest.release_id}'...")
        self._run_compose(["config"], manifest=manifest)
        print("  -> Compose configuration validated cleanly with release image variables.")

    def run_migrations(self, manifest: ReleaseManifest) -> None:
        """Execute database migrations if declared in the release manifest."""
        if self.profile == "micro":
            print("--> Micro profile active: Database migrations skipped (no persistent database in micro profile).")
            return

        relevant_migrations = [m for m in manifest.migrations if m.applied]
        if not relevant_migrations:
            print("--> No database migrations declared for this release.")
            return

        print("--> Executing database migrations...")
        if self.database_mode == "external":
            print("  -> External database mode: Verifying database connectivity and credentials...")
            self.verify_database_reachability()
            for mig in relevant_migrations:
                print(f"  -> Running migration for {mig.service}: '{mig.command}' against external database")
                self._run_compose(["run", "--rm", "-T", "demo-migrate"], manifest=manifest)
                print(f"  -> Migration for {mig.service} completed successfully.")
        else:
            for mig in relevant_migrations:
                print(f"  -> Running migration for {mig.service}: '{mig.command}'")
                self._run_compose(["up", "-d", "postgres"], manifest=manifest)
                self._wait_for_health("postgres", timeout_sec=30)
                self._run_compose(["run", "--rm", "-T", "demo-migrate"], manifest=manifest)
                print(f"  -> Migration for {mig.service} completed successfully.")

    def get_database_alembic_revision(self) -> Optional[str]:
        """Queries actual Alembic revision directly from PostgreSQL."""
        if self.database_mode == "external":
            migrate_url = os.environ.get("DATABASE_MIGRATE_URL") or os.environ.get("DATABASE_URL")
            if migrate_url:
                try:
                    from sqlalchemy import create_engine, text
                    from sqlalchemy.pool import NullPool
                    engine = create_engine(
                        migrate_url,
                        poolclass=NullPool,
                        connect_args={"connect_timeout": 5, "prepare_threshold": None},
                    )
                    with engine.connect() as conn:
                        val = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1;")).scalar()
                        if val:
                            return str(val).strip()
                except Exception:
                    pass
            return None

        try:
            res = self._run_compose([
                "exec", "-T", "postgres",
                "psql", "-U", "postgres", "-d", "db_demo", "-t", "-c",
                "SELECT version_num FROM alembic_version LIMIT 1;"
            ], check=False)
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception:
            pass
        return None

    def check_health(self, manifest: Optional[ReleaseManifest] = None, timeout_sec: int = 40) -> bool:
        """Verify container health probes and HTTP readiness endpoint."""
        print("--> Verifying deployment health...")
        if self.profile == "micro":
            print("--> Verifying micro profile smoke health...")
            services_to_check = ["caddy", "demo-web"]
            for svc in services_to_check:
                self._wait_for_health(svc, timeout_sec=timeout_sec)
            print("  -> Micro profile smoke health verified successfully.")
            return True

        if self.database_mode == "external":
            print("--> Verifying external database mode container health...")
            services_to_check = ["demo-api", "demo-web"]
            for svc in services_to_check:
                self._wait_for_health(svc, timeout_sec=timeout_sec)
        else:
            services_to_check = ["postgres", "demo-api", "demo-web"]
            for svc in services_to_check:
                self._wait_for_health(svc, timeout_sec=timeout_sec)

        print("--> Verifying application API readiness probe (/ready)...")
        deadline = time.time() + timeout_sec
        ready_passed = False

        while time.time() < deadline:
            try:
                res = self._run_compose([
                    "exec", "-T", "demo-api", "python3", "-c",
                    "import urllib.request, json; data = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/ready').read()); assert data['status'] == 'ready'"
                ], manifest=manifest, check=False)
                if res.returncode == 0:
                    ready_passed = True
                    break
            except Exception:
                pass
            time.sleep(1)

        if not ready_passed:
            raise DeploymentExecutionError("Application API readiness probe (/ready) failed after deployment.")

        print("  -> Service readiness verified successfully.")
        return True

    def _wait_for_health(self, service: str, timeout_sec: int = 30) -> None:
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            res = self._run_compose(["ps", service, "--format", "json"], check=False)
            if res.returncode == 0 and res.stdout.strip():
                try:
                    raw = res.stdout.strip()
                    item = json.loads(raw)
                    if isinstance(item, list) and len(item) > 0:
                        item = item[0]
                    health = item.get("Health", "")
                    state = item.get("State", "")
                    if state in ("exited", "dead"):
                        raise DeploymentExecutionError(f"Service '{service}' crashed or exited unexpectedly (state: {state}).")
                    if health == "healthy" or (state == "running" and not health):
                        print(f"  -> Service '{service}' is healthy ({state}).")
                        return
                except Exception:
                    pass
            time.sleep(1)
        raise DeploymentExecutionError(f"Service '{service}' failed to reach healthy status within {timeout_sec}s.")

    def check_for_interrupted_transaction(self) -> Optional[dict[str, Any]]:
        """Returns active transaction if an interrupted deployment exists."""
        tx = self.state.data.get("active_transaction")
        if tx and tx.get("phase") not in (PHASE_SUCCEEDED, PHASE_ROLLED_BACK):
            return tx
        return None

    def recover(self) -> None:
        """
        Safe recovery path for interrupted deployments.
        Inspects recorded transaction state, container state, and database Alembic revision.
        Treats uncertain migration compatibility conservatively; never automatically
        downgrades or restores a production database.
        """
        with DeploymentLock(self.lock_file):
            tx = self.check_for_interrupted_transaction()
            if not tx:
                print("--> No unfinished deployment transactions detected. System is clean.")
                return

            tx_id = tx["tx_id"]
            phase = tx["phase"]
            target_data = tx.get("target_release", {})
            prev_data = tx.get("previous_release")
            target_manifest = ReleaseManifest.from_dict(target_data) if target_data else None
            prev_manifest = ReleaseManifest.from_dict(prev_data) if prev_data else None

            print(f"============================================================")
            print(f" Recovering Interrupted Deployment: {tx_id}")
            print(f" Interrupted Phase: {phase}")
            print(f"============================================================")

            self.state.transition_phase(PHASE_RECOVERING, recovery_decision="evaluating")

            # Check database revision
            db_revision = self.get_database_alembic_revision()
            print(f"  -> Live database Alembic revision: {db_revision}")

            # Check if migration was declared in target release
            has_migration = target_manifest and any(m.applied for m in target_manifest.migrations)
            compat_migration = (
                target_manifest and all(m.backward_compatible for m in target_manifest.migrations if m.applied)
            )

            # Scenario 1: Interrupted in PREPARED or PULLING (no mutations occurred)
            if phase in (PHASE_PREPARED, PHASE_PULLING):
                print("--> Interruption occurred before any container or database mutations.")
                self.state.transition_phase(
                    PHASE_FAILED,
                    recovery_decision="aborted_before_mutations",
                    error="Deployment interrupted before mutations started.",
                )
                self.state.data["active_transaction"] = None
                self.state.data["status"] = "idle"
                self.state.save()
                self._log_audit("RECOVER", tx["operator"], target_manifest.release_id if target_manifest else "unknown", "ABORTED_SAFE")
                print("  -> Safe recovery complete: Transaction aborted cleanly without state changes.")
                return

            # Scenario 2: Interrupted during MIGRATING or APPLYING
            if phase in (PHASE_MIGRATING, PHASE_APPLYING, PHASE_VERIFYING):
                # If migration applied but is NOT backward-compatible, automatic rollback is prohibited!
                if has_migration and not compat_migration:
                    print("[CRITICAL] Unfinished deployment applied database migration declared NOT backward-compatible.", file=sys.stderr)
                    print("[CRITICAL] Rolling back containers would expose previous application to incompatible schema.", file=sys.stderr)
                    print("[CRITICAL] Automated database downgrade is prohibited to prevent data loss.", file=sys.stderr)
                    self.state.record_manual_intervention_required(
                        "Interrupted deployment with non-backward-compatible migration. Manual intervention required."
                    )
                    self._log_audit("RECOVER", tx["operator"], target_manifest.release_id, "MANUAL_INTERVENTION_REQUIRED")
                    raise DeploymentExecutionError(
                        "Recovery blocked: Non-backward-compatible migration detected. Manual operator intervention required on host."
                    )

                # If backward-compatible or no migration was applied, attempt safe rollback to previous release
                if prev_manifest:
                    print(f"--> Migrations are backward-compatible. Executing safe rollback to previous release: {prev_manifest.release_id}...")
                    try:
                        self._run_compose(["up", "-d"], manifest=prev_manifest)
                        self.check_health(prev_manifest)
                        self.state.record_rollback_success(prev_manifest)
                        self._log_audit("RECOVER", tx["operator"], target_manifest.release_id, "ROLLED_BACK_SAFE")
                        print(f"--> Interrupted deployment safely recovered: Rolled back to {prev_manifest.release_id}.")
                        return
                    except Exception as rollback_err:
                        print(f"[CRITICAL] Rollback during recovery failed: {rollback_err}", file=sys.stderr)
                        self.state.record_manual_intervention_required(f"Recovery rollback failed: {rollback_err}")
                        raise rollback_err
                else:
                    # Initial deployment failed with no previous release
                    print("--> No previous release exists. Re-evaluating health of target release...")
                    try:
                        self.check_health(target_manifest)
                        self.state.record_deployment_success(target_manifest)
                        print(f"--> Target release {target_manifest.release_id} is healthy and marked active.")
                        return
                    except Exception as verify_err:
                        self.state.record_manual_intervention_required(f"Initial deployment recovery failed: {verify_err}")
                        raise verify_err

    def apply_release(
        self,
        manifest: ReleaseManifest,
        auth: DeploymentAuthorization,
    ) -> None:
        """Apply a validated release manifest with concurrency locking, phase tracking, and rollback."""
        with DeploymentLock(self.lock_file):
            # Check for any prior interrupted deployment
            prior_tx = self.check_for_interrupted_transaction()
            if prior_tx:
                raise InterruptedDeploymentError(
                    f"Cannot deploy: Unfinished deployment transaction '{prior_tx.get('tx_id')}' detected "
                    f"in phase '{prior_tx.get('phase')}'. Run 'deploy.py recover' to resolve before deploying."
                )

            # Re-validate authorization against manifest
            auth.validate_against_manifest(manifest, self.environment)

            tx_id = f"tx-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{manifest.release_id[:8]}"
            print(f"============================================================")
            print(f" Deploying Release: {manifest.release_id} (TX: {tx_id})")
            print(f" Operator         : {auth.operator}")
            print(f" Commit           : {manifest.git_sha[:10]}")
            print(f"============================================================")

            current = self.state.data.get("current_release")
            prev_manifest = ReleaseManifest.from_dict(current) if current else None

            # 1. Start transaction & record PREPARED phase
            self.state.start_transaction(tx_id, auth.operator, manifest, prev_manifest)
            self._log_audit("APPLY_START", auth.operator, manifest.release_id, "STARTED", f"TX={tx_id}")

            changed_services: set[str] = set()
            if current and isinstance(current.get("images"), dict):
                cur_images = current["images"]
                for svc, new_img in manifest.images.items():
                    if cur_images.get(svc) != new_img:
                        changed_services.add(svc)
            else:
                changed_services = set(manifest.services)

            print(f"--> Changed services detected: {sorted(list(changed_services)) or 'None (configuration only)'}")

            try:
                # 2. Phase: Migrating
                self.state.transition_phase(PHASE_MIGRATING)
                self.run_migrations(manifest)
                self.state.transition_phase(PHASE_MIGRATING, completed_op="migrations", migration_outcome="success")

                # 3. Phase: Applying
                self.state.transition_phase(PHASE_APPLYING)
                if not current or changed_services == set(manifest.services):
                    print("--> Applying full Compose stack...")
                    self._run_compose(["up", "-d"], manifest=manifest)
                else:
                    for svc in changed_services:
                        print(f"--> Selectively recreating changed service '{svc}'...")
                        self._run_compose(["up", "-d", "--no-deps", svc], manifest=manifest)
                self.state.transition_phase(PHASE_APPLYING, completed_op="compose_up")

                # 4. Phase: Verifying
                self.state.transition_phase(PHASE_VERIFYING)
                self.check_health(manifest)
                self.state.transition_phase(PHASE_VERIFYING, completed_op="health_verified", health_outcome="success")

                # 5. Success
                self.state.record_deployment_success(manifest)
                self._log_audit("APPLY_SUCCESS", auth.operator, manifest.release_id, "SUCCESS", f"TX={tx_id}")
                print(f"============================================================")
                print(f" STATUS: SUCCESS - Release '{manifest.release_id}' deployed successfully!")
                print(f"============================================================")

            except Exception as deploy_err:
                print(f"\n[ERROR] Deployment failed: {deploy_err}", file=sys.stderr)
                self.state.record_deployment_failure(manifest, str(deploy_err))
                self._log_audit("APPLY_FAIL", auth.operator, manifest.release_id, "FAILED", str(deploy_err))

                print("\n--> Initiating automatic safe rollback...")
                try:
                    if current:
                        target = ReleaseManifest.from_dict(current)
                        self._rollback_internal(target_manifest=target, failing_manifest=manifest)
                    else:
                        self._rollback_internal(failing_manifest=manifest)
                    print("[INFO] Automatic rollback completed successfully.")
                except Exception as rollback_err:
                    print(f"[CRITICAL] Automatic rollback could not be completed: {rollback_err}", file=sys.stderr)
                    print("[CRITICAL] Manual intervention required on host.", file=sys.stderr)

                raise deploy_err

    def rollback(self) -> None:
        """Operator-initiated rollback to last-successful release."""
        with DeploymentLock(self.lock_file):
            prior_tx = self.check_for_interrupted_transaction()
            if prior_tx:
                raise InterruptedDeploymentError(
                    f"Cannot roll back: Unfinished deployment transaction '{prior_tx.get('tx_id')}' detected. "
                    "Run 'deploy.py recover' first."
                )
            self._rollback_internal()

    def _rollback_internal(
        self,
        target_manifest: Optional[ReleaseManifest] = None,
        failing_manifest: Optional[ReleaseManifest] = None,
    ) -> None:
        if target_manifest is not None:
            prev_manifest = target_manifest
        else:
            prev_data = self.state.data.get("previous_release") or self.state.data.get("last_successful_release")
            if not prev_data:
                raise DeploymentExecutionError(
                    "Rollback aborted: No previous successful release recorded in state. Cannot roll back."
                )
            prev_manifest = ReleaseManifest.from_dict(prev_data)

        # Conservative backward compatibility check
        manifests_to_check: list[dict[str, Any]] = []
        if failing_manifest:
            manifests_to_check.append(failing_manifest.to_dict())
        if self.state.data.get("current_release"):
            manifests_to_check.append(self.state.data["current_release"])

        for manifest_data in manifests_to_check:
            for mig in manifest_data.get("migrations", []):
                if mig.get("applied") and not mig.get("backward_compatible"):
                    raise DeploymentExecutionError(
                        f"Automated rollback blocked: Release applied database migration '{mig.get('command')}' "
                        f"for service '{mig.get('service')}' which was declared NOT backward-compatible. "
                        f"Reverting application containers against an incompatible schema risks corruption. "
                        f"Manual database recovery is required."
                    )

        print(f"--> Rolling back to release: '{prev_manifest.release_id}' (Commit: {prev_manifest.git_sha[:10]})...")
        self._run_compose(["up", "-d"], manifest=prev_manifest)
        self.check_health(prev_manifest)
        self.state.record_rollback_success(prev_manifest)
        print(f"--> Rollback to '{prev_manifest.release_id}' completed and verified successfully.")

    def get_status(self) -> dict[str, Any]:
        """Return diagnostic status of deployment, containers, and resources without leaking secrets."""
        st = dict(self.state.data)
        st["active_lock"] = self.lock_file.exists()
        st["profile"] = self.profile
        st["provider"] = self.provider
        st["alembic_revision"] = self.get_database_alembic_revision() if self.profile != "micro" else None

        # Free disk space
        try:
            total, used, free = shutil.disk_usage(self.state_dir)
            st["disk_free_mb"] = free // (1024 * 1024)
        except Exception:
            st["disk_free_mb"] = None

        return st


def main() -> None:
    parser = argparse.ArgumentParser(description="Megalith Deployment and Rollback CLI (Task 010/011)")
    parser.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    parser.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    parser.add_argument("--database-mode", choices=["local", "external"], default=os.environ.get("MEGALITH_DB_MODE", "local"), help="Database hosting mode")
    parser.add_argument("--external-db", action="store_true", help="Deploy in external database mode")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # validate
    val_p = subparsers.add_parser("validate", help="Validate a release manifest")
    val_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")

    # prepare
    prep_p = subparsers.add_parser("prepare", help="Prepare a release (validate and check Compose config)")
    prep_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")
    prep_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    prep_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    prep_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    prep_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")

    # apply
    app_p = subparsers.add_parser("apply", help="Apply a release manifest to host Compose stack")
    app_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")
    app_p.add_argument("--operator", type=str, default=os.environ.get("USER", ""), help="Authenticated operator ID")
    app_p.add_argument("--confirm-release-id", type=str, default=None, help="Re-typed release ID confirming deployment")
    app_p.add_argument("--auth", type=str, default=None, help="Path to signed DeploymentAuthorization file")
    app_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    app_p.add_argument("--state-dir", type=str, default=None, help="Directory to store state and lock")
    app_p.add_argument("--compose-file", type=str, action="append", help="Compose file path (repeatable)")
    app_p.add_argument("--environment", type=str, default="production", help="Target environment")
    app_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    app_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    app_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    app_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")
    app_p.add_argument("--verify-ci", action="store_true", help="Enforce exact-commit CI provenance gate")
    app_p.add_argument("--ci-runs-file", type=str, default=None, help="Path to JSON file of CI runs (for offline/testing)")

    # recover
    rec_p = subparsers.add_parser("recover", help="Recover from an interrupted deployment transaction")
    rec_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    rec_p.add_argument("--state-dir", type=str, default=None, help="State directory")
    rec_p.add_argument("--compose-file", type=str, action="append", help="Compose file path")
    rec_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    rec_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    rec_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    rec_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")

    # check
    chk_p = subparsers.add_parser("check", help="Verify deployment health")
    chk_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    chk_p.add_argument("--compose-file", type=str, action="append", help="Compose file path")
    chk_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    chk_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    chk_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    chk_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")

    # rollback
    rb_p = subparsers.add_parser("rollback", help="Roll back to the previous successful release")
    rb_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    rb_p.add_argument("--state-dir", type=str, default=None, help="Directory to store state and lock")
    rb_p.add_argument("--compose-file", type=str, action="append", help="Compose file path")
    rb_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    rb_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    rb_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    rb_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")

    # status
    stat_p = subparsers.add_parser("status", help="Show current deployment status and diagnostics")
    stat_p.add_argument("--state-dir", type=str, default=None, help="State directory")
    stat_p.add_argument("--profile", choices=["full", "micro"], default="full", help="Deployment profile")
    stat_p.add_argument("--provider", choices=["oci", "gcp"], default=os.environ.get("MEGALITH_CLOUD_PROVIDER", "oci"), help="Target cloud provider")
    stat_p.add_argument("--database-mode", choices=["local", "external"], default=None, help="Database hosting mode")
    stat_p.add_argument("--external-db", action="store_true", help="Deploy in external database mode")

    args = parser.parse_args()

    profile = getattr(args, "profile", "full")
    provider = getattr(args, "provider", "oci")

    db_mode = (
        "external"
        if getattr(args, "external_db", False)
        else (getattr(args, "database_mode", None) or os.environ.get("MEGALITH_DB_MODE", "local"))
    )

    if hasattr(args, "compose_file") and args.compose_file:
        compose_files = [Path(f) for f in args.compose_file]
    elif profile == "micro":
        compose_files = [DEFAULT_COMPOSE_MICRO]
    else:
        compose_files = [DEFAULT_COMPOSE_BASE, DEFAULT_COMPOSE_PROD]

    state_dir = Path(args.state_dir) if getattr(args, "state_dir", None) else DEFAULT_STATE_DIR
    project = getattr(args, "project", None)
    env = getattr(args, "environment", "production")

    deployer = Deployer(
        compose_files=compose_files,
        project_name=project,
        state_dir=state_dir,
        environment=env,
        profile=profile,
        provider=provider,
        database_mode=db_mode,
    )

    try:
        if args.command == "validate":
            deployer.validate_manifest(args.manifest)
            print("STATUS: Manifest is valid.")
        elif args.command == "prepare":
            manifest = deployer.validate_manifest(args.manifest)
            deployer.prepare_release(manifest)
            print("STATUS: Release prepared successfully.")
        elif args.command == "apply":
            manifest = deployer.validate_manifest(args.manifest)
            auth = deployer.authorize_deployment(
                manifest=manifest,
                operator=args.operator,
                auth_file=args.auth,
                confirm_release_id=args.confirm_release_id,
                verify_ci=getattr(args, "verify_ci", False),
                ci_runs_file=getattr(args, "ci_runs_file", None),
            )
            deployer.apply_release(manifest, auth)
        elif args.command == "recover":
            deployer.recover()
        elif args.command == "check":
            deployer.check_health()
            print("STATUS: Health check passed.")
        elif args.command == "rollback":
            deployer.rollback()
        elif args.command == "status":
            st = deployer.get_status()
            print(json.dumps(st, indent=2))
    except (
        ReleaseValidationError,
        AuthorizationValidationError,
        DeploymentLockError,
        DeploymentExecutionError,
        InterruptedDeploymentError,
    ) as err:
        print(f"\n[ERROR] {err}", file=sys.stderr)
        sys.exit(1)
    except Exception as err:
        print(f"\n[UNEXPECTED ERROR] {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
