#!/usr/bin/env python3
"""
Release manifest specification, parser, and strict validation engine for Megalith.

Governs immutable deployment releases per ADR-008, ADR-010, and Task 010 requirements:
- Rejects mutable tags (e.g. :latest) and enforces cryptographic @sha256 digests.
- Enforces source Git commit SHA identity.
- Enforces separation of immutable release manifests (Schema v2) from operator authorizations.
- Rejects self-declared approval blocks inside manifests as proof of authorization.
- Provides canonical SHA-256 digest calculation over declarative release contents.
- Enforces backward compatibility declarations for database migrations.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import socket
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

KNOWN_SERVICES = {"demo-api", "demo-web"}
ALLOWED_ENVIRONMENTS = {"production", "staging", "test"}
ALLOWED_MIGRATION_COMMANDS = {"alembic upgrade head"}
ALLOWED_MIGRATION_SERVICES = {"demo-api"}

RELEASE_ID_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$")
AUTH_ID_REGEX = re.compile(r"^auth-[a-zA-Z0-9._-]+$")
GIT_SHA_REGEX = re.compile(r"^[0-9a-fA-F]{40}$")
DIGEST_REGEX = re.compile(r"^.+@sha256:[0-9a-fA-F]{64}$")
SHA256_HEX_REGEX = re.compile(r"^sha256:[0-9a-fA-F]{64}$")
MUTABLE_TAG_WITHOUT_DIGEST_REGEX = re.compile(r"^[^@]+:[a-zA-Z0-9._-]+$")


class ReleaseValidationError(ValueError):
    """Raised when a release manifest fails structural or semantic validation."""
    pass


class AuthorizationValidationError(ValueError):
    """Raised when deployment authorization fails validation or fails to bind to the manifest."""
    pass


class UntrustedApprovalError(AuthorizationValidationError):
    """Raised when a self-declared or forged approval is presented as trusted authorization."""
    pass


@dataclass
class MigrationDeclaration:
    service: str
    applied: bool
    command: str
    backward_compatible: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ApprovalDeclaration:
    """Legacy approval object embedded in Schema v1 manifests."""
    authorized_by: str
    authorized_at: str
    release_id: str
    target_environment: str
    intent: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DeploymentAuthorization:
    """
    Authenticated host-side deployment authorization record.
    Binds an authenticated operator, target environment, and the exact
    canonical cryptographic digest of the release manifest.
    """
    schema_version: int
    authorization_id: str
    operator: str
    release_id: str
    target_environment: str
    manifest_digest: str
    authorized_at: str
    intent: str = "deploy"
    hostname: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "schema_version": self.schema_version,
            "authorization_id": self.authorization_id,
            "operator": self.operator,
            "release_id": self.release_id,
            "target_environment": self.target_environment,
            "manifest_digest": self.manifest_digest,
            "authorized_at": self.authorized_at,
            "intent": self.intent,
        }
        if self.hostname is not None:
            data["hostname"] = self.hostname
        if self.notes is not None:
            data["notes"] = self.notes
        return data

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=False) + "\n"

    def save(self, target_path: Path | str) -> None:
        path = Path(target_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write with restrictive permissions (0600)
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        mode = 0o600
        fd = os.open(str(path), flags, mode)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeploymentAuthorization:
        if not isinstance(data, dict):
            raise AuthorizationValidationError("Authorization data must be a dictionary")

        schema_ver = data.get("schema_version")
        if schema_ver != 1:
            raise AuthorizationValidationError(f"Unsupported authorization schema_version: {schema_ver}")

        auth_id = data.get("authorization_id")
        if not isinstance(auth_id, str) or not AUTH_ID_REGEX.match(auth_id):
            raise AuthorizationValidationError(f"Invalid authorization_id format: '{auth_id}'")

        operator = data.get("operator")
        if not isinstance(operator, str) or not operator.strip():
            raise AuthorizationValidationError("Field 'operator' must be a non-empty string")

        rel_id = data.get("release_id")
        if not isinstance(rel_id, str) or not RELEASE_ID_REGEX.match(rel_id):
            raise AuthorizationValidationError(f"Invalid release_id in authorization: '{rel_id}'")

        target_env = data.get("target_environment")
        if target_env not in ALLOWED_ENVIRONMENTS:
            raise AuthorizationValidationError(f"Invalid target_environment in authorization: '{target_env}'")

        digest = data.get("manifest_digest")
        if not isinstance(digest, str) or not SHA256_HEX_REGEX.match(digest):
            raise AuthorizationValidationError(f"Invalid manifest_digest in authorization: '{digest}'")

        auth_at = data.get("authorized_at")
        _validate_iso_timestamp(auth_at, "authorized_at")

        intent = data.get("intent")
        if intent != "deploy":
            raise AuthorizationValidationError(f"Authorization intent must be 'deploy', got: '{intent}'")

        return cls(
            schema_version=schema_ver,
            authorization_id=auth_id,
            operator=operator,
            release_id=rel_id,
            target_environment=target_env,
            manifest_digest=digest,
            authorized_at=auth_at,
            intent=intent,
            hostname=data.get("hostname"),
            notes=data.get("notes"),
        )

    @classmethod
    def from_file(
        cls,
        path: Path | str,
        enforce_permissions: bool = True,
        enforce_out_of_tree: bool = True,
        repo_root: Optional[Path] = None,
    ) -> DeploymentAuthorization:
        p = Path(path).resolve()
        if not p.is_file():
            raise AuthorizationValidationError(f"Authorization file not found: {p}")

        if enforce_out_of_tree:
            root = repo_root or Path(__file__).resolve().parents[3]
            is_in_tree = False
            try:
                p.relative_to(root.resolve())
                is_in_tree = True
            except ValueError:
                is_in_tree = False

            if is_in_tree:
                raise AuthorizationValidationError(
                    f"Security Boundary Violation: Authorization record '{p}' is located inside "
                    f"the repository tree ({root}). Untrusted repository content, git commits, "
                    "or pull requests cannot authorize host deployments."
                )

        if enforce_permissions:
            mode = p.stat().st_mode
            # Reject if group or world accessible (must be at most 0600 or 0400)
            if mode & 0o077:
                raise AuthorizationValidationError(
                    f"Insecure permissions on authorization file {p} ({oct(mode)}). "
                    "Authorization record must be restricted to mode 0600 or 0400, strictly accessible only to the operator."
                )
            # Check ownership (must belong to executing operator UID or root)
            curr_uid = os.getuid()
            if curr_uid != 0 and p.stat().st_uid not in (curr_uid, 0):
                raise AuthorizationValidationError(
                    f"Security Boundary Violation: Authorization record '{p}' is owned by UID {p.stat().st_uid}, "
                    f"not current operator process UID {curr_uid}."
                )

        try:
            content = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as err:
            raise AuthorizationValidationError(f"Malformed JSON in authorization file {p}: {err}") from err

        return cls.from_dict(content)

    def validate_against_manifest(
        self,
        manifest: ReleaseManifest,
        environment: str,
        max_age_seconds: Optional[int] = 3600,
    ) -> None:
        """Strictly verify that this authorization matches the manifest and deployment context."""
        if not self.operator or not self.operator.strip():
            raise AuthorizationValidationError("Authorization has empty or unauthenticated operator.")

        if self.release_id != manifest.release_id:
            raise AuthorizationValidationError(
                f"Authorization release_id mismatch: authorization grants '{self.release_id}' "
                f"but deployment target is '{manifest.release_id}'."
            )

        if self.target_environment != environment:
            raise AuthorizationValidationError(
                f"Authorization environment mismatch: authorization targets '{self.target_environment}' "
                f"but deployment environment is '{environment}'."
            )

        if self.target_environment != manifest.environment:
            raise AuthorizationValidationError(
                f"Authorization environment mismatch: authorization targets '{self.target_environment}' "
                f"but manifest environment is '{manifest.environment}'."
            )

        if self.intent != "deploy":
            raise AuthorizationValidationError(f"Authorization intent must be 'deploy', got: '{self.intent}'")

        expected_digest = manifest.canonical_digest()
        if self.manifest_digest != expected_digest:
            raise AuthorizationValidationError(
                f"Cryptographic digest mismatch: authorization references digest '{self.manifest_digest}' "
                f"but manifest content calculates to '{expected_digest}'. "
                "Release manifest content has been modified or tampered with after authorization!"
            )

        if max_age_seconds is not None:
            try:
                auth_dt = datetime.fromisoformat(self.authorized_at.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                age = (now - auth_dt).total_seconds()
                if age < -60:
                    raise AuthorizationValidationError(
                        f"Authorization timestamp is in the future ({self.authorized_at}). System clock mismatch or invalid record."
                    )
                if age > max_age_seconds:
                    raise AuthorizationValidationError(
                        f"Authorization record expired: authorized {int(age)}s ago, exceeding maximum TTL of {max_age_seconds}s."
                    )
            except (ValueError, TypeError) as ts_err:
                raise AuthorizationValidationError(f"Invalid timestamp in authorization: {ts_err}") from ts_err


@dataclass
class ReleaseManifest:
    schema_version: int
    release_id: str
    git_sha: str
    created_at: str
    environment: str
    config_version: str
    services: list[str]
    images: dict[str, str]
    migrations: list[MigrationDeclaration] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    approval: Optional[ApprovalDeclaration] = None

    def canonical_dict(self) -> dict[str, Any]:
        """
        Pure declarative release content dictionary without any external or self-declared approval.
        Used to calculate immutable cryptographic manifest digest.
        """
        return {
            "schema_version": self.schema_version,
            "release_id": self.release_id,
            "git_sha": self.git_sha,
            "created_at": self.created_at,
            "environment": self.environment,
            "config_version": self.config_version,
            "services": sorted(list(self.services)),
            "images": {k: self.images[k] for k in sorted(self.images.keys())},
            "migrations": [m.to_dict() for m in self.migrations],
            "metadata": dict(self.metadata),
        }

    def canonical_digest(self) -> str:
        """Calculates canonical sha256 digest of immutable release content."""
        canonical_json = json.dumps(self.canonical_dict(), sort_keys=True, separators=(",", ":"))
        digest_hex = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
        return f"sha256:{digest_hex}"

    def to_dict(self) -> dict[str, Any]:
        data = self.canonical_dict()
        if self.approval is not None and self.schema_version == 1:
            data["approval"] = self.approval.to_dict()
        return data

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=False) + "\n"

    def save(self, target_path: Path | str) -> None:
        path = Path(target_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.to_json(), encoding="utf-8")

    @classmethod
    def from_dict(cls, data: dict[str, Any], require_approval: bool = False) -> ReleaseManifest:
        return validate_release_dict(data, require_approval=require_approval)

    @classmethod
    def from_file(cls, path: Path | str, require_approval: bool = False) -> ReleaseManifest:
        p = Path(path)
        if not p.is_file():
            raise ReleaseValidationError(f"Release manifest file not found: {p}")
        try:
            content = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as err:
            raise ReleaseValidationError(f"Malformed JSON in release manifest {p}: {err}") from err
        if not isinstance(content, dict):
            raise ReleaseValidationError("Release manifest root must be a JSON object")
        return cls.from_dict(content, require_approval=require_approval)


def _validate_iso_timestamp(ts: str, field_name: str) -> None:
    if not isinstance(ts, str):
        raise ReleaseValidationError(f"Field '{field_name}' must be an ISO 8601 string")
    try:
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError as err:
        raise ReleaseValidationError(f"Invalid timestamp in '{field_name}': {ts}") from err


def validate_release_dict(data: dict[str, Any], require_approval: bool = False) -> ReleaseManifest:
    """Strictly validate a release manifest dictionary against domain contracts."""
    if not isinstance(data, dict):
        raise ReleaseValidationError("Manifest data must be a dictionary")

    # 1. Schema version
    schema_ver = data.get("schema_version")
    if schema_ver not in (1, 2):
        raise ReleaseValidationError(f"Unsupported schema_version: {schema_ver}. Expected 1 or 2.")

    # In Schema v2, embedded approval block is strictly forbidden
    if schema_ver == 2 and "approval" in data:
        raise ReleaseValidationError(
            "Embedded 'approval' object is strictly forbidden in Release Manifest v2. "
            "Releases are immutable declarative artifacts. Deployment authorization "
            "must be provided independently via an authenticated operator authorization."
        )

    # 2. Release ID
    release_id = data.get("release_id")
    if not isinstance(release_id, str) or not release_id.strip():
        raise ReleaseValidationError("Field 'release_id' is required and must be a non-empty string.")
    if "/" in release_id or "\\" in release_id or ".." in release_id:
        raise ReleaseValidationError(f"Path traversal characters forbidden in release_id: {release_id}")
    if not RELEASE_ID_REGEX.match(release_id):
        raise ReleaseValidationError(
            f"Invalid release_id format: '{release_id}'. Must match pattern '^[a-zA-Z0-9][a-zA-Z0-9._-]{{2,63}}$'"
        )

    # 3. Source Git SHA
    git_sha = data.get("git_sha")
    if not isinstance(git_sha, str) or not GIT_SHA_REGEX.match(git_sha):
        raise ReleaseValidationError(f"Field 'git_sha' must be a 40-character hexadecimal string, got: '{git_sha}'")

    # 4. Created timestamp
    created_at = data.get("created_at")
    _validate_iso_timestamp(created_at, "created_at")

    # 5. Environment
    env = data.get("environment")
    if env not in ALLOWED_ENVIRONMENTS:
        raise ReleaseValidationError(
            f"Invalid environment '{env}'. Must be one of {sorted(ALLOWED_ENVIRONMENTS)}"
        )

    # 6. Configuration version
    config_ver = data.get("config_version")
    if not isinstance(config_ver, str) or not config_ver.strip():
        raise ReleaseValidationError("Field 'config_version' must be a non-empty string")

    # 7. Services list
    services = data.get("services")
    if not isinstance(services, list) or len(services) == 0:
        raise ReleaseValidationError("Field 'services' must be a non-empty list of service names")
    if len(services) != len(set(services)):
        raise ReleaseValidationError("Duplicate service declared in 'services' list")
    for svc in services:
        if svc not in KNOWN_SERVICES:
            raise ReleaseValidationError(f"Unknown service '{svc}' declared. Known services: {sorted(KNOWN_SERVICES)}")

    # 8. Images mapping
    images = data.get("images")
    if not isinstance(images, dict) or len(images) == 0:
        raise ReleaseValidationError("Field 'images' must be a dictionary mapping service names to image references")

    for svc in services:
        if svc not in images:
            raise ReleaseValidationError(f"Missing image reference for declared service '{svc}'")

    for img_svc, img_ref in images.items():
        if img_svc not in services:
            raise ReleaseValidationError(f"Image declared for service '{img_svc}' not listed in 'services'")
        if not isinstance(img_ref, str) or not img_ref.strip():
            raise ReleaseValidationError(f"Image reference for '{img_svc}' must be a non-empty string")

        if "@sha256:" not in img_ref:
            raise ReleaseValidationError(
                f"Mutable image reference rejected for '{img_svc}': '{img_ref}'. "
                f"Deployments strictly require immutable cryptographic digests (@sha256:...)."
            )

        if not DIGEST_REGEX.match(img_ref):
            raise ReleaseValidationError(
                f"Invalid digest syntax for '{img_svc}': '{img_ref}'. "
                f"Must end with '@sha256:<64-hex-digits>'."
            )

    # 9. Migrations declaration (optional)
    migration_objs: list[MigrationDeclaration] = []
    raw_migrations = data.get("migrations", [])
    if not isinstance(raw_migrations, list):
        raise ReleaseValidationError("Field 'migrations' must be a list")

    for idx, mig in enumerate(raw_migrations):
        if not isinstance(mig, dict):
            raise ReleaseValidationError(f"Migration item at index {idx} must be a dictionary")
        mig_svc = mig.get("service")
        if mig_svc not in ALLOWED_MIGRATION_SERVICES:
            raise ReleaseValidationError(
                f"Migration item at index {idx} has unsupported service '{mig_svc}'. Allowed: {sorted(ALLOWED_MIGRATION_SERVICES)}"
            )
        mig_applied = mig.get("applied")
        if not isinstance(mig_applied, bool):
            raise ReleaseValidationError(f"Migration item at index {idx} field 'applied' must be a boolean")
        mig_cmd = mig.get("command")
        if mig_cmd not in ALLOWED_MIGRATION_COMMANDS:
            raise ReleaseValidationError(
                f"Migration command '{mig_cmd}' at index {idx} not in allowlist: {sorted(ALLOWED_MIGRATION_COMMANDS)}"
            )
        mig_compat = mig.get("backward_compatible")
        if not isinstance(mig_compat, bool):
            raise ReleaseValidationError(
                f"Migration item at index {idx} field 'backward_compatible' must be a boolean"
            )
        migration_objs.append(
            MigrationDeclaration(
                service=mig_svc,
                applied=mig_applied,
                command=mig_cmd,
                backward_compatible=mig_compat,
            )
        )

    # 10. Metadata (optional)
    raw_metadata = data.get("metadata", {})
    if not isinstance(raw_metadata, dict):
        raise ReleaseValidationError("Field 'metadata' must be a dictionary")

    # 11. Legacy approval metadata (only valid for schema v1)
    approval_obj: Optional[ApprovalDeclaration] = None
    raw_approval = data.get("approval")

    if schema_ver == 1:
        if require_approval and raw_approval is None:
            raise ReleaseValidationError(
                "Explicit human authorization ('approval') is required for deployment but missing from manifest."
            )

        if raw_approval is not None:
            if not isinstance(raw_approval, dict):
                raise ReleaseValidationError("Field 'approval' must be a dictionary")

            auth_by = raw_approval.get("authorized_by")
            if not isinstance(auth_by, str) or not auth_by.strip():
                raise ReleaseValidationError("Approval field 'authorized_by' must be a non-empty string")

            auth_at = raw_approval.get("authorized_at")
            _validate_iso_timestamp(auth_at, "approval.authorized_at")

            appr_rel_id = raw_approval.get("release_id")
            if appr_rel_id != release_id:
                raise ReleaseValidationError(
                    f"Approval release_id mismatch: approval grants '{appr_rel_id}' but manifest is '{release_id}'"
                )

            appr_env = raw_approval.get("target_environment")
            if appr_env != env:
                raise ReleaseValidationError(
                    f"Approval environment mismatch: approval targets '{appr_env}' but manifest environment is '{env}'"
                )

            appr_intent = raw_approval.get("intent")
            if appr_intent != "deploy":
                raise ReleaseValidationError(f"Approval intent must be 'deploy', got: '{appr_intent}'")

            approval_obj = ApprovalDeclaration(
                authorized_by=auth_by,
                authorized_at=auth_at,
                release_id=appr_rel_id,
                target_environment=appr_env,
                intent=appr_intent,
            )

    return ReleaseManifest(
        schema_version=schema_ver,
        release_id=release_id,
        git_sha=git_sha,
        created_at=created_at,
        environment=env,
        config_version=config_ver,
        services=services,
        images=images,
        migrations=migration_objs,
        metadata=raw_metadata,
        approval=approval_obj,
    )


def create_release_manifest(
    release_id: str,
    git_sha: str,
    environment: str,
    images: dict[str, str],
    services: Optional[list[str]] = None,
    config_version: str = "1.0",
    migrations: Optional[list[dict[str, Any]]] = None,
    metadata: Optional[dict[str, Any]] = None,
    schema_version: int = 2,
    approval: Optional[dict[str, Any]] = None,
    require_approval: bool = False,
) -> ReleaseManifest:
    """Helper to construct and strictly validate a ReleaseManifest."""
    if services is None:
        services = sorted(list(images.keys()))

    now_iso = datetime.now(timezone.utc).isoformat()
    raw: dict[str, Any] = {
        "schema_version": schema_version,
        "release_id": release_id,
        "git_sha": git_sha,
        "created_at": now_iso,
        "environment": environment,
        "config_version": config_version,
        "services": services,
        "images": images,
        "migrations": migrations or [],
        "metadata": metadata or {},
    }
    if schema_version == 1 and approval is not None:
        raw["approval"] = approval

    return validate_release_dict(raw, require_approval=require_approval)


def create_deployment_authorization(
    operator: str,
    manifest: ReleaseManifest,
    environment: Optional[str] = None,
    hostname: Optional[str] = None,
    notes: Optional[str] = None,
) -> DeploymentAuthorization:
    """Constructs a cryptographic DeploymentAuthorization record for an operator."""
    if not operator or not operator.strip():
        raise AuthorizationValidationError("Operator identity is required to authorize deployment.")

    target_env = environment or manifest.environment
    now_iso = datetime.now(timezone.utc).isoformat()
    canonical_digest = manifest.canonical_digest()
    auth_id = f"auth-{manifest.release_id}-{int(datetime.now(timezone.utc).timestamp())}"
    host = hostname or socket.gethostname()

    auth = DeploymentAuthorization(
        schema_version=1,
        authorization_id=auth_id,
        operator=operator.strip(),
        release_id=manifest.release_id,
        target_environment=target_env,
        manifest_digest=canonical_digest,
        authorized_at=now_iso,
        intent="deploy",
        hostname=host,
        notes=notes,
    )
    auth.validate_against_manifest(manifest, target_env)
    return auth
