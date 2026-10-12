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

### Step 3: Authorize and Trigger Controlled Deployment
In Megalith (Schema v2), release manifests are immutable and cannot self-authorize. Deployment requires an authenticated operator authorization bound to the manifest's canonical SHA-256 digest:

1. **Host-Side Deployment Authorization**:
   ```bash
   python3 platform/deploy/scripts/release.py authorize \
     --manifest /path/to/release.json \
     --operator "operator-username" \
     --environment production \
     --output /var/lib/megalith/releases/auth.json
   ```

2. **Preflight Health & Resource Check**:
   Before mutation, run the non-destructive operational preflight validator:
   ```bash
   python3 platform/deploy/scripts/preflight.py \
     --compose platform/deploy/compose.yaml \
     --compose platform/deploy/compose.prod.yaml \
     --state-dir /var/lib/megalith \
     --min-disk-gb 5 \
     --min-ram-mb 1024
   ```

3. **Apply Authorized Release**:
   Apply the release by passing the verified authorization record:
   ```bash
   python3 platform/deploy/scripts/deploy.py apply \
     /path/to/release.json \
     --auth /var/lib/megalith/releases/auth.json
   ```

> [!NOTE]
> Unattended remote deployment via GitHub Actions is disabled by default until remote workflow approval can be cryptographically verified against a host-side key or OIDC token.

---

## 3. Host-Side Deployment Mechanics

The deployment engine (`platform/deploy/scripts/deploy.py`) executes the following automated pipeline:

1. **Concurrency Lock**:
   - Acquires non-blocking `fcntl.flock` on `/var/lib/megalith/deploy.lock`.
   - Prevents overlapping deployment commands.
2. **Authorization Verification**:
   - Strictly validates operator identity, target environment, and the manifest's canonical SHA-256 digest.
   - Any modification or tampering with the release manifest invalidates the authorization.
3. **Durable Transaction Tracking & Crash Safety**:
   - Persists transaction state prior to mutation using atomic writes with `os.fsync` on both file and directory.
   - Sequences through phases: `prepared` -> `migrating` -> `applying` -> `verifying` -> `succeeded`.
   - Records audit actions to `/var/lib/megalith/audit.log` (mode `0600`).
4. **Selective Diffing**:
   - Compares release images against active state in `/var/lib/megalith/state.json`.
   - Determines changed services (`demo-api`, `demo-web`).
   - If only `demo-web` changed, `postgres`, `demo-api`, and `caddy` containers are preserved without disruption.
5. **Database Migrations**:
   - If migrations are declared in local mode (`--database-mode local`, default), starts `postgres` and waits for healthy status.
   - In external database mode (`--database-mode external`), verifies reachability of `DATABASE_MIGRATE_URL` without starting or scheduling local `postgres`, then runs `demo-migrate`.
   - Runs `demo-migrate` one-shot container with dedicated `role_demo_migrate` credentials.
6. **Selective Service Recreation**:
   - Recreates only the changed containers with `docker compose up -d --no-deps <service>`.
7. **Health Verification**:
   - Probes container status for healthy state (`demo-api`, `demo-web`, `caddy`; ignores `postgres` in external mode).
   - Queries application API readiness probe (`/ready`) verifying database connectivity.
8. **State Persistence**:
   - Updates `/var/lib/megalith/state.json` recording successful release and history.

---

## 4. Operational Commands Reference

```bash
# Validate release manifest schema and cryptographic digests
python3 platform/deploy/scripts/release.py validate release.json

# Check current running release, history, and active transactions
python3 platform/deploy/scripts/deploy.py status

# Run preflight operational check (supports --provider oci|gcp and --profile full|micro)
python3 platform/deploy/scripts/preflight.py --provider gcp --profile full --environment production

# Prepare release (dry-run Compose syntax and image check)
python3 platform/deploy/scripts/deploy.py prepare release.json --provider gcp --profile full

# Apply release with operator authorization (default local database)
python3 platform/deploy/scripts/deploy.py apply release.json --auth auth.json --provider gcp --profile full --environment production

# Apply release with external database endpoint
python3 platform/deploy/scripts/deploy.py apply release.json --auth auth.json --database-mode external --environment production

# Run health probes against active stack
python3 platform/deploy/scripts/deploy.py check --provider gcp --profile full

# Recover an interrupted or crashed deployment
python3 platform/deploy/scripts/deploy.py recover --provider gcp --profile full

# Manual rollback to last-known-good release
python3 platform/deploy/scripts/deploy.py rollback --provider gcp --profile full
```

