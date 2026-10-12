# Task 017: Agent Execution Safety, Secret Protection & Operational Approval Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Overview

Convert the operational lessons and incident retrospective from Tasks 016B–016D into enforceable, locally tested security controls. Megalith tooling must enforce machine-verifiable operational classifications, cryptographically bound out-of-tree operator approval gates, structural secret masking, and strict PostgreSQL version compatibility checks.

---

## Proposed File Structure & Responsibilities

1. **`platform/deploy/scripts/operations.py`**
   - Centralized operation classification enum (`LOCAL_READ`, `LOCAL_MUTATION`, `EXTERNAL_READ`, `EXTERNAL_MUTATION`, `DESTRUCTIVE`).
   - Operation catalog mapping Megalith commands (deploy, backup, restore, migrate, terraform) to classifications.
   - Operator approval gate specification (`OperationApproval`) with schema versioning, provider/resource/environment binding, action constraints, one-time nonce consumption, and out-of-tree file permission checks (`0600`/`0400`, UID verification).
   - Replay protection store (`ApprovalNonceStore`) tracking consumed one-time approval IDs.
   - Fail-closed execution gate wrapper (`enforce_operation_approval()`).

2. **`platform/deploy/scripts/masking.py`**
   - Structural secret-masking engine.
   - URL credential redaction (`urllib.parse` structural scrubbing of userinfo, passwords, and sensitive query tokens).
   - Key-value assignment scrubbing (`KEY="secret"`, JSON tokens, Authorization headers).
   - Exception traceback sanitization wrapper (`sanitize_exception()`).
   - Secret-safe subprocess execution helper (`safe_run_subprocess()`).

3. **`platform/deploy/postgres/version_compat.py`**
   - PostgreSQL engine and tooling compatibility validator.
   - Parses `server_version` and `pg_dump --version`.
   - Rejects incompatible client/server pairings (e.g. client < server major version).
   - Validates restore compatibility (detects cross-version configuration parameters like `transaction_timeout`).
   - Structural data integrity check (verifies schemas, table row counts, and Alembic version rather than relying solely on exit code 0).

4. **`platform/deploy/postgres/backup.py` and `restore.py`**
   - Integration with `version_compat.py` and `masking.py`.
   - Enforces operation classifications (`LOCAL_READ`, `EXTERNAL_READ`, `EXTERNAL_MUTATION`, `DESTRUCTIVE`).

5. **`tooling/schemas/operation_approval.schema.json`**
   - JSON Schema draft-07 validating operation approval manifests.

6. **`tooling/tests/test_operation_safety.py`**
   - 14 required negative and adversarial regression tests covering approval gates, scope violations, secret masking, and PostgreSQL version controls.

7. **Documentation:**
   - `docs/security/operation-authorization-policy.md`: Enforceable policy, operation classification matrix, approval workflow.
   - `docs/security/incident-retrospective-task-016b.md`: Retrospective on Task 016B authorization misunderstanding and credential exposure.
   - Update `AGENTS.md`: Reference enforceable controls and honest architectural boundaries.

---

## Tasks

### Task 1: Operation Classification & Machine-Enforced Approval Gate

- [x] **Step 1: Write failing tests for operation classification and approval gates**
  - Create `tooling/tests/test_operation_safety.py` with tests for:
    - Operation classification mappings (deploy, backup, restore, migrate, terraform).
    - Missing approval rejection.
    - Wrong project / wrong resource rejection.
    - Wrong environment rejection.
    - Expired approval rejection.
    - Reused one-time approval rejection.
    - Read-only approval used for mutation rejection.
    - In-tree approval record rejection (security boundary).
    - Loose file permission rejection.
    - Interactive response / string mistaken for approval rejection.
    - Approval infrastructure missing -> fail-closed.
- [x] **Step 2: Run test to confirm failures**
  - Run `pytest tooling/tests/test_operation_safety.py` and confirm `ModuleNotFoundError` or expected failures.
- [x] **Step 3: Implement `platform/deploy/scripts/operations.py` and JSON schema**
  - Implement `OperationClassification` enum.
  - Implement `OperationApproval` dataclass with `from_file()`, `validate()`, out-of-tree checks, UID checks, permission checks.
  - Implement `ApprovalNonceStore` for replay protection.
  - Implement `enforce_operation_approval()` gate.
  - Create `tooling/schemas/operation_approval.schema.json`.
