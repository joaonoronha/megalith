#!/usr/bin/env python3
"""
Release manifest specification, parser, and strict validation engine for Megalith.

Governs immutable deployment releases per ADR-008, ADR-010, and Task 009 requirements:
- Rejects mutable tags (e.g. :latest) and enforces cryptographic @sha256 digests.
- Enforces source Git commit SHA identity.
- Enforces human authorization metadata before deployment.
- Enforces backward compatibility declarations for database migrations.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

KNOWN_SERVICES = {"demo-api", "demo-web"}
ALLOWED_ENVIRONMENTS = {"production", "staging", "test"}
ALLOWED_MIGRATION_COMMANDS = {"alembic upgrade head"}
ALLOWED_MIGRATION_SERVICES = {"demo-api"}

RELEASE_ID_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$")
GIT_SHA_REGEX = re.compile(r"^[0-9a-fA-F]{40}$")
DIGEST_REGEX = re.compile(r"^.+@sha256:[0-9a-fA-F]{64}$")
MUTABLE_TAG_WITHOUT_DIGEST_REGEX = re.compile(r"^[^@]+:[a-zA-Z0-9._-]+$")


class ReleaseValidationError(ValueError):
    """Raised when a release manifest fails structural or semantic validation."""
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
    authorized_by: str
    authorized_at: str
    release_id: str
    target_environment: str
    intent: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "schema_version": self.schema_version,
            "release_id": self.release_id,
            "git_sha": self.git_sha,
            "created_at": self.created_at,
            "environment": self.environment,
            "config_version": self.config_version,
            "services": list(self.services),
            "images": dict(self.images),
            "migrations": [m.to_dict() for m in self.migrations],
            "metadata": dict(self.metadata),
        }
        if self.approval is not None:
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
        # Require 'Z' or valid timezone offset
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError as err:
        raise ReleaseValidationError(f"Invalid timestamp in '{field_name}': {ts}") from err


def validate_release_dict(data: dict[str, Any], require_approval: bool = False) -> ReleaseManifest:
    """Strictly validate a release manifest dictionary against domain contracts."""
    if not isinstance(data, dict):
        raise ReleaseValidationError("Manifest data must be a dictionary")

    # 1. Schema version
    schema_ver = data.get("schema_version")
    if schema_ver != 1:
        raise ReleaseValidationError(f"Unsupported schema_version: {schema_ver}. Expected 1.")

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

        # Reject mutable tags without digest (e.g. repo:latest, repo:v1.0)
        if "@sha256:" not in img_ref:
            raise ReleaseValidationError(
                f"Mutable image reference rejected for '{img_svc}': '{img_ref}'. "
                f"Deployments strictly require immutable cryptographic digests (@sha256:...)."
            )

        # Validate cryptographic digest format
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

    # 11. Approval metadata
    approval_obj: Optional[ApprovalDeclaration] = None
    raw_approval = data.get("approval")

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
    approval: Optional[dict[str, Any]] = None,
    require_approval: bool = False,
) -> ReleaseManifest:
    """Helper to construct and strictly validate a ReleaseManifest."""
    if services is None:
        services = sorted(list(images.keys()))

    now_iso = datetime.now(timezone.utc).isoformat()
    raw: dict[str, Any] = {
        "schema_version": 1,
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
    if approval is not None:
        raw["approval"] = approval

    return validate_release_dict(raw, require_approval=require_approval)
