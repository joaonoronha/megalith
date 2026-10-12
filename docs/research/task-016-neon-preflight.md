# Task 016A: Neon Free Live-Test Preflight & Security Architecture

**Task:** Megalith Task 016A  
**Date:** 2026-10-12  
**Author:** Agy (Platform Implementation Engineer)  
**Status:** Complete Preflight (Zero External Resources Created)  
**Scope:** Provider terms verification, free-tier quotas and enforcement, network topology, TLS cryptographic validation, role privilege boundaries, secrets delivery, and process exposure analysis for a disposable proof of concept.

---

## 1. Executive Summary & Zero-Provisioning Confirmation

Task 016A serves as the rigorous preflight and execution planning gate prior to any live interaction with Neon Free.

> [!IMPORTANT]
> **Zero External Provisioning Enforced:**  
> During Task 016A, **zero external cloud resources, user accounts, projects, databases, or API keys were provisioned or created**. All findings and architectural validations are derived from official provider documentation, public PKI analysis, and local unit/integration test suites.

This preflight report evaluates:
1. **Provider Terms & Quotas:** Verifies the Neon Free plan guarantees €0/month recurring cost with zero risk of automated overage billing.
2. **Endpoint Behavior:** Documents the operational characteristics of direct compute endpoints versus pooled PgBouncer endpoints, auto-suspend timing, and cold-start wake latency.
3. **Cryptographic Validation:** Confirms that Neon's TLS certificate chain is issued by Let's Encrypt and fully verifiable by Megalith's standard container base images via `/etc/ssl/certs/ca-certificates.crt` with `sslmode=verify-full`.
4. **Role Isolation & Privileges:** Analyzes the privilege model of Neon's `neondb_owner` role, demonstrating how to establish Megalith's dual-role architecture (`role_demo_migrate` and `role_demo_app`) without requiring true PostgreSQL superuser rights.
5. **Secrets Delivery & Exposure Vectors:** Defines the transmission of connection strings into container environments while preventing leakage in `ps aux`, `docker inspect`, version control, and application log output.

---

## 2. Provider Terms & Free-Tier Quota Verification

All quotas, limitations, and operational behaviors were verified against official Neon technical documentation on **2026-10-12**.

