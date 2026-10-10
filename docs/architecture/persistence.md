# Architecture: Monorepo Database Persistence & Product Isolation

This document outlines the architectural design and threat boundaries of the shared PostgreSQL persistence foundation in Megalith.

---

## 1. Context and Strategic Requirements

Megalith is designed to host approximately 6–15 personal applications within a unified polyglot monorepo, targeting an Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 compute instance (4 OCPUs, 24 GB RAM, 200 GB storage).

Key design constraints:
1. **Host-Resource Conservation:** Running a dedicated database daemon container per product (e.g., 10 separate PostgreSQL processes) would consume substantial baseline memory and connection overhead.
2. **Product Independence:** Independent products must not share tables or access one another's schemas or data.
3. **Least Privilege Principle:** Application runtime services should possess minimal privileges required for operation (DML only, no DDL, no role/database manipulation).
4. **Resilient Migrations:** Migrations must execute deterministically during service deployment before application runtimes commence serving traffic.

---

## 2. Multi-Tier Isolation Model

In alignment with **ADR-007**, isolation is enforced across three primary boundaries:

```
+-----------------------------------------------------------------------+
| Docker Network Boundary                                               |
| (Private 'demo-network' - Port 5432 NOT exposed to host)               |
|                                                                       |
|   +---------------------------------------------------------------+   |
|   | Shared PostgreSQL Instance (postgres:16-alpine)               |   |
|   |                                                               |   |
|   |   +--------------------------+   +--------------------------+ |   |
|   |   | Database: db_demo        |   | Database: db_other       | |   |
|   |   |                          |   |                          | |   |
|   |   | Roles:                   |   | Roles:                   | |   |
|   |   | - role_demo_migrate      |   | - role_other_migrate     | |   |
|   |   |   (Owner, DDL permitted) |   |   (Owner, DDL permitted) | |   |
|   |   | - role_demo_app          |   | - role_other_app         | |   |
|   |   |   (DML only, no DDL)     |   |   (DML only, no DDL)     | |   |
|   |   |                          |   |                          | |   |
|   |   | Cross-access: FORBIDDEN  |   | Cross-access: FORBIDDEN  | |   |
|   |   +--------------------------+   +--------------------------+ |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

### 1. Network Boundary
* PostgreSQL does not publish port `5432` to the host system.
* Only containers joined to the internal bridge network (`demo-network`) can route traffic to PostgreSQL.

### 2. Database Boundary
* Each product is provisioned with a distinct logical database (e.g., `db_demo`).
* PostgreSQL strictly forbids cross-database queries or joins within standard sessions. Connecting to `db_demo` does not provide access to `db_other`.
* Permissions on other databases are explicitly revoked (`REVOKE CONNECT ON DATABASE db_other FROM role_demo_app`).

### 3. Role & Privilege Boundary
* **Superuser (`postgres`):** Reserved exclusively for cluster initialization and administrative disaster recovery. Never used by applications.
* **Migration Role (`role_<product>_migrate`):**
  - Schema owner for `public`.
  - Authorized to execute DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`).
  - Lacks superuser attributes (`rolsuper=false`).
* **Application Runtime Role (`role_<product>_app`):**
  - Granted `USAGE` on schema `public`.
  - Granted `SELECT, INSERT, UPDATE, DELETE` on application tables and `USAGE` on sequences.
  - Denied DDL privileges (`CREATE TABLE` raises `permission denied`).
  - Denied administrative privileges (`CREATE ROLE`, `CREATE DATABASE`).

---

## 3. Migration and Lifecycle Architecture

Schema changes are version-controlled and executed via Alembic:

1. **Migration Artifacts:** Reside in the product service directory (`apps/<product>/<service>/migrations`).
2. **Deterministic Sequence in Compose:**
   - The `demo-migrate` container runs `alembic upgrade head` using `DATABASE_MIGRATE_URL`.
   - The `demo-api` container depends on `demo-migrate` with `condition: service_completed_successfully`.
   - If migrations fail, `demo-api` never starts, preventing application runtimes from encountering partially migrated schemas.
3. **Idempotence:**
   Migrations maintain schema versioning in `alembic_version` and are safe to run repeatedly across container recreations.

---

## 4. Concurrency and Data Integrity

The persistence model enforces atomic updates:
* Single-row updates use atomic SQL expressions or upserts (`INSERT ... ON CONFLICT DO UPDATE SET ... RETURNING ...`).
* Connection pooling is bounded (`QueuePool` with `pool_size=5`, `max_overflow=10`, `pool_timeout=10.0`) to avoid exhausting PostgreSQL's connection budget across multiple products.

---

## 5. Backup and Recovery Model (ADR-010)

Disaster recovery is structured around logical dump artifacts:
* **Archive Format:** PostgreSQL Custom Format (`-F c`) via `pg_dump`.
* **Isolated Verification:** Recovery verification creates an isolated scratch database (e.g., `db_demo_restore_test`), applies `pg_restore`, verifies table contents, and cleans up the temporary database without impacting live production data.
* **Volume Durability:** Persistent volume `postgres-data` preserves cluster state across Docker Compose lifecycle operations (`docker compose down` and `docker compose up`).
