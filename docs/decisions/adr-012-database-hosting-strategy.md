# ADR-012: Database Hosting Strategy for Multi-Application Scaling

## Status
Proposed

## Context
[ADR-007](adr-007-persistence.md) established PostgreSQL 16 with per-product database and role isolation as Megalith's relational persistence standard. [ADR-005](adr-005-hosting.md) and [ADR-011](adr-011-cloud-portability.md) established OCI Always Free Ampere A1 as primary hosting and Google Cloud as secondary hosting.

As Megalith scales from a single demonstration application to 6–15 independent applications, we must decide how to host their relational databases sustainably while strictly maintaining **€0/month in recurring cloud costs**.

Key operational findings and constraints:
1. **OCI Capacity is a Blocking Operational Constraint**: While OCI Always Free provides 4 OCPUs (ARM64), 24 GB RAM, and 200 GB persistent storage, obtaining an Ampere A1 instance in many OCI regions currently fails due to persistent host capacity exhaustion (`Out of host capacity for shape VM.Standard.A1.Flex`). This is a **blocking operational reality**, not merely a theoretical risk. Consequently, self-hosted OCI cannot be assumed as the immediate deployment target.
2. **GCP `e2-micro` Memory Inadequacy**: The Google Cloud `e2-micro` VM (1 GB RAM total, ~380 MiB OS baseline) is severely memory-constrained. Running PostgreSQL alongside web applications and Caddy triggers the Linux Out-Of-Memory (OOM) killer. GCP `e2-micro` is strictly limited to stateless staging (`micro` profile) and must never host databases.
3. **Managed Free Database Capabilities**:
   - **Neon Free** allows up to 100 projects per account with 1 GB storage per project (20 GB account ceiling), 100 CU-hours/project/month, zero credit card requirement, and a hard spending stop that prevents automatic charges. It supports independent project-per-app isolation (Topology A) for small, intermittent workloads.
   - **Supabase Free** imposes a hard cap of **2 active projects** per organization and pauses databases after 7 days of inactivity without auto-wake, making Topology A impossible for 6–15 applications.
   - **Google Cloud Firestore** is a proprietary document NoSQL store incompatible with relational SQL joins, constraints, and Alembic migrations.

## Decision
We adopt a **three-tier database hosting strategy** that preserves PostgreSQL 16 as the universal relational persistence contract across all Megalith applications:

### 1. Local Development: Local PostgreSQL 16 via Docker Compose (Default Path)
- **Deployment Unit**: Standard PostgreSQL 16 runs in Docker Compose (`compose.yaml`), identical to current behavior.
- **Isolation**: Per-product logical databases (`db_<product>`) with dedicated application and migration roles.
- **Guarantee**: Local development remains 100% self-contained, offline-capable, and zero-dependency.

### 2. Initial Deployment Candidate: External Managed PostgreSQL via Neon Free (Topology A)
- **Deployment Target**: Neon Free Tier is designated as the initial deployment candidate for cloud staging and small, intermittent application workloads.
- **Tenant Isolation**: Each application is assigned a dedicated Neon project (up to 100 projects allowed per free account), providing absolute hardware, connection pool, and credential isolation.
- **Workload Boundary**: Strictly limited to bursty, intermittent, or web-request-driven workloads. Applications requiring continuous 24/7 background daemons or real-time polling cannot use Neon Free without exhausting the 100 CU-hour monthly allowance.
- **Billing Safety**: Free tier accounts operate without credit card entry; compute suspends upon CU-hour depletion and write operations fail if storage is full. Zero risk of unexpected cloud charges.
- **Off-Host Backup Destination**: Managed cloud snapshots are supplemented by automated, off-host age-encrypted logical dumps (`pg_dump` piped to `age`) exported to an independent free-tier object storage destination (**Cloudflare R2** at 10 GB free with zero egress fees, or **Backblaze B2** with 10 GB free and no credit card requirement).

### 3. Future Self-Hosted Candidate: OCI Always Free PostgreSQL (Topology B)
- **Deployment Target**: Self-hosted PostgreSQL 16 containerized under Docker Compose on an OCI Always Free Ampere A1 VM.
- **Prerequisite**: Contingent upon the operator successfully provisioning an Ampere A1 VM in an OCI region with confirmed capacity.
- **Topology**: One shared containerized PostgreSQL cluster with dedicated logical databases (`db_<product>`) and per-product roles, bound strictly to the host internal network.
- **Advantage When Available**: Unlocks 24 GB RAM, 200 GB storage, zero cold starts, and support for continuous background daemons without quotas.

### 4. Configuration and Security Contract
- **Provider-Agnostic Interface**: Applications configure database access strictly through environment variables:
  - `DATABASE_URL`: Runtime application role credentials (restricted to DML).
  - `DATABASE_MIGRATE_URL`: Migration role credentials (restricted to DDL on the application schema).
- **Transport Security**: TLS certificate verification is mandatory (`sslmode=verify-full` or `sslmode=require` with valid CA roots). Plaintext database connections (`sslmode=disable`) in production or cloud staging are prohibited.
- **Connection Pooler Safety**: Application database engines configure `prepare_threshold=None` in `connect_args` for transaction-mode poolers (PgBouncer/Supavisor), and Alembic migrations enforce `poolclass=pool.NullPool`.
- **Compose Decoupling**: A lightweight override manifest (`compose.managed-db.yaml`) allows deploying application containers without starting the local Compose `postgres` container when an external database URL is supplied.

## Consequences
- **Zero Recurring Cost**: Megalith remains strictly within free tier allowances (€0.00/month).
- **No Provider Lock-In**: Applications remain pure PostgreSQL clients with no vendor-specific SDKs or non-standard SQL dialects.
- **Operational Clarity**: Clarifies that OCI Ampere A1 is a future candidate contingent on capacity, while Neon Free provides an immediately viable path for intermittent workloads.
- **Durability Assured**: Relies on independent off-host S3-compatible encrypted backups rather than vendor-internal free-tier retention.
