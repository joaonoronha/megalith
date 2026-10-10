# Megalith Safe Rollback Operational Runbook

This runbook defines the rollback mechanisms, automated failure recovery, manual intervention procedures, and database backward-compatibility rules in Megalith.

---

## 1. Rollback Architecture & Triggers

Megalith implements two layers of rollback:
1. **Automated Rollback (Deployment-Time Failure)**:
   - When `platform/deploy/scripts/deploy.py apply` executes, it verifies container health and queries the application API readiness probe (`/ready`).
   - If health probes fail within the timeout deadline, the deployment engine automatically triggers safe rollback to restore the pre-deploy release.
2. **Manual Rollback (Operator-Initiated)**:
   - If an operational defect is discovered after a successful deployment, operators can invoke:
     ```bash
     python3 platform/deploy/scripts/deploy.py rollback
     ```
   - This rolls back running containers to `previous_release` recorded in `/var/lib/megalith/state.json`.

---

## 2. Invariants & Migration Safety Boundary

> [!CAUTION]
> **Database Schema Incompatibility Blocks Automated Rollback**
> If a release applied a database migration declared as **non-backward-compatible** (`backward_compatible: false`), automated container rollback is strictly blocked.
> Rolling back application containers to an older codebase that does not understand the new database schema risks silent data corruption or catastrophic crashes.
> In such cases, operator intervention and point-in-time database restoration are required.

### Database Expansion/Contract Pattern
To ensure safe zero-downtime rollbacks, all schema migrations in Megalith must adhere to the **expand/contract** pattern:
1. **Phase 1 (Expand)**: Add new columns, nullable fields, or new tables. Old application code continues to function without error. `backward_compatible: true`.
2. **Phase 2 (Deploy new app)**: New application code is deployed and writes to both old and new fields.
3. **Phase 3 (Contract)**: After verification and retention window, remove old deprecated columns or constraints in a separate migration.

---

## 3. Automated Rollback Flow

When a deployment failure occurs:
1. The failure exception is captured by `deploy.py`.
2. The deployment state marks the release as failed in `/var/lib/megalith/state.json`.
3. The engine retrieves the pre-deploy release manifest.
4. Checks all applied migrations in the failing or current release:
   - If any migration has `backward_compatible == False`, automated rollback aborts with a `DeploymentExecutionError` and logs a critical alert requesting manual database recovery.
5. Re-applies the previous release images via Docker Compose (`docker compose up -d`).
6. Executes post-rollback health checks (`/health` and `/ready`).
7. Updates state to `rolled_back` and records the audit event.

---

## 4. Manual Rollback Procedure

### Step 1: Check Current State
```bash
python3 platform/deploy/scripts/deploy.py status
```
Inspect `current_release` and `previous_release`. Verify that `previous_release` contains the desired release target.

### Step 2: Execute Rollback
```bash
python3 platform/deploy/scripts/deploy.py rollback
```
The command acquires the host deployment lock, applies the previous release images, verifies health probes, and marks the state.

### Step 3: Verify Application Health
```bash
python3 platform/deploy/scripts/deploy.py check
```
Verify:
- All containers are running and healthy.
- HTTP `/ready` endpoint returns `{"status": "ready"}`.
- Application traffic flows normally through Caddy.

---

## 5. Disaster Recovery: Database Restore Integration

If a non-backward-compatible migration was applied and corrupted data, or if an emergency point-in-time recovery is needed:
1. Stop application containers:
   ```bash
   docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.prod.yaml stop demo-api demo-web
   ```
2. Restore database from verified physical or logical backup following [`docs/operations/backup-restore.md`](file:///workspaces/megalith/docs/operations/backup-restore.md):
   ```bash
   # Restore PostgreSQL database dump
   docker compose -f platform/deploy/compose.yaml exec -T postgres dropdb -U postgres db_demo
   docker compose -f platform/deploy/compose.yaml exec -T postgres createdb -U postgres -O role_demo_migrate db_demo
   cat /var/backups/megalith/backup_demo.sql | docker compose -f platform/deploy/compose.yaml exec -T postgres psql -U postgres -d db_demo
   ```
3. Re-apply the previous release manifest:
   ```bash
   python3 platform/deploy/scripts/deploy.py apply /var/lib/megalith/releases/previous_release.json
   ```
