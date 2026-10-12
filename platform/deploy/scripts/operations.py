#!/usr/bin/env python3
"""
Megalith Operation Classification and Cooperative Approval Engine (Task 017.2).

Formal Classification: COOPERATIVELY ENFORCED, OPERATOR-REVIEWED.

Enforces machine-verifiable operational boundaries and cooperative workflow checks:
- Classifies operations into LOCAL_READ, LOCAL_MUTATION, EXTERNAL_READ, EXTERNAL_MUTATION, DESTRUCTIVE.
- Enforces operator approval records for EXTERNAL_MUTATION and DESTRUCTIVE actions.
- Governed cooperatively: Agy is permitted to create, modify, and consume local approval files
  for authorized workflows. Approval files serve as cooperative workflow controls and audit records,
  not independently trusted authorization tokens.
- GitHub pull-request review is the primary human checkpoint for repository changes,
  while explicit operator authorization remains mandatory for live cloud provisioning and mutations.
  PR approval does not automatically authorize live cloud operations.
- Ephemeral approval files reside out-of-tree (e.g. /tmp/megalith-approvals/) to avoid committing
  transient workflow tokens to Git.
- Binds approvals to exact provider, resource ID, environment, action, and expiration TTL.
- Enforces one-time execution replay protection via ApprovalNonceStore.
- Preserves the zero-recurring-cost objective without separate OS users, signing authorities, or daemons.
- Accepted residual risk: Unrestricted agent shell access can bypass repository-level approval checks.
"""

from __future__ import annotations

import enum
import json
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

ALLOWED_PROVIDERS = {"neon", "gcp", "oci", "aws", "docker", "local"}
ALLOWED_ENVIRONMENTS = {"production", "staging", "test", "development", "local"}

APPROVAL_ID_REGEX = re.compile(r"^appr-[a-zA-Z0-9._-]+$")


class OperationClassification(str, enum.Enum):
    """Hierarchy of operation risk and mutation scope."""
    LOCAL_READ = "LOCAL_READ"
    LOCAL_MUTATION = "LOCAL_MUTATION"
    EXTERNAL_READ = "EXTERNAL_READ"
    EXTERNAL_MUTATION = "EXTERNAL_MUTATION"
    DESTRUCTIVE = "DESTRUCTIVE"

    @property
    def level(self) -> int:
        levels = {
            "LOCAL_READ": 0,
            "LOCAL_MUTATION": 1,
            "EXTERNAL_READ": 2,
            "EXTERNAL_MUTATION": 3,
            "DESTRUCTIVE": 4,
        }
        return levels[self.value]


class ApprovalValidationError(ValueError):
    """Raised when an operation approval record fails validation or scope checks."""
    pass


def classify_command(cmd: str, is_external: bool = False) -> OperationClassification:
    """
    Classifies a Megalith command string based on risk and execution boundary.
    """
    cmd_clean = cmd.strip()

    # Destructive keywords
    destructive_patterns = [
        r"\bterraform\s+destroy\b",
        r"\bDROP\s+(DATABASE|TABLE|SCHEMA|ROLE)\b",
        r"\bTRUNCATE\b",
        r"\bcloud[-_]init\s+teardown\b",
        r"\bproject[-_]delete\b",
    ]
    for pat in destructive_patterns:
        if re.search(pat, cmd_clean, re.IGNORECASE):
            return OperationClassification.DESTRUCTIVE

    # External mutations
    ext_mutation_patterns = [
        r"\bterraform\s+apply\b",
        r"\balembic\s+upgrade\b",
        r"\bCREATE\s+(TABLE|ROLE|INDEX|SCHEMA)\b",
        r"\bALTER\s+(TABLE|ROLE|SCHEMA)\b",
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\b",
        r"\bDELETE\s+FROM\b",
    ]
    for pat in ext_mutation_patterns:
        if re.search(pat, cmd_clean, re.IGNORECASE):
            if is_external or "terraform" in cmd_clean:
                return OperationClassification.EXTERNAL_MUTATION

    # External reads
    ext_read_patterns = [
        r"\bterraform\s+plan\b",
        r"\bSELECT\b",
        r"\bcurl\s+https?://",
        r"\bpg_dump\b",
    ]
    for pat in ext_read_patterns:
        if re.search(pat, cmd_clean, re.IGNORECASE):
            if is_external or "terraform" in cmd_clean:
                return OperationClassification.EXTERNAL_READ

    # Local mutations
    local_mutation_patterns = [
        r"\bdocker\s+compose\s+(up|down|restart|build)\b",
        r"\balembic\s+upgrade\b",
        r"\bpython3\s+.*deploy\.py\b",
    ]
    for pat in local_mutation_patterns:
        if re.search(pat, cmd_clean):
            return OperationClassification.LOCAL_MUTATION

    # Local reads (default for inspect/check/config/pytest)
    return OperationClassification.LOCAL_READ


