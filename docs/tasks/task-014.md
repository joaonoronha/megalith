# Task 014 & Task 014.1: Database Hosting Strategy Evaluation & Corrections

**Date:** 2026-10-12  
**Role:** Agy (Platform Implementation Engineer)  
**Status:** Complete (Corrected Specification)  
**Execution Gate:** Paused at gate; pending operator review and authorization for Task 015.

---

## 1. Context and Required Corrections (Task 014.1)

Task 014 evaluated hosting options for 6–15 independent applications at €0/month. Task 014.1 applies essential operational and architectural corrections to establish an accurate, robust foundation before any implementation in Task 015:

1. **Clarify Three Operating Tiers in ADR-012**:
   - **Local Development (Default):** Standard PostgreSQL 16 via Docker Compose (`compose.yaml`).
   - **Initial Deployment Candidate:** External Managed PostgreSQL via Neon Free (1 dedicated project per application under Topology A) for small, intermittent workloads.
   - **Future Self-Hosted Candidate:** OCI Always Free PostgreSQL (Ampere A1 ARM64 VM, 24 GB RAM, 200 GB block storage) under Topology B, contingent on verified capacity.
2. **ADR-012 Status**: Maintained in **Proposed** status.
3. **OCI Capacity Reality**: Explicitly documented that OCI Ampere A1 regional capacity exhaustion (`Out of host capacity for shape VM.Standard.A1.Flex`) is currently a **blocking operational constraint**, not merely a theoretical risk.
4. **Neon Free Official Quotas**: Verified and corrected against official documentation (`https://neon.tech/docs/introduction/plans`, verified 2026-10-12):
   - 100 projects included on Free plan ($0/mo).
   - 1 GB Postgres storage per project, capped at 20 GB account total.
   - 100 CU-hours per project per month (0.25 CU min provides up to 400 active hours; 1 CU provides 100 hours).
   - Auto-suspends after 5 minutes of inactivity; auto-wakes on TCP connect in ~500ms–1.5s.
   - Integrated PgBouncer pooler endpoint (`-pooler`) supporting up to 100 pooled connections.
   - 5 GB public network transfer (egress) per project per month.
   - 6-hour instant restore history (max 1 GB change history); 1 manual snapshot; no automated backup schedules.
   - Hard-stop enforcement; zero automatic charges; no credit card required.
5. **Recalculated Workload Scenarios**: Distinguishes Model W (intermittent web, ~15.6 CU-hrs/mo) from Model C (continuous worker/polling, 180–720 CU-hrs/mo) across 1, 3, 6, and 15 apps.
6. **Off-Host Backup Destinations**: Identified **Cloudflare R2** (10 GB free permanently, $0.00 egress) and **Backblaze B2** (10 GB free, no credit card required) as viable S3-compatible off-host destinations.
7. **Existing Backup Guarantees Preserved**: Preserved authenticated encryption (`age` X25519 ChaCha20-Poly1305), streaming pipeline (`pg_dump | age` with 0 plaintext on disk), SHA-256 metadata manifests (`.meta.json`), safe retention pruning rules, and environment-based secret handling.

---

## 2. Completed Checklist

- [x] **Revised ADR-012** (`docs/decisions/adr-012-database-hosting-strategy.md`):
  - Distinguished Local Development (default Compose), Initial Deployment (Neon Free Topology A), and Future Candidate (OCI Ampere A1 Topology B).
  - Maintained status as **Proposed**.
  - Documented OCI capacity as a blocking operational constraint.
  - Linked to `docs/architecture/adr-012-database-hosting-strategy.md`.
- [x] **Corrected Research & Quotas** (`docs/research/task-014-free-postgres-evaluation.md`):
  - Full Neon Free verification (100 projects, 1 GB storage, 20 GB account cap, 100 CU-hours, 5 min idle, 5 GB egress, zero charge risk).
  - Explicit workload models (Model W vs Model C).
  - Recalculated scenarios for 1, 3, 6, and 15 applications distinguishing hard limits from estimates.
  - Viable off-host backup destinations (Cloudflare R2, Backblaze B2).
- [x] **Updated Migration Plan** (`docs/operations/database-provider-migration-plan.md`):
  - Staged cutover and rollback procedures.
  - Preserved TLS certificate verification (`sslmode=verify-full`, `sslrootcert`).
  - Separation of `DATABASE_MIGRATE_URL` and `DATABASE_URL`.
  - Credential masking in logs and command lines.
  - Integrated with off-host age-encrypted backup workflows.
- [x] **Automated Local Compatibility Test Suite** (`tooling/tests/test_database_compatibility.py`):
  - 10 automated regression tests passing cleanly.
  - Validates URL parsing, TLS verification enforcement, credential masking, transaction pooler settings (`NullPool`, `prepare_threshold=None`), non-superuser migrations, least-privilege role boundaries (DML allowed, DDL forbidden), cross-database isolation (`REVOKE CONNECT FROM PUBLIC`), cross-schema isolation, and manifest credential hygiene.
- [x] **Repository Validation Pass**:
  - `python3 tooling/validate.py` passed with 0 errors.
  - 162/162 tooling tests passed.
  - 24/24 CLI tests passed.
  - 9/9 demo API tests passed.
  - Total: 195/195 tests passing.

