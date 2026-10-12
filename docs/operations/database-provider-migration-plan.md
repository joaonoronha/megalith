# Database Provider Migration and Integration Plan

**Document:** `docs/operations/database-provider-migration-plan.md`  
**Task:** Megalith Task 014 & Task 014.1  
**Date:** 2026-10-12  
**Status:** Approved Specification (Corrected)  
**Scope:** Staged migration, schema synchronization, data cutover, verification, and rollback procedures across Local Development (Compose), Initial Deployment (Neon Free), and Future Self-Hosted (OCI Ampere A1).

---

## 1. Overview and Objectives

This operational runbook governs database migration, configuration cutover, verification, and disaster recovery across Megalith's three database hosting tiers:
- **Local Development (Default):** PostgreSQL 16 containerized under Docker Compose (`compose.yaml`).
- **Initial Deployment Candidate:** External Managed PostgreSQL via Neon Free Tier (dedicated project per application under Topology A).
- **Future Self-Hosted Candidate:** PostgreSQL 16 under Docker Compose on an OCI Always Free Ampere A1 VM (Topology B), contingent on verified host capacity.

### Core Architectural Guiding Principles:
1. **Zero Data Loss**: Strict write drain prior to final data export.
2. **Deterministic Rollback**: Instant (< 2 min), zero-data-loss rollback to the source database if cutover verification fails.
3. **No Superuser Assumption**: All migration and data loading procedures operate without superuser privileges (`rolsuper=false`).
4. **Credential Isolation & Masking**: Secrets are injected strictly via runtime environment variables (`DATABASE_URL`, `DATABASE_MIGRATE_URL`). Raw connection strings and passwords are never logged, committed to git, or exposed in command-line argument lists.
5. **Relational Standard Preserved**: Universal PostgreSQL 16+ compatibility across all environments.
6. **Streaming Authenticated Encryption**: Backups are streamed directly (`pg_dump` into `age` X25519) so zero plaintext touches disk, accompanied by SHA-256 metadata manifests (`.meta.json`).

---

## 2. Pre-Migration Compatibility Checklist

Before initiating any migration or cutover, the operator must verify:

- [ ] **PostgreSQL Version Parity**: Target PostgreSQL version must be >= 16 (matches Megalith standard).
- [ ] **TLS Enforcement**: Target connection URL must specify `sslmode=verify-full` or `sslmode=require` with valid system/CA root certificates. Insecure plaintext (`sslmode=disable`) is prohibited in cloud environments.
- [ ] **Credential Separation**:
  - `DATABASE_MIGRATE_URL` must use a dedicated migration role with schema ownership or `CREATE` privileges on the application schema.
  - `DATABASE_URL` must use a dedicated runtime role limited strictly to DML (`SELECT, INSERT, UPDATE, DELETE`) on application tables and sequences.
  - Neither role requires nor should have PostgreSQL `SUPERUSER` privileges.
- [ ] **Transaction Pooler Configuration**:
  - If connecting via Neon's connection pooler endpoint (`-pooler`), verify that application database configuration sets `prepare_threshold=None` (or disables prepared statements) to prevent transaction pooling errors.
  - Verify that Alembic's `migrations/env.py` enforces `poolclass=pool.NullPool`.
- [ ] **Workload Suitability (For Neon Free Target)**:
  - Verify the application workload is intermittent or web-request-driven (Model W).
  - Confirm the application does **not** run a continuous 24/7 background worker or 1-minute polling daemon that would exhaust the 100 CU-hour monthly allowance.
