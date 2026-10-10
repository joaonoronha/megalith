# Local Containerization Architecture

This document describes the container architecture, security hardening, multi-architecture compatibility, and local Docker Compose orchestration for services in the Megalith monorepo.

---

## 1. Architectural Role & Non-Goals

### Containerization vs. Deployment
- **Packaging Boundary**: Dockerfiles and Compose configurations in Megalith serve as local packaging and developer runtime verification mechanisms.
- **Independence**: Containerization does **not** replace native language toolchains (`pnpm`, `pytest`, `ruff`, `uv`). Services remain independently testable and executable on the host without Docker.
- **Target Topology**: In alignment with [ADR-005](../decisions/adr-005-hosting.md), deployable services are packaged into OCI-compatible container images destined for an OCI ARM64 virtual machine.
- **Non-Goals**: This architecture does not include public TLS termination (deferred to Caddy per [ADR-006](../decisions/adr-006-public-ingress.md)), cloud infrastructure provisioning, CI/CD pipelines, container registries, or database persistence.

---

## 2. Local Container Topology

The local Compose environment establishes an isolated bridge network (`demo-network`) where only the frontend web server publishes a host port:

```
                  Browser / HTTP Client
                           │
                           ▼ (http://localhost:8080)
                  ┌──────────────────────┐
                  │ demo-web             │
                  │ Nginx Unprivileged   │
                  │ (Port 8080 internal) │
                  └──────────┬───────────┘
                             │
                             │ (proxy_pass http://demo-api:8000/api/*)
                             ▼ (Private bridge network)
                  ┌──────────────────────┐
                  │ demo-api             │
                  │ FastAPI / Uvicorn    │
                  │ (Port 8000 internal) │
                  └──────────────────────┘
```

### Key Topology Principles
1. **Single Entry Point**: Only `demo-web` publishes its port (`${PORT:-8080}:8080`).
2. **Backend Port Isolation**: Port `8000` on `demo-api` is deliberately omitted from host port bindings and accessible only over the private Docker network.
3. **Dynamic Reverse Proxy**: The frontend container runs Nginx configured to reverse proxy `/api/*` directly to `demo-api:8000` via Docker's internal DNS (`127.0.0.11`).

---

## 3. Dockerfile Design Decisions

### 3.1 Backend (`apps/demo/api/Dockerfile`)
- **Base Image**: Multi-architecture Debian Bookworm slim pinned by immutable digest:
  `python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258`
- **Dependency Tooling**: Astral `uv` copied from multi-architecture image:
  `ghcr.io/astral-sh/uv:0.5.24@sha256:2381d6aa60c326b71fd40023f921a0a3b8f91b14d5db6b90402e65a635053709`
- **Multi-Stage Build**:
  - `builder`: Installs only production dependencies from `uv.lock` into `/app/.venv` using `uv sync --frozen --no-dev`. Test runners and linters are excluded from the runtime image.
  - `runtime`: Minimal Python slim base containing only the prebuilt virtual environment and application source code.
- **Non-Root Execution**: Runs under unprivileged user `appuser:appgroup` (UID `10001`, GID `10001`).
- **Health Check**: In-process check using Python's standard library `urllib` querying `http://127.0.0.1:8000/health`. Zero external packages required.
- **Process Management**: Exec-form `CMD` executing `uvicorn src.main:app --host 0.0.0.0 --port 8000` with signal forwarding.

### 3.2 Frontend (`apps/demo/web/Dockerfile`)
- **Builder Base**: `node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`
- **Package Manager**: Pinned `pnpm@12.3.4` respecting committed `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- **Runtime Base**: `nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0`
  - Eliminates Node.js runtime, compilers, and `node_modules` from the shipping image.
  - Runs unprivileged as `nginx` user (UID `101`, GID `101`) on port `8080`.
- **Health Check**: BusyBox `wget -qO- http://127.0.0.1:8080/` validating Nginx is serving traffic.

---

## 4. Reverse Proxy & DNS Resolution