---

## 3. Local Test Evidence

```text
============================= test session starts ==============================
platform linux -- Python 3.14.2, pytest-9.1.1, pluggy-1.6.0
rootdir: /workspaces/megalith
plugins: anyio-4.15.1
collected 10 items

tooling/tests/test_database_compatibility.py::test_external_connection_url_parsing PASSED [ 10%]
tooling/tests/test_database_compatibility.py::test_tls_configuration_enforces_certificate_verification PASSED [ 20%]
tooling/tests/test_database_compatibility.py::test_credential_hygiene_masks_passwords_in_strings_and_logs PASSED [ 30%]
tooling/tests/test_database_compatibility.py::test_alembic_migration_env_uses_null_pool PASSED [ 40%]
tooling/tests/test_database_compatibility.py::test_transaction_pooler_prepared_statements_disabled PASSED [ 50%]
tooling/tests/test_database_compatibility.py::test_no_database_credentials_in_tracked_manifests_or_infra PASSED [ 60%]
tooling/tests/test_database_compatibility.py::test_cross_schema_isolation_within_same_database PASSED [ 70%]
tooling/tests/test_database_compatibility.py::test_non_superuser_migration_execution PASSED [ 80%]
tooling/tests/test_database_compatibility.py::test_least_privilege_runtime_role_dml_allowed_ddl_forbidden PASSED [ 90%]
tooling/tests/test_database_compatibility.py::test_cross_application_isolation_enforced PASSED [100%]

============================== 10 passed in 4.39s ==============================
```

```bash
# Manifest validation
python3 tooling/validate.py -> SUCCESS (0 errors)

# Full test suites
pytest tooling/tests -> 162 passed in 7.16s
pytest platform/cli/tests/test_cli.py -> 24 passed in 2.40s
pytest apps/demo/api/tests/test_api.py -> 9 passed in 1.11s
```

---

## 4. Workload Feasibility Summary

| Scenario | Workload Model | Neon Free (Initial Candidate) | OCI Ampere A1 (Future Candidate) |
| :--- | :--- | :--- | :--- |
| **1 App** | Intermittent Web (Model W) | **Feasible & Sustainable** (135 MB / 1 GB; 15.6 CU-hrs / 100; €0/mo) | Feasible once VM capacity provisioned (€0/mo) |
| **3 Apps** | 3 × Intermittent Web | **Feasible & Sustainable** (3 dedicated projects; €0/mo) | Feasible once VM capacity provisioned (€0/mo) |
| **6 Apps** | 6 × Intermittent Web | **Feasible & Sustainable** (6 dedicated projects; €0/mo) | Feasible once VM capacity provisioned (€0/mo) |
| **15 Apps** | 15 × Intermittent Web | **Feasible & Sustainable** (15 of 100 projects; 2 GB / 20 GB cap; €0/mo) | Feasible once VM capacity provisioned (€0/mo) |
| **15 Apps** | 14 Web + 1 Continuous Worker | **Partial Failure:** 1 worker app halts at Day 16 on quota exhaustion; 14 apps continue | **Fully Feasible & Robust:** 24 GB RAM, 4 OCPUs, zero quotas |

---

## 5. Revised and Precise Task 015 Scope

Task 015 will implement external PostgreSQL support in Megalith following strict constraints:

1. **No Provider-Specific Abstractions**:
   - Do not create vendor-specific SDK wrappers (no "Neon client", no "Supabase adapter").
   - Applications consume standard relational PostgreSQL via `DATABASE_URL` and `DATABASE_MIGRATE_URL`.
2. **Preserve Local Compose as Default Development Path**:
   - `compose.yaml` remains the default local development configuration.
   - Introduce `platform/deploy/compose.managed-db.yaml` solely to disable the local Compose `postgres` container when an external database URL is configured.
3. **Preserve Security and Secret Handling**:
   - Enforce TLS certificate verification (`sslmode=verify-full`, `sslrootcert`).
   - Separate migration credentials (`DATABASE_MIGRATE_URL`) from runtime credentials (`DATABASE_URL`).
   - Prevent logging raw database URLs or embedded passwords.
4. **Preserve Reachability and Migration Checks**:
   - Update `platform/deploy/scripts/deploy.py` to perform database reachability and Alembic migration status checks directly against the configured `DATABASE_URL` / `DATABASE_MIGRATE_URL` without depending on local Docker container commands.
5. **Driver Hardening for Transaction Poolers**:
   - Configure `prepare_threshold=None` in `apps/demo/api/src/db.py` to support PgBouncer and Supavisor transaction poolers out of the box.
6. **Local-Only Simulation Testing**:
   - Validate the external database flow using a local PostgreSQL container configured to simulate an external service (separate network/port, non-superuser roles, strict TLS simulation, and transaction pooler simulation).
   - Zero external cloud resources or accounts required.

---

## 6. Execution Gate & Operator Decisions

Execution is paused at the gate. Operator review is requested on:
1. **Approval of ADR-012**: Does the revised three-tier strategy (Local Compose default -> Neon Free initial -> OCI Ampere A1 future) meet requirements?
2. **Authorization to Proceed to Task 015**: Is the localized implementation scope approved?
