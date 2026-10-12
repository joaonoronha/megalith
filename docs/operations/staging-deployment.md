# Megalith Staging Deployment Runbook

**Document Version:** 1.0.0  
**Status:** Canonical Platform Operations Guide  
**Task Reference:** Megalith Task 018 — Reproducible Staging Deployment Workflow  
**Governance Classification:** `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED` (ADR-013)  

---

## 1. Overview & Architecture

Megalith provides a reproducible, secure, cost-aware staging deployment workflow designed to validate system behavior and edge routing before deploying to production. Staging workflows are executed offline and locally by default, allowing engineers and autonomous coding agents (Agy) to perform comprehensive preflight sanity checks and dry-run inspections without incurring cloud costs or provisioning unapproved infrastructure.

```
+-------------------------------------------------------------------------------------------------------+
|                                    MEGALITH STAGING WORKFLOW MODES                                    |
+------------------------------------+----------------------------------+-------------------------------+
| Mode                               | Target Shape / Profile           | Persistence & Database        |
+------------------------------------+----------------------------------+-------------------------------+
| local                              | Local Docker Compose             | PostgreSQL 16 (Containerized) |
| gcp-micro                          | GCP e2-micro (1 GB RAM, AMD64)   | Strictly Stateless (No DB)    |
| external-db                        | Docker Compose + External PG16   | Provider-Neutral (Direct+Pool)|
| oci                                | OCI Ampere A1 (ARM64)            | Self-Hosted PG16 on VM        |
+------------------------------------+----------------------------------+-------------------------------+
```

---

## 2. Supported Staging Deployment Modes

### 2.1 Local Mode (`local`)
* **Use Case:** Local integration testing, smoke tests, and offline regression verification.
* **Stack:** Full Megalith application stack running in Docker Compose (`platform/deploy/compose.yaml`):
  - `postgres` (PostgreSQL 16 Alpine baseline, `postgres:16-alpine@sha256:...`)
  - `demo-migrate` (Alembic schema migrations applied automatically)
  - `demo-api` (FastAPI backend service)
  - `demo-web` (Nginx static frontend)
  - `caddy` (Edge reverse proxy on loopback)
* **Cost:** **€0/month guaranteed** (runs 100% on local workstation / Codespace).

### 2.2 GCP Micro Staging (`gcp-micro`)
* **Use Case:** Remote host bootstrap, network ingress, and edge routing validation on Google Cloud Compute Engine.
* **Stack:** Minimal stateless smoke profile (`platform/deploy/compose.micro.yaml` + `platform/deploy/caddy/Caddyfile.micro`):
  - `caddy` (HTTP port 80 / health endpoint `/health`)
  - `demo-web` (Web UI container)
* **Stateless Enforcement:** **Zero local PostgreSQL containers, zero persistent database volumes, and zero Alembic migrations.**
* **Host Sizing:** One disposable `e2-micro` VM (2 vCPUs burstable, 1 GB RAM, AMD64).
* **Memory Constraints:**
  - Linux OS & Docker baseline consume ~380 MiB RAM.
  - Micro stack (`caddy` + `demo-web`) consumes ~80 MiB RAM.
  - Available free memory buffer: ~540 MiB.
  - **Running PostgreSQL or heavy Python runtimes on `e2-micro` triggers Linux OOM killer.**

### 2.3 External Database Staging (`external-db`)
* **Use Case:** Validating application interaction with external managed PostgreSQL (e.g., Neon Free, Supabase, or external PG 16 instances) per ADR-012.
* **Stack:** `compose.yaml` overlaid with `compose.external-db.yaml`:
  - Disables the local `postgres` container via Compose profile `external-mode-disabled`.
  - Removes local DB dependencies from `demo-migrate` and `demo-api`.
  - Injects two distinct external connection strings:
    * `DATABASE_MIGRATE_URL`: Direct DDL connection string for `demo-migrate` (bypasses transaction pooler).
    * `DATABASE_URL`: Pooled DML connection string for `demo-api` (least-privilege runtime role).
* **Security & TLS Requirements:**
  - Mandatory `sslmode=verify-full`. Connections using `sslmode=disable`, `sslmode=require`, or `sslmode=prefer` are strictly rejected.
  - Mandatory credential masking: Passwords are redacted with `***` across all logs, diagnostics, and CLI output.

### 2.4 Future OCI Mode (`oci`)
* **Use Case:** Target production shape validation for Oracle Cloud Infrastructure (OCI) Ampere A1 Always Free VM.
* **Stack:** `compose.yaml` overlaid with `compose.prod.yaml`.
* **Architecture:** ARM64 (`aarch64`).
* **Operational Note:** Capacity constraints in certain OCI regions may require queuing or fallback to alternative staging modes.

---

## 3. Platform CLI Commands

Megalith platform tooling provides dedicated staging CLI commands via `megalith staging` and the standalone `platform/deploy/scripts/staging.py` engine.

### 3.1 Staging Preflight (`megalith staging preflight`)

Executes comprehensive, non-mutating validation across configurations, CPU architecture, ingress networking, external database readiness, migrations, and FinOps billing exposure:

```bash
# Validate local staging configuration
megalith staging preflight --mode local

# Validate GCP micro staging configuration
megalith staging preflight --mode gcp-micro

# Validate external database staging configuration with TLS verify-full
megalith staging preflight --mode external-db \
  --database-url "postgresql+psycopg://role_demo_app:secret@ep-pooler.example.com:5432/db_demo?sslmode=verify-full" \
  --database-migrate-url "postgresql+psycopg://role_demo_migrate:secret@ep-direct.example.com:5432/db_demo?sslmode=verify-full"

# Output machine-readable JSON for CI/CD automation
megalith staging preflight --mode local --json
```

### 3.2 Staging Dry-Run (`megalith staging dry-run`)

Performs an offline simulation of the staging deployment workflow without provisioning cloud resources or mutating databases:
- Renders and validates the effective merged Docker Compose YAML.
- Executes `terraform validate` against `platform/infra/gcp/` without contacting cloud APIs.
- Emits a step-by-step preview of deployment commands with **all passwords and tokens masked**.
- Generates a complete resource inventory and clean teardown / cleanup plan.

```bash
# Offline dry-run for GCP micro staging
megalith staging dry-run --mode gcp-micro

# Offline dry-run for external database staging
megalith staging dry-run --mode external-db --database-url "..." --database-migrate-url "..."

# Dry-run with machine-readable JSON output
megalith staging dry-run --mode gcp-micro --json
```

---

## 4. FinOps Cost Exposure & €0/Month Design Target

Megalith strictly adheres to a **€0/month recurring cloud cost target**. Staging deployments introduce specific billing exposure risks that must be actively managed:

### 4.1 Google Cloud Public IPv4 Billing Risk
> [!WARNING]
> Google Cloud charges approximately **$0.005/hour (~$3.60/month)** for all public IPv4 addresses (both ephemeral and static, whether attached to running instances or idle).
> 
> To maintain the €0/month design target:
> 1. GCP staging deployments must be **time-bounded** (maximum 24 hours, recommended < 2 hours).
> 2. The `e2-micro` instance must be destroyed immediately upon completion of verification tests.
> 3. Verify that zero orphaned public IPs remain after teardown.

### 4.2 Storage and Egress Constraints
* **GCP Persistent Disks:** Google Cloud Always Free includes 30 GB of `pd-standard` disk per month across US regions (`us-central1`, `us-west1`, `us-east1`). Retaining unattached disks after VM deletion consumes quota and incurs charges.
* **Network Egress:** Always Free includes 1 GB outbound egress per month from North America to all destination regions. Staging tests should minimize external payload transfers.

### 4.3 External Database Free-Tier Boundaries
When utilizing external managed PostgreSQL (e.g., Neon Free):
* **Compute Allowance:** 100 Compute Unit (CU) hours per month.
* **Storage Limit:** 1 GB per project (20 GB account ceiling across up to 100 projects).
* **Auto-Suspend:** Set compute endpoint auto-suspend to 5 or 20 minutes of inactivity. Continuous background polling or unmonitored daemons will rapidly exhaust free CU-hours.

---

## 5. Cost Checklist Before Any Live Cloud Staging

Before initiating any live cloud staging operation, the operator must complete this checklist:

| Check | Item | Verification Method |
|:---:|:---|:---|
| [ ] | **Isolated Project** | Dedicated disposable staging project (e.g., `megalith-staging-xxxx`). |
| [ ] | **Preflight Clean** | `megalith staging preflight --mode gcp-micro` exits with code 0. |
| [ ] | **Dry-Run Clean** | `megalith staging dry-run --mode gcp-micro` generates valid cleanup plan. |
| [ ] | **Allowed Region** | Terraform variables specify `us-central1`, `us-west1`, or `us-east1`. |
| [ ] | **Machine Shape** | Strictly `e2-micro` (2 vCPUs burstable, 1 GB RAM). |
| [ ] | **Disk Sizing** | Strictly 30 GB `pd-standard` (auto-delete enabled). |
| [ ] | **Teardown Timer** | Operator schedules immediate teardown via calendar or alarm. |
| [ ] | **Operator Approval** | Live provisioning authorized per ADR-013 with explicit named scope. |

---

## 6. Teardown & Clean Cleanup Procedures

### 6.1 GCP Micro Staging Teardown
```bash
# 1. Stop and remove on-host containers
ssh ubuntu@<VM_PUBLIC_IP> "docker compose -f /opt/megalith/platform/deploy/compose.micro.yaml down -v"

# 2. Destroy cloud infrastructure (terminates VM, releases public IPv4)
cd platform/infra/gcp
terraform destroy -auto-approve

# 3. Verify zero resources remain in state
terraform show
```

### 6.2 External Database Staging Teardown
```bash
# 1. Stop local application containers and purge networks/volumes
docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.external-db.yaml down -v

# 2. Revert migration schema changes on external database (if needed)
DATABASE_MIGRATE_URL="<DIRECT_URL>" docker compose run --rm demo-migrate alembic downgrade base

# 3. Drop test database or delete disposable Neon project
```

### 6.3 Local Staging Teardown
```bash
# Clean up all local containers, networks, and persistent data volumes
docker compose -f platform/deploy/compose.yaml down -v
```

---

## 7. Operational Authority & ADR-013 Governance

In accordance with ADR-013:
* **Preflight & Dry-Run Inspections (`LOCAL_READ`):** Autonomous by Agy. No human authorization required.
* **Local Test Executions (`LOCAL_MUTATION`):** Autonomous by Agy within isolated test environments.
* **Live Cloud Deployments / Mutations (`EXTERNAL_MUTATION`):** Strictly require explicit operator authorization naming the target provider, resource, environment, and actions before execution.