- [ ] **Storage & Quota Headroom**:
  - Source data size must be < 500 MB (providing >50% headroom within Neon's 1 GB per-project limit).

---

## 3. Staged Migration Procedure

### Phase 1: Target Database and Role Preparation
1. Create the target database (e.g., in Neon console or target PostgreSQL cluster).
2. Provision dedicated migration and runtime roles with strong, randomly generated passwords.
3. Verify TLS connectivity from a secure terminal without printing passwords in logs:
   ```bash
   psql "$TARGET_MIGRATE_URL" -c "SELECT version(), current_user, current_database();"
   ```

### Phase 2: Schema Migration Dry-Run
Apply Alembic migrations directly against the target database using the dedicated migration role:
```bash
DATABASE_MIGRATE_URL="$TARGET_MIGRATE_URL" \
python3 -m alembic -c apps/<product>/api/alembic.ini upgrade head
```
Verify the migration version table:
```bash
psql "$TARGET_MIGRATE_URL" -c "SELECT version_num FROM alembic_version;"
```
*Expected Result:* The latest migration revision ID is present and matches repository state.

### Phase 3: Traffic Drain & Consistent Logical Snapshot
1. **Drain Application Traffic**:
   Temporarily stop external API writes to guarantee consistency:
   ```bash
   docker compose stop <product>-api
   ```
2. **Generate Consistent Logical Snapshot**:
   Export data from the source database using `pg_dump`:
   ```bash
   pg_dump -d "$SOURCE_MIGRATE_URL" \
     --format=custom \
     --no-owner \
     --no-privileges \
     --data-only \
     --file="/tmp/megalith_export_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Import Data into Destination**:
   Restore the data dump into the target database:
   ```bash
   pg_restore -d "$TARGET_MIGRATE_URL" \
     --no-owner \
     --no-privileges \
     --data-only \
     --disable-triggers \
     "/tmp/megalith_export_$(date +%Y%m%d_%H%M%S).dump"
   ```
   *Note: Securely wipe `/tmp/megalith_export_*.dump` immediately following restore.*

### Phase 4: Data Parity & Readiness Verification
Execute non-destructive parity checks on both source and target databases:
1. **Row Count Verification**:
   ```sql
   SELECT count(*) FROM counter;
   ```
2. **Max Sequence / ID Verification**:
   ```sql
   SELECT max(id), max(value) FROM counter;
   ```
3. **Application Readiness Probe**:
   Execute the non-mutating database readiness check using the runtime application role:
   ```bash
   DATABASE_URL="$TARGET_APP_URL" \
   python3 -c "from apps.demo.api.src.db import check_readiness; ok, msg = check_readiness(); print(ok, msg); assert ok"
   ```

### Phase 5: Application Deployment & Cutover
1. Update deployment environment secrets (`.env` or host environment):
   ```bash
   DATABASE_URL="$TARGET_APP_URL"
   DATABASE_MIGRATE_URL="$TARGET_MIGRATE_URL"
   ```
2. If cutting over to external managed PostgreSQL, apply the managed DB Compose override to run application containers without starting the local `postgres` container:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml -f compose.managed-db.yaml up -d
   ```
3. Perform end-to-end HTTP smoke verification:
   ```bash
   curl -fsS https://<domain>/api/health/ready
   curl -fsS https://<domain>/api/counter
   ```

---

## 4. Rollback and Contingency Procedure

If Phase 4 verification fails, connection timeouts occur, or latency degrades unexpectedly:

### Immediate Rollback Steps (< 2 minutes):
1. **Revert Environment Secrets**:
   Restore the original source `DATABASE_URL` and `DATABASE_MIGRATE_URL` in the deployment configuration.
2. **Re-deploy Source Application Profile**:
   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml up -d
   ```
3. **Verify Source Application Health**:
   ```bash
   curl -fsS https://<domain>/api/health/ready
   ```

---

## 5. Ongoing Durability & Off-Host Encrypted Backups

Because free-tier managed databases retain change history for only 6 hours and do not offer automated backup scheduling, Megalith mandates independent off-host backups matching [`platform/deploy/postgres/backup.py`](file:///workspaces/megalith/platform/deploy/postgres/backup.py):

### 1. Streaming Encryption Architecture
- `pg_dump` streams custom-format binary output directly into `age` authenticated encryption (ChaCha20-Poly1305 / HMAC tamper protection).
- **Zero plaintext touches disk.**
- Outputs `backup-<database>-<timestamp>.dump.age` and a companion `.meta.json` manifest recording SHA-256 checksums, encryption recipient, and byte size.

### 2. Off-Host S3-Compatible Storage Destinations
- **Cloudflare R2 (Primary):** 10 GB free permanent storage, $0.00 egress fees, 1M Class A operations/month. S3-compatible API.
- **Backblaze B2 (Alternative):** 10 GB free permanent storage, zero credit card requirement, free download egress up to 30 GB/month.
- **Retention Policy:** Retain 7 daily backups per application (consuming ~2.1 GB for 15 apps, well within the 10 GB free tier).
- **Safe Retention Rule:** Pruning is strictly blocked if a backup fails or if only one restorable backup exists.

### 3. Restore Verification Test
Every backup archive must be periodically tested by restoring into a clean local container to guarantee restorable integrity:
```bash
python3 platform/deploy/postgres/restore.py \
  --ciphertext-file "/opt/megalith/backups/${PRODUCT}_latest.dump.age" \
  --key-file "$BACKUP_AGE_KEY" \
  --database "db_restore_test"
```
