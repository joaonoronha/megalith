# Megalith Staging Deployment Runbook

**Document Version:** 1.1.0  
**Status:** Canonical Platform Operations Guide  
**Task Reference:** Megalith Task 018 / 018.1 — Reproducible Staging Deployment Workflow  
**Governance Classification:** `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED` (ADR-013)  

---

## 1. Overview & Architecture

Megalith provides a reproducible, secure, cost-aware staging deployment workflow designed to validate system behavior, container orchestration, and edge ingress routing before deploying to production. Staging workflows are executed offline and locally by default, allowing engineers and autonomous coding agents (Agy) to perform comprehensive preflight sanity checks and dry-run inspections without incurring cloud costs or provisioning unapproved infrastructure.

```
+-------------------------------------------------------------------------------------------------------------------+
|                                          MEGALITH STAGING WORKFLOW MODES                                          |
+--------------------+----------------------------------+------------------------------+----------------------------+
| Mode               | Target Shape / Profile           | Persistence & Database       | Compose Project Name       |
+--------------------+----------------------------------+------------------------------+----------------------------+
| local              | Local Docker Compose             | PostgreSQL 16 (Container)    | megalith                   |
| gcp-micro          | GCP e2-micro (1 GB RAM, AMD64)   | Strictly Stateless (No DB)   | megalith-micro             |
| external-db        | Docker Compose + External PG16   | Provider-Neutral (Direct+Pool| megalith-staging           |
| oci                | OCI Ampere A1 (ARM64)            | Self-Hosted PG16 on VM       | megalith-prod              |
+--------------------+----------------------------------+------------------------------+----------------------------+
```

---

## 2. Verification Evidence Classifications

All checks and preflight reports emit explicit evidence classification badges to prevent conflating local file existence with authoritative remote cloud verification:

* `[OFFLINE_VALIDATED]`: Local configuration files, Compose rendering, Terraform syntax validation, and synthetic unit tests have passed cleanly offline. No remote networks or cloud APIs were contacted.
* `[LIVE_VERIFIED]`: Actual live cloud resource inventory, remote network connectivity, or provider account status confirmed via an explicitly authorized read-only operation.
* `[NOT_VERIFIED]`: Evidence cannot be confirmed without live remote provider access.

> [!IMPORTANT]
> **State File Limitation**: An empty or clean local `platform/infra/gcp/terraform.tfstate` is **NOT** authoritative proof that the remote cloud provider account contains zero resources or zero active billing items. Similarly, a local dry-run does not query or verify the live cloud billing balance. Live verification requires separate, explicitly authorized read-only queries.

---

## 3. Supported Staging Deployment Modes

### 3.1 Local Mode (`local`)
* **Use Case:** Local integration testing, smoke tests, and offline regression verification.
* **Compose Project Name:** `-p megalith`
* **Stack:** Full Megalith application stack running in Docker Compose (`platform/deploy/compose.yaml`):
  - `postgres` (PostgreSQL 16 Alpine baseline, pinned digest)
  - `demo-migrate` (Alembic schema migrations applied automatically)
  - `demo-api` (FastAPI backend service)
  - `demo-web` (Nginx static frontend)
  - `caddy` (Edge reverse proxy on loopback)
* **Cost:** **€0/month guaranteed** (runs 100% on local workstation / Codespace).
* **Data Persistence:** Persistent volume `postgres-data` stores database tables and is **preserved by default** across routine stops and restarts.

### 3.2 GCP Micro Staging (`gcp-micro`)
* **Use Case:** Remote host bootstrap, network ingress, and edge routing validation on Google Cloud Compute Engine.
* **Compose Project Name:** `-p megalith-micro`
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

### 3.3 External Database Staging (`external-db`)
* **Use Case:** Validating application interaction with external managed PostgreSQL (e.g., Neon Free, Supabase, or external PG 16 instances) per ADR-012.
* **Compose Project Name:** `-p megalith-staging`
* **Stack:** `compose.yaml` overlaid with `compose.external-db.yaml`:
  - Disables the local `postgres` container via Compose profile `external-mode-disabled`.
  - Removes local DB dependencies from `demo-migrate` and `demo-api`.
  - Injects two distinct external connection strings:
    * `DATABASE_MIGRATE_URL`: Direct DDL connection string for `demo-migrate` (bypasses transaction pooler).
    * `DATABASE_URL`: Pooled DML connection string for `demo-api` (least-privilege runtime role).
* **Security & TLS Requirements:**
  - Mandatory `sslmode=verify-full`. Connections using `sslmode=disable`, `sslmode=require`, or `sslmode=prefer` are strictly rejected.
  - Mandatory credential masking: Passwords and sensitive query parameters are redacted with `***` across all logs, diagnostics, and CLI output.
