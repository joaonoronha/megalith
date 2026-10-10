# Megalith Deployment Operational Runbook

This runbook describes how operators prepare, review, deploy, and verify immutable releases in the Megalith monorepo.

---

## 1. Prerequisites and Safety Invariants

Before triggering or applying any release:
1. **CI Status**: Ensure the commit has passed the required status check (`CI / required`) on GitHub Actions.
2. **Digest Immutability**: All application image references must contain cryptographic digests (`@sha256:...`). Never attempt to deploy mutable tags (`:latest`, `:main`).
3. **Approval Requirement**: Deployments targeting `production` strictly require explicit operator approval metadata embedded in the manifest.
4. **Isolated Infrastructure**: In production mode (`compose.yaml` + `compose.prod.yaml`), only Caddy binds host ports (80, 443). Application and database services remain on private bridge networks.
5. **Volume Preservation**: Never run destructive teardowns (`docker compose down -v`) against persistent state (`postgres-data`, `caddy-data`).

---

## 2. Release Lifecycle Procedures

### Step 1: Package Release (GitHub Actions)
Trigger the release packaging workflow:
1. Navigate to **Actions** -> **Release Package**.
2. Click **Run workflow**.
3. Inputs:
   - `git_sha`: The 40-character commit SHA (must have passed `CI / required`).
   - `environment`: `production` (or `staging`).
   - `release_id`: (Optional) Custom identifier like `rel-20261010-01` (defaults to `rel-<date>-<short_sha>`).
4. The workflow:
   - Validates that `CI / required` completed successfully on `git_sha`.
   - Builds multi-architecture ARM64 / AMD64 container images.
   - Pushes images to GHCR and records immutable image digests.
   - Emits a sealed `release.json` manifest uploaded as a workflow artifact.

### Step 2: Review Release Manifest
Inspect the emitted `release.json` artifact:
```json
{
  "schema_version": 1,
  "release_id": "rel-20261010-a1b2c3d",
  "git_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "environment": "production",
  "services": ["demo-api", "demo-web"],
  "images": {
    "demo-api": "ghcr.io/org/megalith-demo-api@sha256:d733ffb6ac425b67724c2d7278ff3384b1535af8e1102cec1f5557650b0f4911",
    "demo-web": "ghcr.io/org/megalith-demo-web@sha256:8cb90f5ec6bf7dd76a03eafaf6e6d21c5660e4fcec1c2268fd87c0d42984520a"
  },
  "migrations": [
    {
      "service": "demo-api",
      "applied": true,
      "command": "alembic upgrade head",
      "backward_compatible": true
    }
  ]
}
```
Verify:
- Commit SHA corresponds to approved changes.
- Changed services match expectations.
- Any declared migrations are verified backward-compatible.

### Step 3: Trigger Controlled Deployment
Trigger the deployment workflow or execute on the host:
- In GitHub Actions: Navigate to **Actions** -> **Apply Deployment**.
  - Enter `release_id` (e.g., `rel-20261010-a1b2c3d`).
  - Enter `confirm_release_id` with the exact same ID (dual confirmation gate).
  - Workflow seals human authorization and executes host deployment.
- Or on the host directly:
  ```bash
  python3 platform/deploy/scripts/deploy.py apply /path/to/release.json
  ```

---

## 3. Host-Side Deployment Mechanics

The deployment engine (`platform/deploy/scripts/deploy.py`) executes the following automated pipeline:

1. **Concurrency Lock**:
   - Acquires non-blocking `fcntl.flock` on `/var/lib/megalith/deploy.lock`.
   - Prevents overlapping deployment commands.
2. **Selective Diffing**:
   - Compares release images against active state in `/var/lib/megalith/state.json`.
   - Determines changed services (`demo-api`, `demo-web`).
   - If only `demo-web` changed, `postgres`, `demo-api`, and `caddy` containers are preserved without disruption.
3. **Database Migrations**:
   - If migrations are declared, starts `postgres` and waits for healthy status.
   - Runs `demo-migrate` one-shot container with dedicated `role_demo_migrate` credentials.
4. **Selective Service Recreation**:
   - Recreates only the changed containers with `docker compose up -d --no-deps <service>`.
5. **Health Verification**:
   - Probes container status for healthy state.
   - Queries application API readiness probe (`/ready`) verifying database connectivity.
6. **State Persistence**:
   - Updates `/var/lib/megalith/state.json` recording successful release and history.

---

## 4. Operational Commands Reference

```bash
# Validate release manifest schema and digests
python3 platform/deploy/scripts/deploy.py validate release.json

# Check current running release and deployment history
python3 platform/deploy/scripts/deploy.py status

# Run preflight Compose syntax and image check
python3 platform/deploy/scripts/deploy.py prepare release.json

# Apply release
python3 platform/deploy/scripts/deploy.py apply release.json

# Run health probes against active stack
python3 platform/deploy/scripts/deploy.py check

# Manual rollback to last-known-good release
python3 platform/deploy/scripts/deploy.py rollback
```