- [x] **Step 4: Run tests to confirm pass**
  - Run `pytest tooling/tests/test_operation_safety.py` and confirm all approval tests pass.

### Task 2: Structural Secret Masking & Safe Subprocess Execution

- [x] **Step 1: Write failing tests for secret masking**
  - In `tooling/tests/test_operation_safety.py`, add tests for:
    - Structural database URL masking (passwords scrubbed, ports/hosts/dbs preserved).
    - Structural key-value assignment masking (environment strings, JSON tokens).
    - Exception traceback sanitization (secrets inside error messages replaced with `***`).
    - Subprocess execution wrapper output redaction (simulated commands with database URLs masked in stdout/stderr).
    - Docker config output masking.
- [x] **Step 2: Run test to confirm failures**
  - Run `pytest tooling/tests/test_operation_safety.py -k test_masking` and confirm failures.
- [x] **Step 3: Implement `platform/deploy/scripts/masking.py`**
  - Implement `mask_database_url()`, `mask_key_value()`, `mask_text()`.
  - Implement `sanitize_exception()`.
  - Implement `safe_run_subprocess()`.
- [x] **Step 4: Run tests to confirm pass**
  - Run `pytest tooling/tests/test_operation_safety.py -k test_masking` and confirm all masking tests pass.

### Task 3: PostgreSQL Version Compatibility Controls & Integrity Verification

- [x] **Step 1: Write failing tests for PostgreSQL version controls**
  - In `tooling/tests/test_operation_safety.py`, add tests for:
    - Client `pg_dump` major version < server major version -> rejected with diagnostic.
    - Cross-version restore compatibility detection (`transaction_timeout` detection).
    - Disaster recovery verification rejecting returncode 0 if row count or migration revision is missing.
- [x] **Step 2: Run test to confirm failures**
  - Run `pytest tooling/tests/test_operation_safety.py -k test_version` and confirm failures.
- [x] **Step 3: Implement `platform/deploy/postgres/version_compat.py`**
  - Implement `parse_version_tuple()`.
  - Implement `validate_pg_dump_compatibility()`.
  - Implement `validate_restore_target_compatibility()`.
  - Implement `verify_restored_database_integrity()`.
- [x] **Step 4: Integrate version controls into `backup.py` and `restore.py`**
  - Update `backup.py` to call `validate_pg_dump_compatibility()`.
  - Update `restore.py` to call `verify_restored_database_integrity()`.
- [x] **Step 5: Run tests to confirm pass**
  - Run `pytest tooling/tests/test_operation_safety.py -k test_version` and confirm pass.

### Task 4: Documentation, Incident Retrospective & AGENTS.md Updates

- [x] **Step 1: Write `docs/security/incident-retrospective-task-016b.md`**
  - Chronological analysis of Task 016B authorization misunderstanding.
  - Root cause: conflating prerequisite confirmation + modal answer with release gate.
  - Transcript credential leakage analysis.
  - Corrective actions implemented in Task 017.
- [x] **Step 2: Write `docs/security/operation-authorization-policy.md`**
  - Operation classifications table and definitions.
  - Out-of-tree operator approval specification and schema.
  - Secret masking and transcript hygiene rules.
  - PostgreSQL version compatibility matrix.
  - Honest architectural boundaries: agent shell access vs platform-level isolation.
- [x] **Step 3: Update `AGENTS.md`**
  - Reference the operation classification matrix and approval gate policy.
  - State boundaries and fail-closed rules.
  - Keep ADR-012 in Proposed.

### Task 5: Full Monorepo Verification & Report Generation

- [x] **Step 1: Run manifest validation**
  - Run `python3 tooling/validate.py`.
- [x] **Step 2: Run full test suite**
  - Run `pytest tooling/tests`.
- [x] **Step 3: Run git status check**
  - Confirm clean repository state with no untracked secrets.
- [x] **Step 4: Produce Task 017 Completion Report**
  - Report findings for all 6 completion criteria.