* **Project Status Notice:** Megalith currently maintains **zero active Neon projects** (the disposable proof-of-concept project was deleted in Task 016D). All external DB architectures remain provider-neutral and require explicit operator-supplied connection strings.

### 3.4 Future OCI Mode (`oci`)
* **Use Case:** Target production shape validation for Oracle Cloud Infrastructure (OCI) Ampere A1 Always Free VM.
* **Compose Project Name:** `-p megalith-prod`
* **Stack:** `compose.yaml` overlaid with `compose.prod.yaml`.
* **Architecture:** ARM64 (`aarch64`).
* **Operational Note:** Capacity constraints in certain OCI regions may require queuing or fallback to alternative staging modes.

---

## 4. Platform CLI Commands

Megalith platform tooling provides dedicated staging CLI commands via `megalith staging` and the standalone `platform/deploy/scripts/staging.py` engine.

### 4.1 Staging Preflight (`megalith staging preflight`)

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

### 4.2 Staging Dry-Run (`megalith staging dry-run`)

Performs an offline simulation of the staging deployment workflow without provisioning cloud resources or mutating databases:
- Renders and validates the effective merged Docker Compose YAML.
- Validates Terraform configuration against `platform/infra/gcp/` safely handling offline environments where provider plugins are uninitialized.
- Emits a step-by-step preview of deployment commands with **all passwords and tokens masked** and **explicit Compose project names**.
- Generates a resource inventory distinguishing ephemeral containers from persistent user data.
- Generates a **non-destructive cleanup plan** by default.

```bash
# Offline dry-run for GCP micro staging
megalith staging dry-run --mode gcp-micro

# Offline dry-run for external database staging
megalith staging dry-run --mode external-db --database-url "..." --database-migrate-url "..."

# Dry-run with machine-readable JSON output
megalith staging dry-run --mode gcp-micro --json
```

---

## 5. FinOps Cost Exposure & Accurate Provider References

Megalith strictly adheres to a **€0/month recurring cloud cost target**. Staging deployments introduce specific billing exposure risks that must be actively managed:

