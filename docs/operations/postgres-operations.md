# PostgreSQL Persistence, Isolation, and Operations Guide

This document defines the operational procedures, security model, and lifecycle management for the PostgreSQL persistence tier in Megalith.

---

## 1. Architectural Overview & Design Principles

Megalith adopts a consolidated database hosting architecture governed by **[ADR-007 (Database Isolation Model)](../decisions/ADR-007-database-isolation-model.md)** and **[ADR-010 (Operational Resilience)](../decisions/ADR-010-operational-resilience-and-disaster-recovery.md)**:

* **Consolidated Instance:** A single shared PostgreSQL 16 server is hosted in Docker Compose (`platform/deploy/compose.yaml`). This design optimizes memory and CPU resource allocation on resource-constrained platforms (such as the target OCI Always Free Ampere A1 ARM64 instance).
* **Logical Database Isolation:** Products do not share database schemas or tables. Each product is allocated a dedicated logical database (e.g., `db_demo` for `demo/api`). Cross-database queries are disallowed by PostgreSQL's architectural boundary.
* **Separation of Privileges:** Each product defines two distinct database roles:
  1. **Migration Role (`role_<product>_migrate`):** Owns the `public` schema in the product database and possesses DDL privileges to create, alter, and drop tables.
  2. **Application Role (`role_<product>_app`):** Strictly unprivileged runtime user with DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on application tables. Forbidden from DDL (`CREATE TABLE`, `DROP TABLE`), administrative actions (`CREATE ROLE`, `CREATE DATABASE`), and accessing any other product's database.
* **No Host Port Exposure:** Port `5432` is not published to the host interface. PostgreSQL is accessible exclusively across the private Docker bridge network (`demo-network`) by authorized application and migration containers.

---

## 2. Container Topology & Multi-Architecture Base

The PostgreSQL service is pinned to a multi-architecture Alpine Linux digest supporting both `linux/amd64` and `linux/arm64`:

* **Image:** `postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`
* **Volume:** `postgres-data` mounted at `/var/lib/postgresql/data` ensures data persistence across container recreations and restarts.
* **Security Controls:**
  - `security_opt: [no-new-privileges:true]`
  - `cap_drop: [ALL]`
  - Explicit capabilities granted only for PostgreSQL's internal privilege drop from root to `postgres`: `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETGID`, `SETUID`.

```
                    Host (localhost:8080)
                              |
                     [ Nginx (demo-web) ]
                              | (proxy /api/*)
                    [ FastAPI (demo-api) ]
                   User: role_demo_app (DML)
                              |
                    Private Docker Network
                              |
                 [ PostgreSQL 16 Alpine ]
                /                        \
        [ db_demo ]                [ Future DBs ]
    Owner: role_demo_migrate       Owner: role_<prod>_migrate
```

---

## 3. Credential Management & Configuration

Credentials are decoupled from source code and managed via environment variables.

### Environment Template (`platform/deploy/.env.example`)
To configure local development credentials, copy `platform/deploy/.env.example` to `platform/deploy/.env`:

```bash
cp platform/deploy/.env.example platform/deploy/.env
```

Key environment variables:
| Variable | Description | Default (Local Dev Only) |
|---|---|---|
| `POSTGRES_USER` | Cluster administrator user | `postgres` |
| `POSTGRES_PASSWORD` | Superuser administrative password | `postgres_dev_password` |
| `DEMO_DB_NAME` | Logical database name for demo product | `db_demo` |
| `DEMO_DB_MIGRATE_USER` | DDL migration role for demo product | `role_demo_migrate` |
| `DEMO_DB_MIGRATE_PASSWORD` | Password for migration role | `demo_migrate_dev_password` |
| `DEMO_DB_APP_USER` | DML runtime role for demo product | `role_demo_app` |
| `DEMO_DB_APP_PASSWORD` | Password for application runtime role | `demo_app_dev_password` |
| `DATABASE_URL` | Runtime connection string used by `demo-api` | `postgresql+psycopg://role_demo_app:...@postgres:5432/db_demo` |
| `DATABASE_MIGRATE_URL` | Migration connection string used by `demo-migrate` | `postgresql+psycopg://role_demo_migrate:...@postgres:5432/db_demo` |

> [!WARNING]
> Never commit `.env` or real production credentials to Git. Production environments inject secrets dynamically or via secure environment injection at host provisioning.

---

## 4. Database Provisioning & Initialization

### Initial Cluster Setup
When the `postgres-data` volume is initialized for the first time, PostgreSQL executes scripts located in `/docker-entrypoint-initdb.d/`:

* **`01-init-demo-db.sh`:** Idempotently creates `role_demo_migrate` and `role_demo_app`, sets up `db_demo`, grants schema ownership to `role_demo_migrate`, and configures default privileges for `role_demo_app`.

