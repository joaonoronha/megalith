# Megalith Deployment Architecture

This document defines the release engineering, immutability, authorization boundaries, and deployment topology for the Megalith monorepo.

---

## 1. Core Principles

1. **Immutable Releases**:
   - Every deployable application container image must be referenced by its immutable cryptographic digest (`image@sha256:...`).
   - Mutable tags (`:latest`, `:v1.0`, `:main`) are strictly rejected by the deployment validator and schema.
2. **Two-Stage Authorization Boundary**:
   - Release creation and deployment application are strictly separated into two distinct stages.
   - Stage 1 builds multi-architecture images and produces a sealed `release.json` manifest.
   - Stage 2 requires explicit human confirmation (`confirm_release_id == release_id`) before applying changes to the target environment.
3. **Exact Commit CI Gate**:
   - Releases can only be packaged from commits where the full CI gate (`CI / required`) has passed for that exact Git commit SHA.
4. **Selective Service Lifecycle**:
   - Deployments inspect the running host state (`state.json`) and only recreate containers whose image digests or configuration have changed.
   - Shared persistent infrastructure (PostgreSQL, Caddy edge proxy) and unchanged service containers remain uninterrupted during product updates.
5. **Conservative Rollback**:
   - Health probes (`/health`, `/ready`) verify container and API vitality after recreation.
   - If health probes fail, the deployer automatically reverts to the previous release.
   - If an applied database migration was declared non-backward-compatible (`backward_compatible: false`), automatic rollback is blocked to prevent data corruption against an incompatible schema, requiring operator intervention.

---

## 2. Release Manifest Specification

Releases are formalized by a JSON manifest validated against [`tooling/schemas/release.schema.json`](file:///workspaces/megalith/tooling/schemas/release.schema.json).

```json
{
  "$schema": "https://megalith.internal/schemas/release.schema.json",
  "schema_version": 1,
  "release_id": "rel-20261010-abc1234",
  "git_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "created_at": "2026-10-10T12:00:00Z",
  "environment": "production",
  "config_version": "1.0",
  "services": ["demo-api", "demo-web"],
  "images": {
    "demo-api": "ghcr.io/username/megalith-demo-api@sha256:d733ffb6ac425b67724c2d7278ff3384b1535af8e1102cec1f5557650b0f4911",
    "demo-web": "ghcr.io/username/megalith-demo-web@sha256:8cb90f5ec6bf7dd76a03eafaf6e6d21c5660e4fcec1c2268fd87c0d42984520a"
  },
  "migrations": [
    {
      "service": "demo-api",
      "applied": true,
      "command": "alembic upgrade head",
      "backward_compatible": true
    }
  ],
  "approval": {
    "authorized_by": "operator@example.com",
    "authorized_at": "2026-10-10T12:05:00Z",
    "release_id": "rel-20261010-abc1234",
    "target_environment": "production",
    "intent": "deploy"
  }
}
```

### Validation Invariants
- `release_id` must follow `^[a-zA-Z0-9_-]{1,64}$` (strictly preventing directory traversal like `../`).
- `git_sha` must be a 40-character hexadecimal SHA1 hash.
- `images` map must only contain values matching `^.+@sha256:[a-f0-9]{64}$`.
- When targeting `production`, the `approval` object is mandatory and its `release_id` must match the top-level `release_id`.

---

## 3. Deployment Pipeline Topology

```text
  Developer / Operator
           │
           │ 1. Merge PR to main (passing CI / required)
           ▼
┌─────────────────────────┐
│ .github/workflows/      │
│ release.yaml            │  • Checks exact commit CI / required status
│                         │  • Builds multi-architecture ARM64/AMD64 images
│                         │  • Emits immutable image digests
│                         │  • Generates release manifest artifact
└──────────┬──────────────┘
           │
           │ 2. Operator reviews release manifest & authorizes deployment
           ▼
┌─────────────────────────┐
│ .github/workflows/      │
│ deploy.yaml             │  • Checks dual input confirmation (confirm_release_id)
│                         │  • Validates manifest against JSON schema
│                         │  • Seals human authorization block
└──────────┬──────────────┘
           │
           │ 3. On-Host Execution
           ▼
┌───────────────────────────────────────────────────────────┐
│ Host Deployment Engine (platform/deploy/scripts/deploy.py)│
│                                                           │
│  [1] Acquire fcntl.flock concurrency lock                 │
│  [2] Diff images against /var/lib/megalith/state.json     │
│  [3] Run pending backward-compatible migrations           │
│  [4] Selectively recreate changed service containers      │
│  [5] Run health & readiness probes (/ready)               │
│  [6] Success: Record new release in state.json            │
│  [7] Failure: Automatic rollback to previous release      │
│  [8] Release lock                                         │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Host Concurrency and State Model

The host deployment engine (`platform/deploy/scripts/deploy.py`) enforces strict single-operator execution via kernel-level file locking:
- Uses `fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)`.
- Concurrent invocations immediately fail with an informative lock collision message containing the active process PID and acquisition timestamp.
- On exit (normal, exception, or signal), the lock file descriptor is cleanly closed and unlocked.

State is recorded in an atomic JSON file (`/var/lib/megalith/state.json`):
- `current_release`: metadata and images of the active running release.
- `previous_release`: metadata of the immediately preceding release (available for rollback).
- `last_successful_release`: last release that completed health verification.
- `history`: audit trail of all deployments, rollbacks, and failures with timestamps.

---

## 5. Security & Network Boundary Considerations

1. **No Broad SSH Ingress**:
   - Task 006 provisions an OCI Network Security Group (NSG) restricting SSH strictly to `admin_ssh_cidr`.
   - GitHub Actions runner IP addresses are dynamic, untrusted, and change frequently. Megalith strictly avoids opening SSH to `0.0.0.0/0` on cloud VMs.
   - Host updates are driven by authorized operator sessions over existing secure admin channels or host-initiated polling/pulling.
2. **Narrowed Proxy Trust**:
   - `demo-api` (Uvicorn) only trusts forwarded proxy headers from loopback and the internal edge network subnet (`172.28.0.0/24`).
3. **Least Privilege Container Networking**:
   - `demo-web` and `postgres` are isolated from direct public traffic.
   - Caddy is the sole public listener on ports 80 and 443.
