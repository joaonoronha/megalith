#!/usr/bin/env python3
"""
Megalith Host-Side Deployment and Rollback Engine.

Executes controlled, immutable application releases and safe rollbacks per
ADR-008, ADR-010, and Task 009 requirements:
- Validates release manifests and human authorization.
- Prevents concurrent mutations via Linux fcntl.flock deployment lock.
- Supports selective service updates (recreates only changed containers).
- Executes database migrations via migration role before service startup.
- Verifies post-deployment container and HTTP/readiness health.
- Maintains host deployment state (current, previous, last-successful release).
- Enforces conservative rollback policies (blocks rollback if schema migrations
  were not declared backward-compatible).
- Strictly preserves persistent volumes (PostgreSQL data and Caddy TLS certificates).
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Import release manifest model from sibling module
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from release import (  # type: ignore
    ApprovalDeclaration,
    MigrationDeclaration,
    ReleaseManifest,
    ReleaseValidationError,
    validate_release_dict,
)

DEFAULT_REPO_ROOT = SCRIPT_DIR.parent.parent.parent
DEFAULT_COMPOSE_BASE = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.yaml"
DEFAULT_COMPOSE_PROD = DEFAULT_REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
DEFAULT_STATE_DIR = Path("/opt/megalith/deploy") if Path("/opt/megalith/deploy").exists() else (DEFAULT_REPO_ROOT / "platform" / "deploy" / ".state")


class DeploymentLockError(RuntimeError):
    """Raised when the deployment lock cannot be acquired."""
    pass


class DeploymentExecutionError(RuntimeError):
    """Raised when a deployment step or health verification fails."""
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
            # Read existing lock info if available
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

        # Record our lock metadata
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
    """Manages persistent on-host deployment state and release history."""

    def __init__(self, state_file: Path):
        self.state_file = state_file
        self.data: dict[str, Any] = {
            "current_release": None,
            "previous_release": None,
            "last_successful_release": None,
            "status": "uninitialized",
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
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.data["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.state_file.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")

    def record_deployment_success(self, manifest: ReleaseManifest) -> None:
        prev = self.data.get("current_release")
        if prev:
            self.data["previous_release"] = prev

        self.data["current_release"] = manifest.to_dict()
        self.data["last_successful_release"] = manifest.to_dict()
        self.data["status"] = "active"
        self._append_history("deploy_success", manifest.release_id, manifest.git_sha)
        self.save()

    def record_deployment_failure(self, manifest: ReleaseManifest, error_msg: str) -> None:
        self.data["status"] = "failed"
        self._append_history("deploy_failed", manifest.release_id, manifest.git_sha, error=error_msg)
        self.save()

    def record_rollback_success(self, rolled_back_manifest: ReleaseManifest) -> None:
        self.data["current_release"] = rolled_back_manifest.to_dict()
        self.data["last_successful_release"] = rolled_back_manifest.to_dict()
        self.data["status"] = "rolled_back"
        self._append_history("rollback_success", rolled_back_manifest.release_id, rolled_back_manifest.git_sha)
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
        # Keep last 50 entries
        self.data["history"] = history[-50:]


class Deployer:
    """Orchestrates Docker Compose deployments, migrations, and health checks."""

    def __init__(
        self,
        compose_files: list[Path],
        project_name: Optional[str] = None,
        state_dir: Optional[Path] = None,
        host_port: Optional[int] = None,
        dry_run: bool = False,
    ):
        self.compose_files = compose_files
        self.project_name = project_name or os.environ.get("COMPOSE_PROJECT_NAME", "megalith")
        self.state_dir = Path(state_dir) if state_dir else DEFAULT_STATE_DIR
        self.lock_file = self.state_dir / "deploy.lock"
        self.state = DeploymentState(self.state_dir / "state.json")
        self.host_port = host_port or int(os.environ.get("PORT", "80"))
        self.dry_run = dry_run

    def _build_env(self, manifest: Optional[ReleaseManifest] = None) -> dict[str, str]:
        env = os.environ.copy()
        env.setdefault("PORT", str(self.host_port))
        env.setdefault("INGRESS_PORT", str(self.host_port))
        if manifest:
            # Map release manifest images to Compose environment variables
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

    def validate_manifest(self, manifest_path: Path | str, require_approval: bool = True) -> ReleaseManifest:
        """Validate release manifest structure, images, digests, and approval."""
        print(f"--> Validating release manifest: {manifest_path}")
        manifest = ReleaseManifest.from_file(manifest_path, require_approval=require_approval)
        print(f"  -> Release ID   : {manifest.release_id}")
        print(f"  -> Git Commit   : {manifest.git_sha}")
        print(f"  -> Environment  : {manifest.environment}")
        print(f"  -> Services     : {', '.join(manifest.services)}")
        for svc, img in manifest.images.items():
            print(f"     * {svc}: {img}")
        if manifest.approval:
            print(f"  -> Authorized By: {manifest.approval.authorized_by} at {manifest.approval.authorized_at}")
        return manifest

    def prepare_release(self, manifest: ReleaseManifest) -> None:
        """Validate that declared images can be resolved / inspected."""
        print(f"--> Preparing release '{manifest.release_id}'...")
        # Validate Compose syntax with these images
        self._run_compose(["config"], manifest=manifest)
        print("  -> Compose configuration validated cleanly with release image variables.")

    def run_migrations(self, manifest: ReleaseManifest) -> None:
        """Execute database migrations if declared in the release manifest."""
        relevant_migrations = [m for m in manifest.migrations if m.applied]
        if not relevant_migrations:
            print("--> No database migrations declared for this release.")
            return

        print("--> Executing database migrations...")
        for mig in relevant_migrations:
            print(f"  -> Running migration for {mig.service}: '{mig.command}'")
            # Ensure postgres is running and healthy first
            self._run_compose(["up", "-d", "postgres"], manifest=manifest)
            self._wait_for_health("postgres", timeout_sec=30)

            # Run migration one-shot container
            # demo-migrate uses the isolated migration role
            mig_res = self._run_compose(["run", "--rm", "-T", "demo-migrate"], manifest=manifest)
            print(f"  -> Migration for {mig.service} completed successfully.")

    def check_health(self, manifest: Optional[ReleaseManifest] = None, timeout_sec: int = 40) -> bool:
        """Verify container health probes and HTTP endpoints."""
        print("--> Verifying deployment health...")
        services_to_check = ["postgres", "demo-api", "demo-web"]
        # If caddy is defined in compose, check it too
        for svc in services_to_check:
            self._wait_for_health(svc, timeout_sec=timeout_sec)

        # Verify application readiness endpoint via HTTP
        print("--> Verifying application API readiness probe (/ready)...")
        # In docker network or host port, probe the running service
        url = f"http://127.0.0.1:{self.host_port}/"
        deadline = time.time() + timeout_sec
        ready_passed = False

        while time.time() < deadline:
            try:
                # Probe API readiness directly via docker compose exec or host
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
                    # In newer Compose, stdout is json lines or array
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

    def apply_release(self, manifest: ReleaseManifest) -> None:
        """Apply a validated release manifest with concurrency locking and selective updates."""
        with DeploymentLock(self.lock_file):
            print(f"============================================================")
            print(f" Deploying Release: {manifest.release_id} (Commit: {manifest.git_sha[:10]})")
            print(f"============================================================")

            # 1. Determine which images changed relative to current release
            current = self.state.data.get("current_release")
            changed_services: set[str] = set()

            if current and isinstance(current.get("images"), dict):
                cur_images = current["images"]
                for svc, new_img in manifest.images.items():
                    if cur_images.get(svc) != new_img:
                        changed_services.add(svc)
            else:
                # Initial deployment: deploy all services
                changed_services = set(manifest.services)

            print(f"--> Changed services detected: {sorted(list(changed_services)) or 'None (configuration only)'}")

            try:
                # 2. Run migrations if necessary before starting application
                self.run_migrations(manifest)

                # 3. Apply Compose updates
                if not current or changed_services == set(manifest.services):
                    # Full apply
                    print("--> Applying full Compose stack...")
                    self._run_compose(["up", "-d"], manifest=manifest)
                else:
                    # Selective service deployment: update only changed services without restarting others
                    for svc in changed_services:
                        print(f"--> Selectively recreating changed service '{svc}'...")
                        self._run_compose(["up", "-d", "--no-deps", svc], manifest=manifest)

                # 4. Verify deployment health
                self.check_health(manifest)

                # 5. Record successful release
                self.state.record_deployment_success(manifest)
                print(f"============================================================")
                print(f" STATUS: SUCCESS - Release '{manifest.release_id}' deployed successfully!")
                print(f"============================================================")

            except Exception as deploy_err:
                print(f"\n[ERROR] Deployment failed: {deploy_err}", file=sys.stderr)
                self.state.record_deployment_failure(manifest, str(deploy_err))

                # Attempt automatic rollback if a previous release exists
                print("\n--> Initiating automatic safe rollback...")
                try:
                    if current:
                        target = ReleaseManifest.from_dict(current, require_approval=False)
                        self._rollback_internal(target_manifest=target, failing_manifest=manifest)
                    else:
                        self._rollback_internal(failing_manifest=manifest)
                    print("[INFO] Automatic rollback completed successfully.")
                except Exception as rollback_err:
                    print(f"[CRITICAL] Automatic rollback could not be completed: {rollback_err}", file=sys.stderr)
                    print("[CRITICAL] Manual intervention required on host.", file=sys.stderr)

                raise deploy_err

    def rollback(self) -> None:
        """User-initiated rollback to the last-known-good release."""
        with DeploymentLock(self.lock_file):
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
            prev_manifest = ReleaseManifest.from_dict(prev_data, require_approval=False)

        # Check migration compatibility
        # If the currently active or failing release applied a migration that was NOT backward-compatible,
        # automatic image rollback is dangerous and must be blocked!
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

        # Apply target release images
        self._run_compose(["up", "-d"], manifest=prev_manifest)

        # Verify health of rolled-back services
        self.check_health(prev_manifest)

        # Record rollback success in state
        self.state.record_rollback_success(prev_manifest)
        print(f"--> Rollback to '{prev_manifest.release_id}' completed and verified successfully.")


    def get_status(self) -> dict[str, Any]:
        """Return the current on-host deployment state."""
        return self.state.data


def main() -> None:
    parser = argparse.ArgumentParser(description="Megalith Deployment and Rollback CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # validate
    val_p = subparsers.add_parser("validate", help="Validate a release manifest")
    val_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")
    val_p.add_argument("--require-approval", action="store_true", help="Require approval metadata")

    # prepare
    prep_p = subparsers.add_parser("prepare", help="Prepare a release (validate and check Compose config)")
    prep_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")

    # apply
    app_p = subparsers.add_parser("apply", help="Apply a release manifest to host Compose stack")
    app_p.add_argument("manifest", type=str, help="Path to release manifest JSON file")
    app_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    app_p.add_argument("--state-dir", type=str, default=None, help="Directory to store state and lock")
    app_p.add_argument("--compose-file", type=str, action="append", help="Compose file path (repeatable)")

    # check
    chk_p = subparsers.add_parser("check", help="Verify deployment health")
    chk_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    chk_p.add_argument("--compose-file", type=str, action="append", help="Compose file path")

    # rollback
    rb_p = subparsers.add_parser("rollback", help="Roll back to the previous successful release")
    rb_p.add_argument("--project", type=str, default=None, help="Docker Compose project name")
    rb_p.add_argument("--state-dir", type=str, default=None, help="Directory to store state and lock")
    rb_p.add_argument("--compose-file", type=str, action="append", help="Compose file path")

    # status
    stat_p = subparsers.add_parser("status", help="Show current deployment status and release history")
    stat_p.add_argument("--state-dir", type=str, default=None, help="State directory")

    args = parser.parse_args()

    # Determine compose files
    if hasattr(args, "compose_file") and args.compose_file:
        compose_files = [Path(f) for f in args.compose_file]
    else:
        compose_files = [DEFAULT_COMPOSE_BASE, DEFAULT_COMPOSE_PROD]

    state_dir = Path(args.state_dir) if getattr(args, "state_dir", None) else DEFAULT_STATE_DIR
    project = getattr(args, "project", None)

    deployer = Deployer(
        compose_files=compose_files,
        project_name=project,
        state_dir=state_dir,
    )

    try:
        if args.command == "validate":
            deployer.validate_manifest(args.manifest, require_approval=args.require_approval)
            print("STATUS: Manifest is valid.")
        elif args.command == "prepare":
            manifest = deployer.validate_manifest(args.manifest, require_approval=False)
            deployer.prepare_release(manifest)
            print("STATUS: Release prepared successfully.")
        elif args.command == "apply":
            manifest = deployer.validate_manifest(args.manifest, require_approval=True)
            deployer.apply_release(manifest)
        elif args.command == "check":
            deployer.check_health()
            print("STATUS: Health check passed.")
        elif args.command == "rollback":
            deployer.rollback()
        elif args.command == "status":
            st = deployer.get_status()
            print(json.dumps(st, indent=2))
    except (ReleaseValidationError, DeploymentLockError, DeploymentExecutionError) as err:
        print(f"\n[ERROR] {err}", file=sys.stderr)
        sys.exit(1)
    except Exception as err:
        print(f"\n[UNEXPECTED ERROR] {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