### Administrative Provisioning Script (`platform/deploy/postgres/provision.py`)
To provision or reconcile roles and databases on an already existing cluster without recreating volumes:

```bash
python3 platform/deploy/postgres/provision.py \
  --admin-user postgres \
  --admin-password "${POSTGRES_PASSWORD}" \
  --product demo \
  --db-name db_demo \
  --migrate-user role_demo_migrate \
  --migrate-password "${DEMO_DB_MIGRATE_PASSWORD}" \
  --app-user role_demo_app \
  --app-password "${DEMO_DB_APP_PASSWORD}"
```

---

## 5. Schema Migrations (Alembic)

Schema definitions and migrations are managed exclusively using Alembic within each service (e.g., `apps/demo/api`).

### Migration Principles
1. **No Runtime DDL (`create_all()` prohibited):** The application runtime does not automatically execute schema creation on startup.
2. **One-Shot Migration Container (`demo-migrate`):** In Docker Compose, the `demo-migrate` service runs `alembic upgrade head` before `demo-api` starts:
   ```yaml
   demo-api:
     depends_on:
       postgres:
         condition: service_healthy
       demo-migrate:
         condition: service_completed_successfully
   ```
3. **Local CLI Execution:**
   Migrations can be executed directly via the Megalith CLI:
   ```bash
   megalith run demo/api migrate
   ```
4. **Creating New Migrations:**
   ```bash
   cd apps/demo/api
   uv run alembic revision -m "add_new_table"
   ```

---

## 6. Application Health & Readiness Probes

Megalith separates **liveness** from **readiness** to ensure high availability and resilient operations:

* **Liveness Probe (`GET /health`):**
  - Assesses whether the process is alive and responsive.
  - Returns `{"status": "ok", "service": "demo/api"}` without querying the database.
  - Ensures container orchestrators do not restart the API container if PostgreSQL is temporarily unavailable.
* **Readiness Probe (`GET /ready`):**
  - Executes a lightweight ping (`SELECT 1`) against the PostgreSQL database.
  - Returns HTTP 200 `{"status": "ready", "service": "demo/api", "database": "connected"}` when ready to serve traffic.
  - Returns HTTP 503 `{"status": "degraded", "service": "demo/api", "database": "disconnected"}` when database connectivity is interrupted.

---

## 7. Encrypted Backup Procedures (`age` X25519)

Megalith implements authenticated, encrypted, zero-plaintext-on-disk logical backups using **`age` (X25519)** per ADR-010 and Task 010.

### Architecture & Key Management
* **Zero Plaintext Exposure:** `pg_dump -F c` streams directly through `age --recipient <KEY>` via UNIX pipe. Unencrypted database dumps are never written to disk or temporary scratch storage.
* **Metadata Manifests:** Every encrypted `.dump.age` file is accompanied by a companion `.meta.json` recording:
  - Cryptographic SHA-256 checksum of the ciphertext.
  - Byte size, timestamp, database name, and encryption recipient.
  - Live Alembic schema revision at the time of backup.
  - Off-host export status and restore-verification drill status.
* **Off-Host Export:** Backups are atomically copied to off-host storage (e.g. secondary disk or object store mount) with SHA-256 verification.
* **Separation of Keys:** The encryption public key is stored on the host; the private decryption key is maintained offline in secure secrets storage.

### Running an Encrypted Backup
```bash
python3 platform/deploy/postgres/backup.py \
  --database db_demo \
  --output-dir /var/lib/megalith/backups \
  --age-recipient "age1aj79vjswynnzp0c43qlnjcxwvr52x5pttef6sfnm6txn80t7eg0qe4pqc8" \
  --export-dest /mnt/offhost_backups \
  --container megalith-postgres-1
```

### Automated Backup via Systemd
Scheduled backups run daily via dedicated systemd units:
* Service: `/etc/systemd/system/megalith-backup.service` (runs as non-root `megalith` user)
* Timer: `/etc/systemd/system/megalith-backup.timer` (triggers daily at 02:00 UTC)

### Safe Retention Policy (`prune_backups`)
The retention engine protects against backup loss with strict fail-closed guards:
1. Retains a minimum of 7 daily backups.
2. **Never prunes** if fewer than 2 backups exist.
3. **Never prunes** the last known verified restorable backup, regardless of age.
4. **Blocks pruning** immediately if the latest backup failed, off-host export failed, or restore verification failed.
5. Dry-run mode (`--dry-run`) enables previewing candidates without mutation.

---

## 8. Recovery, Restore & Automated Drills