@dataclass
class OperationApproval:
    """
    Cooperatively enforced workflow approval record and pre-flight safety check.
    Agy is permitted to create and manage local approval files on behalf of authorized workflows.
    Must reside strictly out-of-tree with restrictive mode (0600 or 0400).
    """
    schema_version: int
    approval_id: str
    operator: str
    provider: str
    resource: str
    environment: str
    allowed_actions: list[str]
    max_classification: OperationClassification
    authorized_at: str
    expires_at: Optional[str] = None
    one_time: bool = False
    nonce: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "schema_version": self.schema_version,
            "approval_id": self.approval_id,
            "operator": self.operator,
            "provider": self.provider,
            "resource": self.resource,
            "environment": self.environment,
            "allowed_actions": self.allowed_actions,
            "max_classification": self.max_classification.value if isinstance(self.max_classification, OperationClassification) else self.max_classification,
            "authorized_at": self.authorized_at,
            "one_time": self.one_time,
        }
        if self.expires_at is not None:
            data["expires_at"] = self.expires_at
        if self.nonce is not None:
            data["nonce"] = self.nonce
        if self.notes is not None:
            data["notes"] = self.notes
        return data

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=False) + "\n"

    def save(self, target_path: Path | str) -> None:
        p = Path(target_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        mode = 0o600
        fd = os.open(str(p), flags, mode)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    @classmethod
    def create(
        cls,
        approval_id: str,
        operator: str,
        provider: str,
        resource: str,
        environment: str,
        allowed_actions: list[str],
        max_classification: OperationClassification | str = OperationClassification.EXTERNAL_MUTATION,
        authorized_at: Optional[str] = None,
        expires_at: Optional[str] = None,
        ttl_minutes: int = 30,
        one_time: bool = True,
        nonce: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> OperationApproval:
        """
        Creates an OperationApproval instance.
        Agy or operator can call this to generate cooperative approval records for authorized operations.
        """
        if isinstance(max_classification, str):
            max_classification = OperationClassification(max_classification)
        now = datetime.now(timezone.utc)
        auth_at_str = authorized_at or now.isoformat()
        if expires_at is None:
            exp_str = (now + timedelta(minutes=ttl_minutes)).isoformat()
        else:
            exp_str = expires_at

        return cls(
            schema_version=1,
            approval_id=approval_id,
            operator=operator,
            provider=provider.lower(),
            resource=resource,
            environment=environment.lower(),
            allowed_actions=allowed_actions,
            max_classification=max_classification,
            authorized_at=auth_at_str,
            expires_at=exp_str,
            one_time=one_time,
            nonce=nonce,
            notes=notes,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OperationApproval:
        if not isinstance(data, dict):
            raise ApprovalValidationError("Approval record must be a JSON object.")

        schema_ver = data.get("schema_version")
        if schema_ver != 1:
            raise ApprovalValidationError(f"Unsupported approval schema_version: {schema_ver}")

        appr_id = data.get("approval_id")
        if not isinstance(appr_id, str) or not APPROVAL_ID_REGEX.match(appr_id):
            raise ApprovalValidationError(f"Invalid approval_id format: '{appr_id}'")

        operator = data.get("operator")
        if not isinstance(operator, str) or not operator.strip():
            raise ApprovalValidationError("Field 'operator' must be a non-empty string.")

        provider = data.get("provider", "").lower()
        if provider not in ALLOWED_PROVIDERS:
            raise ApprovalValidationError(f"Invalid provider in approval: '{provider}'")

        resource = data.get("resource")
        if not isinstance(resource, str) or not resource.strip():
            raise ApprovalValidationError("Field 'resource' must be a non-empty string.")

        env = data.get("environment", "").lower()
        if env not in ALLOWED_ENVIRONMENTS:
            raise ApprovalValidationError(f"Invalid environment in approval: '{env}'")

        actions = data.get("allowed_actions")
        if not isinstance(actions, list) or not actions:
            raise ApprovalValidationError("Field 'allowed_actions' must be a non-empty list of action strings.")

        max_cls_str = data.get("max_classification")
        try:
            max_cls = OperationClassification(max_cls_str)
        except (ValueError, KeyError):
            raise ApprovalValidationError(f"Invalid max_classification in approval: '{max_cls_str}'")

        auth_at = data.get("authorized_at")
        if not isinstance(auth_at, str):
            raise ApprovalValidationError("Field 'authorized_at' must be an ISO-8601 string.")

        return cls(
            schema_version=schema_ver,
            approval_id=appr_id,
            operator=operator,
            provider=provider,
            resource=resource,
            environment=env,
            allowed_actions=actions,
            max_classification=max_cls,
            authorized_at=auth_at,
            expires_at=data.get("expires_at"),
            one_time=bool(data.get("one_time", False)),
            nonce=data.get("nonce"),
            notes=data.get("notes"),
        )

    @classmethod
    def from_file(
        cls,
        path: Path | str,
        repo_root: Optional[Path] = None,
        enforce_permissions: bool = True,
        enforce_out_of_tree: bool = True,
    ) -> OperationApproval:
        p = Path(path).resolve()
        if not p.is_file():
            raise ApprovalValidationError(f"Approval file not found: {p}")

        if enforce_out_of_tree:
            root = repo_root or Path(__file__).resolve().parents[3]
            is_in_tree = False
            try:
                p.relative_to(root.resolve())
                is_in_tree = True
            except ValueError:
                is_in_tree = False

            if is_in_tree:
                raise ApprovalValidationError(
                    f"Workflow Policy Violation: Approval record '{p}' is located inside "
                    f"the repository tree ({root}). Ephemeral operation approvals are local workflow "
                    "tokens and must not be committed to Git. Pull request reviews govern repository "
                    "code, while explicit operator authorization governs live operations."
                )

        if enforce_permissions:
            mode = p.stat().st_mode
            if mode & 0o077:
                raise ApprovalValidationError(
                    f"Insecure permissions on authorization file {p} ({oct(mode)}). "
                    "Approval record must be restricted to mode 0600 or 0400."
                )

        try:
            content = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            raise ApprovalValidationError(f"Corrupt or unparseable JSON approval file '{p}': {e}") from e

        return cls.from_dict(content)

    @classmethod
    def from_raw_string(cls, s: str) -> OperationApproval:
        """Raw strings, conversational confirmations, or modal prompts are strictly rejected."""
        raise ApprovalValidationError(
            f"Policy Rejection: Interactive prompt responses, conversational affirmations, "
            f"or configuration modal answers ('{s[:40]}...') do NOT constitute valid approval. "
            "A structured, authenticated OperationApproval record is required."
        )


class ApprovalNonceStore:
    """Tracks consumed one-time approval tokens to prevent replay attacks."""

    def __init__(self, store_path: Optional[Path | str] = None):
        self.store_path = Path(store_path or "/tmp/megalith-approval-nonces.json")

    def _load(self) -> set[str]:
        if not self.store_path.exists():
            return set()
        try:
            data = json.loads(self.store_path.read_text(encoding="utf-8"))
            return set(data.get("consumed_approvals", []))
        except Exception:
            return set()

    def _save(self, nonces: set[str]) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"consumed_approvals": sorted(list(nonces))}
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        mode = 0o600
        fd = os.open(str(self.store_path), flags, mode)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(payload, indent=2) + "\n")

    def is_consumed(self, approval_id: str) -> bool:
        return approval_id in self._load()

    def consume(self, approval_id: str) -> None:
        consumed = self._load()
        if approval_id in consumed:
            raise ApprovalValidationError(
                f"One-time approval '{approval_id}' has already been consumed and cannot be reused."
            )
        consumed.add(approval_id)
        self._save(consumed)


def enforce_operation_approval(
    classification: OperationClassification,
    provider: str,
    resource: str,
    environment: str,
    action: str,
    approval_file: Optional[Path | str] = None,
    repo_root: Optional[Path] = None,
    nonce_store: Optional[ApprovalNonceStore] = None,
) -> bool:
    """
    Enforces that an operation has valid, unexpired, correctly scoped approval.
    Defaults to deny for EXTERNAL_MUTATION and DESTRUCTIVE.
    """
    # LOCAL_READ, LOCAL_MUTATION, and EXTERNAL_READ do not require host-gate approval
    if classification.level < OperationClassification.EXTERNAL_MUTATION.level:
        return True

    if not approval_file:
        raise ApprovalValidationError(
            f"Operation requires operator approval for classification '{classification.value}'. "
            "No approval record provided. Defaulting to deny."
        )

    approval = OperationApproval.from_file(approval_file, repo_root=repo_root)

    # 1. Classification clearance
    if classification.level > approval.max_classification.level:
        raise ApprovalValidationError(
            f"Insufficient classification clearance: operation is '{classification.value}', "
            f"but approval only authorizes up to '{approval.max_classification.value}'."
        )

    # 2. Provider match
    if approval.provider.lower() != provider.lower():
        raise ApprovalValidationError(
            f"Provider mismatch: requested '{provider}', approved for '{approval.provider}'."
        )

    # 3. Resource match
    if approval.resource != resource:
        raise ApprovalValidationError(
            f"Resource mismatch: requested '{resource}', approved for '{approval.resource}'."
        )

    # 4. Environment match
    if approval.environment.lower() != environment.lower():
        raise ApprovalValidationError(
            f"Environment mismatch: requested '{environment}', approved for '{approval.environment}'."
        )

    # 5. Action check
    if action not in approval.allowed_actions and "*" not in approval.allowed_actions:
        raise ApprovalValidationError(
            f"Action '{action}' is not in approved allowed_actions {approval.allowed_actions}."
        )

    # 6. Expiration check
    if approval.expires_at:
        try:
            exp_dt = datetime.fromisoformat(approval.expires_at.replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            if now_dt >= exp_dt:
                raise ApprovalValidationError(
                    f"Approval '{approval.approval_id}' expired at {approval.expires_at} (current time: {now_dt.isoformat()})."
                )
        except ValueError as err:
            if "expired" in str(err):
                raise
            raise ApprovalValidationError(f"Invalid expires_at format in approval: {approval.expires_at}") from err

    # 7. One-time execution replay protection
    if approval.one_time:
        store = nonce_store or ApprovalNonceStore()
        store.consume(approval.approval_id)

    return True