The production Nginx configuration (`apps/demo/web/nginx.conf`) handles both static single-page application routing and API proxying:

```nginx
server {
    listen 8080;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Client-side SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Docker embedded DNS resolver for dynamic service discovery
    resolver 127.0.0.11 valid=10s ipv6=off;

    # Reverse proxy for API requests to the private backend Compose service
    location /api/ {
        set $api_upstream http://demo-api:8000;
        proxy_pass $api_upstream$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 2s;
        proxy_read_timeout 5s;
        proxy_send_timeout 5s;
    }
}
```

### Path Semantics & Outage Handling
- **Path Transparency**: A request to `http://localhost:8080/api/message` reaches `GET /api/message` on `demo-api:8000`.
- **Failover / Outage Resilience**: If `demo-api` goes offline, Nginx catches upstream connectivity errors within 2 seconds and returns an HTTP 504/502 status code. The client React application catches this gracefully, displaying an inline error state with a retry button. Once `demo-api` recovers, requests automatically resume.

---

## 5. Container Security Controls

| Security Dimension | `demo-api` | `demo-web` |
| :--- | :--- | :--- |
| **User Identity** | Non-root `appuser` (UID 10001) | Non-root `nginx` (UID 101) |
| **Filesystem Access** | `read_only: true` with writable `/tmp` tmpfs | `read_only: true` with `/tmp`, `/var/cache/nginx`, `/var/run` tmpfs |
| **Linux Capabilities** | `cap_drop: ["ALL"]` | `cap_drop: ["ALL"]` |
| **Privilege Escalation** | `no-new-privileges: true` | `no-new-privileges: true` |
| **Docker Socket** | Not mounted | Not mounted |
| **Host Ports** | Completely unexposed (internal only) | Configurable port published (default 8080) |
| **Base Image Digests** | Immutable SHA256 digest | Immutable SHA256 digest |

---

## 6. Multi-Architecture Compatibility (AMD64 & ARM64)

Megalith is designed to run locally on developer workstations (frequently AMD64 or Apple Silicon ARM64) and deploy to OCI Ampere A1 ARM64 instances.

### Multi-Architecture Evidence Breakdown
1. **Base Image Manifest Verification**:
   All base image digests advertise native OCI manifests for both `linux/amd64` and `linux/arm64` (checked via `docker buildx imagetools inspect`):
   - `python:3.12-slim-bookworm` (manifest list contains `linux/amd64`, `linux/arm64/v8`)
   - `ghcr.io/astral-sh/uv:0.5.24` (manifest list contains `linux/amd64`, `linux/arm64`)
   - `node:22-alpine` (manifest list contains `linux/amd64`, `linux/arm64/v8`)
   - `nginxinc/nginx-unprivileged:1.27-alpine` (manifest list contains `linux/amd64`, `linux/arm64`)
2. **Architecture-Neutral Code**:
   Dockerfiles contain no hardcoded architectures, `--platform` flags, or architecture-specific binary downloads.
3. **Build Execution**:
   - `linux/amd64`: Built, executed, and verified end-to-end on this host.
   - `linux/arm64`: Cross-compiling across architectures without hardware or QEMU binfmt emulation produces `exec format error`. Native execution requires ARM64 hardware or registered QEMU binfmt emulation (`tonistiigi/binfmt`).

---

## 7. Local Compose Lifecycle Operations

From the repository root:

```bash
# Validate Compose configuration syntax
docker compose -f platform/deploy/compose.yaml config

# Build container images
docker compose -f platform/deploy/compose.yaml build

# Start services in the background
docker compose -f platform/deploy/compose.yaml up -d

# Inspect container status and health
docker compose -f platform/deploy/compose.yaml ps

# Inspect logs
docker compose -f platform/deploy/compose.yaml logs -f

# Run automated end-to-end verification script
python3 tooling/verify_containers.py

# Stop and remove containers and networks
docker compose -f platform/deploy/compose.yaml down
```