### Isolated Clean-Container Disaster Recovery Drill (`clean-container-drill`)
To prove full recovery following total VM loss, Megalith provides a clean-container disaster-recovery drill that launches an independent, freshly spawned PostgreSQL container:

```bash
python3 platform/deploy/postgres/restore.py clean-container-drill \
  --backup-file /var/lib/megalith/backups/backup-db_demo-20261011.dump.age \
  --identity /var/lib/megalith/keys/backup_key.txt
```
The clean-container drill:
1. Spawns an isolated PostgreSQL container (`megalith-dr-drill-<uuid>`).
2. Waits for PostgreSQL readiness via `pg_isready`.
3. Bootstraps roles and databases via `01-init-demo-db.sh`.
4. Streams ciphertext through `age -d` directly into `pg_restore` inside the clean container.
5. Queries and asserts table schemas, row counts, and exact Alembic revision.
6. Updates `.meta.json` recording `verified_restorable: true` and `drill_mode: clean_container_dr`.
7. Destroys the temporary drill container unconditionally.

### In-Server Verification Drill (`verify-drill`)
For periodic automated validation on an existing server without launching new containers:
```bash
python3 platform/deploy/postgres/restore.py verify-drill \
  --backup-file /var/lib/megalith/backups/backup-db_demo-20261011.dump.age \
  --identity /var/lib/megalith/keys/backup_key.txt \
  --container megalith-postgres-1
```

### Restoring into Production Database
To restore into an active or recovered database:
```bash
python3 platform/deploy/postgres/restore.py restore \
  --backup-file /var/lib/megalith/backups/backup-db_demo-20261011.dump.age \
  --identity-file /var/lib/megalith/keys/backup_key.txt \
  --database db_demo \
  --container megalith-postgres-1 \
  --clean
```
*Flags used: `--clean --if-exists --no-owner --no-privileges` to ensure clean restoration without role conflicts.*


---

## 9. Data Durability & Maintenance

* **Container Restart:** When the `postgres` container restarts (`docker compose restart postgres`), all data remains durable on the `postgres-data` volume.
* **Stack Teardown:** Running `docker compose down` stops and removes containers while leaving named volumes intact. Subsequent `docker compose up -d` resumes with full state intact.
* **Destructive Deletion:** To completely wipe state during development:
  ```bash
  docker compose -f platform/deploy/compose.yaml down -v
  ```
  *(Caution: Destroys all stored database data and requires re-initialization).*

---

## 10. Automated Verification

The entire persistence tier is continuously tested by `tooling/verify_postgres.py` and `tooling/tests/test_external_postgresql_integration.py`:

```bash
python3 tooling/verify_postgres.py
pytest tooling/tests/test_external_postgresql_integration.py
```

Verification covers:
1. Docker Compose configuration syntax and image builds.
2. Startup sequencing (`postgres` healthy -> `demo-migrate` successful -> `demo-api` healthy).
3. Role isolation enforcement (application role denied DDL and cross-DB access).
4. Persistent API endpoints (`GET /ready`, `GET /api/counter`, `POST /api/counter/increment`).
5. Atomic concurrency under parallel transactions.
6. Logical backup creation via `pg_dump`.
7. Isolated restore verification into `db_demo_restore_test`.
8. Data persistence across PostgreSQL container restart.
9. Data persistence across full `docker compose down` and `docker compose up -d`.

---

## 11. Provider-Neutral External PostgreSQL Integration (Task 015)

Megalith supports two mutually exclusive database deployment modes:

1. **Local Mode (Default):** Runs the containerized PostgreSQL 16 service defined in `platform/deploy/compose.yaml`. This mode requires zero external dependencies and is used for local development, CI tests, and self-hosted deployments.
2. **External Database Mode:** Connects all application services and migration jobs to an external, provider-neutral PostgreSQL 16+ endpoint (e.g., Neon Free, Supabase, RDS, or a dedicated cloud database instance).

### 11.1 Enabling External Database Mode

External mode is activated either via the deployer CLI:
```bash
python3 platform/deploy/scripts/deploy.py --database-mode external
```
or directly via Docker Compose overlay:
```bash
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.external-db.yaml \
  config
```

The overlay `platform/deploy/compose.external-db.yaml`:
- Assigns `profiles: [external-mode-disabled]` to `postgres`. The container is never created, started, or scheduled.
- Enforces `${DATABASE_MIGRATE_URL:?...}` and `${DATABASE_URL:?...}` variable interpolation. If either URL is missing, Docker Compose halts immediately with an error before scheduling or starting containers, preventing any silent default to `postgres:5432`.
- Clears dependencies on local postgres via `depends_on: !reset []` on `demo-migrate` and `depends_on: !override { demo-migrate: ... }` on `demo-api`.

### 11.2 Required Connection Strings and Role Isolation