### 5.1 Google Cloud Public IPv4 Billing Risk & Free Tier Limits
> [!WARNING]
> Google Cloud charges approximately **$0.005/hour (~$3.60-$3.72/month)** for all public IPv4 addresses (both ephemeral and static, whether attached to running instances or idle).
> *(Source: Google Cloud IP address pricing documentation, effective Feb 1, 2024: https://cloud.google.com/vpc/docs/ip-address-pricing)*
>
> A Google Cloud VM staging environment **never has a guaranteed €0 lifetime cost** if it is assigned an external public IPv4 address.

To mitigate this billing exposure:
1. **Time-Bounding**: GCP staging deployments must be strictly time-bounded (maximum 24 hours, recommended < 2 hours).
2. **Immediate Destruction**: The `e2-micro` instance must be destroyed immediately upon completion of verification tests.
3. **Region Eligibility**: The Compute Engine Always Free tier covers 1 `e2-micro` instance (744 hours/month) only in specific US regions:
   - `us-central1` (Iowa)
   - `us-west1` (Oregon)
   - `us-east1` (South Carolina)
4. **Persistent Disk Retention**: Always Free includes 30 GB standard persistent disk (`pd-standard`) per month in eligible US regions. Retaining unattached disks after VM deletion incurs ~$0.040/GB/month. Disks must be configured with `auto_delete = true` in Terraform.
   *(Source: Google Cloud Compute Engine Disk Pricing: https://cloud.google.com/compute/all-pricing#disk)*
5. **Egress Quota**: Always Free includes 1 GB outbound internet egress per month from North America to all destination regions.

### 5.2 External Database Free-Tier Boundaries (Neon Free Tier Reference)
When utilizing external managed PostgreSQL (e.g., Neon):
* **Default Auto-Suspend**: Neon's creation default inactivity period for compute endpoints is **5 minutes** (300 seconds), not 20 minutes. Auto-suspend can be configured from 5 minutes up to 7 days, but 5 minutes is the system default.
* **Compute Allowance**: 100 Compute Unit (CU) hours per month. Background polling or unmonitored connections prevent auto-suspension and rapidly consume quota.
* **Storage Limit**: 0.5 GB to 1 GB per project (provider plan dependent; 20 GB account ceiling across up to 100 projects).
*(Source: Neon Pricing and Free Tier Documentation, Oct 2024: https://neon.tech/docs/introduction/plans)*

---

## 6. Safe Teardown & Data Preservation Rules

### 6.1 Principles of Safe Teardown
1. **Preserve Data by Default**: Routine cleanup commands must **never** delete persistent database volumes (`postgres-data`) or drop remote database tables.
2. **Explicit Project Names**: All Compose invocations must specify `-p <project_name>` (`megalith`, `megalith-micro`, `megalith-staging`, `megalith-prod`) to prevent accidental destruction of unrelated local or host stacks.
3. **Separate Authorization for Destructive Actions**: Volume purges (`down -v`), remote schema reversions (`alembic downgrade`), and cloud infrastructure destruction (`terraform destroy`) are classified as `DESTRUCTIVE` and require explicit target-specific operator authorization.
4. **No Automated Dry-Run Execution**: Dry-runs simulate commands and inventory; they never execute teardown commands automatically.

### 6.2 Local Staging Teardown
```bash
# 1. Non-destructive default: Stop local containers and networks while PRESERVING persistent volume:
docker compose -p megalith -f platform/deploy/compose.yaml down

# 2. Volume Purge [DESTRUCTIVE - Requires Explicit Operator Authorization]:
#    Permanently deletes PostgreSQL 16 database and all stored data:
docker compose -p megalith -f platform/deploy/compose.yaml down -v
```

### 6.3 External Database Staging Teardown
```bash
# 1. Non-destructive default: Stop local application services while PRESERVING external database data:
docker compose -p megalith-staging -f platform/deploy/compose.yaml -f platform/deploy/compose.external-db.yaml down

# 2. Schema Reversion [DESTRUCTIVE - Requires Target-Specific Operator Authorization]:
#    Reverts migration schema changes on external database:
DATABASE_MIGRATE_URL="<DIRECT_URL>" docker compose -p megalith-staging run --rm demo-migrate alembic downgrade -1
```

### 6.4 GCP Micro Staging Teardown
```bash
# 1. Non-destructive default: Stop stateless containers on host:
ssh ubuntu@<VM_PUBLIC_IP> "docker compose -p megalith-micro -f /opt/megalith/platform/deploy/compose.micro.yaml down"

# 2. Destroy Cloud Infrastructure [DESTRUCTIVE - Requires Explicit Operator Authorization]:
#    State backend:  platform/infra/gcp/terraform.tfstate (local)
#    Workspace:      default
#    Target project: GCP project defined by var.project_id
#    Target resources: google_compute_instance.staging_vm, google_compute_firewall.staging_ingress, etc.
cd platform/infra/gcp
terraform destroy

# 3. State inspection:
terraform show
# NOTE: Local terraform.tfstate is not authoritative proof of remote cloud account state.
```

---

## 7. Cost Checklist Before Any Live Cloud Staging

Before initiating any live cloud staging operation, the operator must complete this checklist:

| Check | Item | Verification Method |
|:---:|:---|:---|
| [ ] | **Isolated Project** | Dedicated disposable staging project (e.g., `megalith-staging-xxxx`). |
| [ ] | **Preflight Clean** | `megalith staging preflight --mode gcp-micro` exits with code 0. |
| [ ] | **Dry-Run Clean** | `megalith staging dry-run --mode gcp-micro` generates valid cleanup plan. |
| [ ] | **Allowed Region** | Terraform variables specify `us-central1`, `us-west1`, or `us-east1`. |
| [ ] | **Machine Shape** | Strictly `e2-micro` (2 vCPUs burstable, 1 GB RAM). |
| [ ] | **Disk Sizing** | Strictly 30 GB `pd-standard` (`auto_delete = true`). |
| [ ] | **IPv4 Exposure Understood** | Operator acknowledges ~$0.005/hr IPv4 charge and schedules immediate teardown. |
| [ ] | **Teardown Timer** | Operator schedules immediate teardown timer (max 24h, recommended < 2h). |
| [ ] | **Operator Approval** | Live provisioning authorized per ADR-013 with explicit named scope. |

---

## 8. Operational Authority & ADR-013 Governance

In accordance with ADR-013 (`COOPERATIVELY ENFORCED, OPERATOR-REVIEWED`):
* **Autonomous Operations by Agent (`LOCAL_READ`, `LOCAL_MUTATION`)**:
  - Preflight checks, dry-run inspections, manifest validation, and local test execution.
  - Modifying repository code, preparing git branches and pull requests.
  - Creating and validating local approval files as cooperative workflow checkpoints.
* **Gated Operations Requiring Explicit Operator Authorization (`EXTERNAL_MUTATION`, `DESTRUCTIVE`)**:
  - Live cloud provisioning (`terraform apply`) or teardown (`terraform destroy`).
  - Connecting to external cloud endpoints or performing external database mutations.
  - Dropping tables, downgrading migrations, or purging Docker persistent volumes (`down -v`).
  - Cloud billing, IAM, or subscription modifications.
* **Change Control Boundaries**:
  - GitHub Pull Request review is the primary human change control for repository modifications.
  - PR approval alone does **not** authorize executing live cloud operations unless explicitly stated.
  - An interactive question or dry-run inspection does **not** constitute operational authorization.
