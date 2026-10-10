# Megalith Deployment Platform

This directory contains the deployment configurations, Compose topologies, and host deployment tooling for Megalith.

---

## Directory Structure

```text
platform/deploy/
├── caddy/
│   ├── Caddyfile            # Production edge ingress configuration
│   └── README.md            # Caddy operations, TLS, and routing guide
├── postgres/
│   ├── init/                # Database initialization scripts (roles, schemas)
│   └── README.md            # PostgreSQL persistence & role isolation guide
├── scripts/
│   ├── deploy.py            # On-host deployment and rollback CLI engine
│   └── release.py           # Release manifest validator & parser
├── compose.yaml             # Base Docker Compose stack (services, databases, networks)
├── compose.prod.yaml        # Production overlay (Caddy public ingress, isolated web)
└── README.md
```

---

## Compose Topologies

1. **Local Development / Smoke Testing**:
   ```bash
   docker compose -f platform/deploy/compose.yaml up -d
   ```
   Publishes `demo-web` on port 8080 and `demo-api` on port 8000 for direct debugging.

2. **Production-Oriented Stack**:
   ```bash
   docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.prod.yaml up -d
   ```
   - Caddy is the sole ingress on host ports 80 and 443.
   - `demo-web` host port is reset (`!reset []`).
   - Reverse proxy routes `/api/*` to `demo-api:8000` and all other paths to `demo-web:8080`.
   - PostgreSQL and API services remain on isolated internal bridge networks.

---

## On-Host Deployment Engine (`scripts/deploy.py`)

The deployment engine applies validated, immutable release manifests to the host.

### Key Capabilities
- **Strict Immutability**: Enforces cryptographic `@sha256:...` digest-pinned image references. Rejects mutable tags (`:latest`).
- **Concurrency Locking**: Uses kernel-level `fcntl.flock` to guarantee single-operator execution.
- **Selective Recreation**: Diffs images against `/var/lib/megalith/state.json` and updates only changed containers, preserving PostgreSQL and Caddy.
- **Pre-Deploy Migrations**: Executes database migrations using isolated migration credentials (`role_demo_migrate`) before updating application containers.
- **Health Verification**: Performs post-recreation health checks and probes the `/ready` API endpoint.
- **Automatic & Manual Rollback**: Reverts safely to the previous release on health failure; blocks rollback if non-backward-compatible migrations were applied.

### Common Commands
```bash
# Validate release manifest
python3 platform/deploy/scripts/deploy.py validate release.json

# Check current running release and deployment state
python3 platform/deploy/scripts/deploy.py status

# Prepare release (preflight checks)
python3 platform/deploy/scripts/deploy.py prepare release.json

# Apply release
python3 platform/deploy/scripts/deploy.py apply release.json

# Manual rollback to last-known-good release
python3 platform/deploy/scripts/deploy.py rollback
```