External mode strictly requires two separate credentials provided via environment variables:

| Variable | Target Role | Privileges | Example |
|---|---|---|---|
| `DATABASE_URL` | Runtime (`role_<product>_app`) | Least-privilege DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Strictly denied DDL. | `postgresql+psycopg://app_user:pw@ep-xyz.neon.tech:5432/db_demo?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt` |
| `DATABASE_MIGRATE_URL` | Migrator (`role_<product>_migrate`) | Non-superuser DDL on application schema (`CREATE`, `ALTER`, `DROP` tables). | `postgresql+psycopg://mig_user:pw@ep-xyz.neon.tech:5432/db_demo?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt` |

> [!IMPORTANT]
> - **Distinct Role Invariant:** `DATABASE_URL` and `DATABASE_MIGRATE_URL` must specify different database usernames. Sharing credentials between runtime and migration violates least privilege and is rejected by the deployment validator.
> - **Environment Matching Invariant:** Both URLs must target the exact same host, port, and database name. Mismatches are rejected.
> - The runtime service `demo-api` **never** receives `DATABASE_MIGRATE_URL`.
> - The migration job `demo-migrate` runs as an ephemeral task and completes before `demo-api` is started.

### 11.3 TLS Certificate Verification & Production Enforcement

External database connections traversing untrusted networks must enforce full cryptographic verification:
- **Query Parameter:** `sslmode=verify-full` is strictly required in production.
- **Root Certificate:** `sslrootcert=/path/to/ca.crt` (or system trust store `/etc/ssl/certs/ca-certificates.crt`). If specified, the file must exist on disk.
- **Production Guardrail:** The deployment orchestrator (`deploy.py`), runtime application (`apps/demo/api/src/db.py`), migration runner (`env.py`), and DR tools (`backup.py`/`restore.py`) enforce the same security policy in production:
  - Any connection with `sslmode=disable`, `allow`, `prefer`, `require`, or `verify-ca` is immediately rejected.
  - Connections targeting local loopback hosts (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`) or the internal Compose service name (`postgres`) are rejected.
  - Hostname matching is strictly validated (`verify-full`), preventing MITM and certificate spoofing attacks where an untrusted server presents a cert issued to a different domain.

### 11.4 Connection Pooler and Driver Compatibility

When deploying against managed external services that utilize connection poolers (e.g., Neon PgBouncer or Supabase Supavisor in transaction pooling mode):
- Server-side prepared statement collisions are avoided by setting `prepare_threshold=None` in `connect_args` (`apps/demo/api/src/db.py`).
- Alembic migrations (`apps/demo/api/migrations/env.py`) enforce `NullPool` and `prepare_threshold=None` so migrations run without persistent connection overhead or statement caching conflicts.
- Connection timeouts default to 5 seconds and are configurable via `DB_CONNECT_TIMEOUT`.

### 11.5 External Backup and Restore

The Megalith disaster recovery utilities support direct connection URLs without container dependencies:

```bash
# Encrypted backup directly from external database
python3 platform/deploy/postgres/backup.py create \
  --url "${DATABASE_MIGRATE_URL}" \
  --recipient "${AGE_RECIPIENT}" \
  --output-dir /var/lib/megalith/backups

# Decrypt and restore directly into target database
python3 platform/deploy/postgres/restore.py restore \
  --backup-file /var/lib/megalith/backups/backup-db_demo-20261012.dump.age \
  --identity-file /var/lib/megalith/keys/backup_key.txt \
  --url "${DATABASE_MIGRATE_URL}"
```

### 11.6 Troubleshooting and Common Error Signatures

| Error Signature | Root Cause | Remediation |
|---|---|---|
| `certificate verify failed: self-signed certificate in certificate chain` | The client CA bundle does not include the signer of the database certificate, or `sslrootcert` is invalid. | Verify `sslrootcert` points to the correct CA bundle (e.g., Let's Encrypt ISRG Root X1 for Neon). |
| `permission denied for schema public` during migration | The migration role is not the owner of the `public` schema in the target database. | Execute `ALTER SCHEMA public OWNER TO role_<product>_migrate; GRANT ALL ON SCHEMA public TO role_<product>_migrate;` as database administrator. |
| `InvalidSqlStatementName` or `prepared statement "..." already exists` | Transaction pooler switched server backends between prepared statements. | Verify `prepare_threshold=None` is set in connection arguments. |
| `DeploymentExecutionError: Malformed DATABASE_URL: ...` | URL is missing host, uses an invalid scheme, or contains invalid parameters. | Ensure scheme is `postgresql+psycopg://` and host is specified. |
| Database connection timeout after 10s during preflight probe | Firewall, network egress, or invalid endpoint. | Confirm network reachability to the external database host and port without exposing secrets. |