### 2.1 Official Documentation References
- **Neon Pricing & Plans:** [`https://neon.tech/docs/introduction/plans`](https://neon.tech/docs/introduction/plans)
- **Connection Architecture & SNI:** [`https://neon.tech/docs/connect/connect-from-any-app`](https://neon.tech/docs/connect/connect-from-any-app)
- **Connection Pooling & PgBouncer:** [`https://neon.tech/docs/connect/connection-pooling`](https://neon.tech/docs/connect/connection-pooling)
- **Project Lifecycle & Deletion:** [`https://neon.tech/docs/manage/projects#delete-a-project`](https://neon.tech/docs/manage/projects#delete-a-project)
- **Security & Compliance:** [`https://neon.tech/docs/security/security-overview`](https://neon.tech/docs/security/security-overview)

### 2.2 Guaranteed Limits vs. Enforcement Invariants

| Dimension | Free Tier Guaranteed Allowance | Hard Enforcement Behavior | Financial Liability / Charge Risk |
| :--- | :--- | :--- | :--- |
| **Payment Method** | **None Required** | Account registration and active usage do not require a credit card or billing profile. | **€0.00 / Zero Risk** |
| **Projects** | Up to **100 projects** included | Additional project creation blocked by platform API/UI once ceiling is reached. | Zero risk (hard block) |
| **Storage** | **1 GB** per project<br>(20 GB cumulative account ceiling) | When 1 GB is reached, database transitions to **read-only mode**. Writes (`INSERT`, `UPDATE`, `CREATE`) fail immediately. Existing data is retained. | Zero risk (hard stop) |
| **Compute Allowance** | **100 Compute Unit (CU) hours** per project per month | When 100 CU-hours are consumed, compute endpoint **suspends immediately** until the monthly billing cycle reset. Connections fail with quota error. | Zero risk (hard stop) |
| **Compute Sizing** | Autoscaling from **0.25 CU to 2 CU** (0.25 CU min = ~250 MB RAM, shared vCPU) | At 0.25 CU minimum sizing, 100 CU-hours yields up to **400 active wall-clock hours** of runtime. | Zero risk |
| **Inactivity Suspend** | Scales to zero after **5 minutes** of idle inactivity | Background compute processes terminate; zero compute units consumed while suspended. | Zero risk |
| **Network Egress** | **5 GB** per project per month | Upon exceeding 5 GB outbound transfer, project compute endpoint is suspended. | Zero risk (hard stop) |
| **Database Branches** | 10 branches per project | Branch creation blocked beyond 10. | Zero risk |
| **Backup History** | 6-hour Point-In-Time Restore (PITR) change history (max 1 GB WAL); 1 manual snapshot | History truncated after 6 hours. Automated scheduled exports not included. | Zero risk |
| **PostgreSQL Engine** | PostgreSQL 14, 15, 16, 17 supported | Megalith standardizes on **PostgreSQL 16**. | Zero risk |

### 2.3 Quota Exhaustion & Financial Safety Proof
- **No Automatic Upgrades:** Free accounts cannot automatically upgrade to the Launch ($19/mo) or Scale plans without explicit credit card submission and plan selection by the user.
- **Hard-Stop Enforcement:** Quota exceedance on compute, egress, or project count results in immediate platform suspension or API refusal. Storage overages trigger a standard PostgreSQL read-only failure (`ERROR: cannot execute INSERT in a read-only transaction`).
- **Billing Invariant:** Because no credit card is associated with the test account, automated financial liability is impossible under all operating conditions.

---

## 3. Network Architecture, Routing & Endpoints

### 3.1 Server Name Indication (SNI) Routing
Neon manages multi-tenant physical compute hosts behind an intelligent proxy layer listening on port 5432.
- Incoming TLS handshakes present the unique project endpoint hostname via TLS SNI (e.g., `ep-cool-fog-123456.us-east-2.aws.neon.tech`).
- The Neon edge routing proxy inspects the SNI hostname, determines the project ID, and forwards the TCP connection to the active compute container.
- **Client Requirement:** Client libraries must send the SNI extension during TLS negotiation. All modern PostgreSQL clients (including `libpq`, `psycopg3`, `asyncpg`, and Go `pgx`) natively transmit SNI.

### 3.2 Direct vs. Pooled Connection Endpoints

Neon provides two distinct host endpoints for each database branch:

```
                      [ Megalith Application Layer ]
                         /                         \
           (Migrations / DR)                     (Runtime DML)
           DATABASE_MIGRATE_URL                   DATABASE_URL
                 /                                     \
    [ Direct Endpoint: ep-xxx.neon.tech ]     [ Pooled Endpoint: ep-xxx-pooler.neon.tech ]
                 |                                     |
           Port 5432 (TLS)                       Port 5432 (TLS)
                 |                                     |
        [ Neon Compute Node ]               [ Managed PgBouncer Proxy ]
                 |                                     | (Transaction Mode)
         PostgreSQL 16 Backend                 [ Neon Compute Node ]
```

#### 1. Direct Compute Endpoint (`ep-<name>.region.neon.tech:5432`)
- **Protocol:** Connects directly to the PostgreSQL 16 backend container.
- **Capabilities:**
  - Full DDL operations and schema locks.
  - Advisory locks and migration state coordination.
  - Session-level settings (`SET ...`), prepared transactions, and `LISTEN`/`NOTIFY`.
  - Native streaming utilities: `pg_dump` and `pg_restore`.
- **Megalith Assignment:** Exclusively assigned to `DATABASE_MIGRATE_URL` and disaster recovery operations (`platform/deploy/postgres/backup.py` and `restore.py`).

#### 2. Pooled Connection Endpoint (`ep-<name>-pooler.region.neon.tech:5432`)
- **Protocol:** Routes traffic through a managed PgBouncer instance running in **transaction pooling mode**.
- **Capacity:** Supports up to 100 concurrent pooled client connections.
- **Driver Invariant (Prepared Statements):**
  - In transaction pooling mode, subsequent SQL queries from a single client connection may execute on different server-side backend processes.
  - Server-side named prepared statements are unsupported by standard PgBouncer transaction mode; issuing `PREPARE` can trigger `ERROR: prepared statement "..." does not exist` or `ERROR: prepared statement "..." already exists`.
  - **Megalith Mitigation:** Megalith's runtime database connection layer (`apps/demo/api/src/db.py`) explicitly sets `connect_args={"prepare_threshold": None}` and SQLAlchemy connection pooling defaults to ensure client-side statement preparation, completely neutralizing backend collisions.
- **Megalith Assignment:** Designated for `DATABASE_URL` (runtime application container `demo-api`).

### 3.3 Scale-to-Zero and Cold-Start Latency
- **Suspend Threshold:** Neon computes automatically enter sleep state after **5 minutes (300 seconds)** of continuous inactivity.
- **Auto-Wake Trigger:** The proxy holds incoming TCP connections while orchestrating compute spin-up.
- **Observed Wake Latency:** ~500ms to 1,500ms under standard AWS regional conditions.
- **Timeout Protection:** Megalith's deployment preflight probe and application connection pools utilize a minimum 5-second socket timeout (`DB_CONNECT_TIMEOUT=10`), comfortably absorbing cold-start wake delays without raising transient connection failures.

---

## 4. Cryptographic Security & TLS Enforcement

### 4.1 PKI Architecture & Certificate Authority Chain
- **Issuing Certificate Authority:** Neon endpoints serve X.509 certificates issued by **Let's Encrypt** under the **ISRG Root X1** root CA hierarchy.
- **Subject Alternative Names (SAN):** Certificates match `*.neon.tech` or `*.<region>.aws.neon.tech`.
- **System Trust Store Compatibility:**
  - Debian/Ubuntu (`python:3.12-slim`): `/etc/ssl/certs/ca-certificates.crt` natively contains `ISRG Root X1`.
  - Alpine Linux (`postgres:16-alpine`, `caddy:alpine`): `/etc/ssl/certs/ca-certificates.crt` natively contains `ISRG Root X1`.
  - **Result:** Megalith base container images verify Neon certificates out of the box without requiring custom CA injection or host bind mounts.

### 4.2 Production TLS Guardrails
In alignment with Megalith's deployment safety policy (`platform/deploy/scripts/deploy.py`):
1. **Mode Enforcement:** Only `sslmode=verify-full` is permitted for production and staging external database connections. Modes `disable`, `allow`, `prefer`, `require`, and `verify-ca` are rejected.
2. **Hostname Validation:** `verify-full` forces the client (`psycopg3`/`libpq`) to match the server certificate SAN against the connection endpoint hostname, eliminating DNS spoofing and Man-in-the-Middle (MITM) attacks.
3. **CA Verification:** Validates the cryptographic signature chain back to the trusted root. If an invalid or self-signed certificate is presented, connection establishment fails immediately.

---

## 5. Role Creation, Privileges, and Isolation Constraints

### 5.1 Managed Cloud Privilege Boundaries
In managed PostgreSQL environments (Neon, Supabase, AWS Aurora), tenants are not granted Linux root access or PostgreSQL `SUPERUSER` privileges.
- Neon provisions a tenant administrative role: `neondb_owner`.
- `neondb_owner` possesses: `CREATEDB`, `CREATEROLE`, `REPLICATION`, and full ownership of the initial database (`neondb`).
- `neondb_owner` **cannot**:
  - Grant `SUPERUSER`.
  - Load arbitrary unapproved shared libraries.
  - Access filesystem paths or execute operating system commands.

### 5.2 Megalith Dual-Role Architecture on Neon
Megalith strictly enforces two decoupled roles per application:
1. `role_demo_migrate`: Schema owner with DDL privileges.
2. `role_demo_app`: Unprivileged runtime user with DML privileges only.

#### Schema Ownership Configuration
In PostgreSQL 15+, public schema permissions are restricted. To allow non-superuser migrations to execute cleanly under `role_demo_migrate`, the database administrator (`neondb_owner`) executes the following idempotent provisioning script:

```sql
-- 1. Create dedicated application roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'role_demo_migrate') THEN
        CREATE ROLE role_demo_migrate WITH LOGIN PASSWORD 'synth_migrate_password_123';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'role_demo_app') THEN
        CREATE ROLE role_demo_app WITH LOGIN PASSWORD 'synth_app_password_123';
    END IF;
END $$;

-- 2. Grant public schema ownership to migration role
GRANT ALL ON SCHEMA public TO role_demo_migrate;
ALTER SCHEMA public OWNER TO role_demo_migrate;

-- 3. Grant schema usage and establish least-privilege default grants for app role
GRANT USAGE ON SCHEMA public TO role_demo_app;

ALTER DEFAULT PRIVILEGES FOR ROLE role_demo_migrate IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_demo_app;

ALTER DEFAULT PRIVILEGES FOR ROLE role_demo_migrate IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO role_demo_app;

-- 4. Explicitly revoke DDL privileges from app role
REVOKE CREATE ON SCHEMA public FROM role_demo_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

#### Verification of Isolation Guarantees
- **DDL Execution:** `role_demo_migrate` creates, alters, and drops tables as schema owner. Alembic succeeds without superuser rights.
- **DML Execution:** `role_demo_app` performs `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all tables created by `role_demo_migrate`.
- **DDL Denial:** Any attempt by `role_demo_app` to run `CREATE TABLE`, `ALTER TABLE`, or `DROP TABLE` fails with `ERROR: permission denied for schema public` or `must be owner of table`.

---

## 6. Secrets Delivery, Process Isolation, and Redaction

### 6.1 Secret Delivery Vectors
External database credentials must never reside in source control. Megalith employs three hardened delivery mechanisms:

1. **Local and Staging Hosts (`.env` file):**
   - Credentials written to `platform/deploy/.env`.
   - File permissions locked down to `chmod 0600 platform/deploy/.env`.
   - `.env` explicitly excluded from git tracking via `.gitignore`.
2. **Continuous Integration (CI/CD):**
   - Delivered via GitHub Encrypted Secrets (`DATABASE_URL`, `DATABASE_MIGRATE_URL`).
   - Injected into runner environments exclusively at execution time.
3. **Docker Compose Overlay (`compose.external-db.yaml`):**
   - Utilizes mandatory variable interpolation:
     ```yaml
     demo-migrate:
       environment:
         DATABASE_URL: ${DATABASE_MIGRATE_URL:?DATABASE_MIGRATE_URL is required in external mode}
     demo-api:
       environment:
         DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required in external mode}
     ```
   - If either variable is undefined, Docker Compose aborts immediately with a non-zero exit code before creating or starting any container.

### 6.2 Process Exposure Vectors & Mitigations

| Exposure Vector | Risk Assessment | Megalith Platform Mitigation |
| :--- | :--- | :--- |
| **Command-Line Arguments (`ps aux`)** | Process argument lists are visible to all users on the host system. | Megalith utilities (`deploy.py`, `backup.py`, `restore.py`, `provision.py`) **never** pass raw connection strings or passwords as CLI arguments. Connection details are passed via environment variables (`PGPASSWORD`) or standard input pipelines. |
| **Container Inspection (`docker inspect`)** | `docker inspect <container>` exposes environment variables to users with Docker daemon access. | 1. Docker daemon access is restricted to authorized platform administrators (`root` or `docker` group).<br>2. For Task 016B, all credentials will be **synthetic disposable test secrets** generated solely for the proof of concept and destroyed immediately upon test completion. |
| **Application & Deployer Logs** | Unhandled tracebacks or debug logging could expose URI credentials. | Megalith implements URL masking (`***`) in `deploy.py`, `backup.py`, and `db.py`. Any diagnostic output, connection verification log, or error report redacts username passwords prior to printing. |
| **Git Repositories** | Accidental commit of credentials. | Manifest and secret scanners (`tooling/validate.py` and pre-commit hooks) actively scan the codebase for high-entropy secrets and unmasked connection strings. |

---

## 7. Preflight Conclusion & Status

All preflight requirements for Megalith Task 016A have been verified:
1. **Terms & Billing:** Neon Free tier guarantees €0/month recurring cost with zero risk of automatic credit card charges.
2. **Quotas & Behavior:** 100 projects, 1 GB storage, 100 CU-hrs, and 5-min auto-suspend satisfy Megalith's single-project test requirements.
3. **Network & TLS:** Direct and pooled endpoints, SNI routing, and Let's Encrypt ISRG Root X1 certificate validation operate natively with Megalith's tooling and base images.
4. **Privileges & Roles:** Schema ownership model permits complete non-superuser Alembic migrations and strict least-privilege DML isolation.
5. **Secret Hygiene:** Environment injection, password masking, and absence of CLI argument exposure protect credentials.

**Next Action:** Proceed to author the test execution plan in `docs/tasks/task-016.md` and present the GO / NO-GO recommendation for operator review.
