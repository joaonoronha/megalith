# Megalith Demo (`demo`)

A minimal polyglot demonstration application establishing and validating the Megalith monorepo architecture across independent frontend and backend services.

## Overview

The `demo` product validates:
1. **Polyglot Execution**: A TypeScript/React frontend and a Python/FastAPI backend coexist within the same repository.
2. **Independent Services**: Both services possess their own lifecycle commands, dependency manifests, and test suites.
3. **Platform CLI Integration**: The Megalith CLI discovers, inspects, and executes tasks across both services without hardcoded paths.
4. **Resilient Communication**: The frontend communicates with the backend via a local Vite reverse proxy while gracefully handling backend downtime.

---

## Architecture & Service Topology

```
apps/demo/
├── product.yaml           # Product manifest declaring web and api services
├── README.md              # Product documentation and developer guide
├── AGENTS.md              # Product-level AI agent instructions
├── api/                   # Python FastAPI service (demo/api)
│   ├── service.yaml
│   ├── AGENTS.md
│   ├── pyproject.toml
│   ├── src/main.py
│   └── tests/test_api.py
└── web/                   # React + TypeScript + Vite frontend (demo/web)
    ├── service.yaml
    ├── AGENTS.md
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── vite.config.ts
    ├── src/App.tsx
    └── src/App.test.tsx
```

### Services

| Service | Qualified ID | Runtime | Role | Port |
| :--- | :--- | :--- | :--- | :--- |
| **API** | `demo/api` | Python 3.11+ / FastAPI | Stateless REST endpoints | `8000` |
| **Web** | `demo/web` | TypeScript 5.x / React 19 / Vite | Client-rendered web interface | `5173` |

---

## Inter-Service Communication Topology

### Local Development Flow

```
[Browser / User]
       │
       ▼ (HTTP :5173)
[Vite Dev Server] (apps/demo/web)
       │  (/api/message proxy)
       ▼ (HTTP :8000)
[FastAPI Server] (apps/demo/api)
```

1. The frontend initiates relative HTTP requests to `/api/message`.
2. In development, Vite intercepts `/api/*` and proxies requests to `http://localhost:8000`.
3. If the backend is offline, the frontend handles the network failure cleanly by rendering an error state and offering a "Retry" action.
4. **Runtime vs. Build Dependencies**: While the frontend communicates with the API at runtime, frontend builds (`pnpm build`) and unit tests (`pnpm test`) do **not** depend on the backend running.

### API Contract

- **`GET /health`** (Liveness check):
  ```json
  {
    "status": "ok",
    "service": "demo/api"
  }
  ```
- **`GET /ready`** (Readiness check - checks PostgreSQL connectivity):
  ```json
  {
    "status": "ready",
    "service": "demo/api",
    "database": "connected"
  }
  ```
- **`GET /api/message`**:
  ```json
  {
    "message": "Hello from Megalith API",
    "service": "demo/api"
  }
  ```
- **`GET /api/counter`** (Persistent counter state):
  ```json
  {
    "value": 0,
    "service": "demo/api"
  }
  ```
- **`POST /api/counter/increment`** (Atomic increment with PostgreSQL transaction):
  ```json
  {
    "value": 1,
    "service": "demo/api"
  }
  ```

---

## Developer Guide

### Prerequisites
- Python `>= 3.11`
- Node.js `>= 20.0.0` (active: `v24.21.0`)
- pnpm `>= 9.0.0` (active: `12.3.4`)
- Megalith CLI installed (`pip install -e platform/cli`)

### 1. Install Dependencies
```bash
# Backend dependencies
pip install "fastapi>=0.110.0" "uvicorn>=0.28.0" "httpx>=0.27.0" "ruff>=0.3.0"

# Frontend dependencies
cd apps/demo/web && pnpm install && cd ../../..
```

### 2. Run with Megalith CLI
```bash
# Inspect services in catalog
megalith list
megalith info demo/api
megalith info demo/web

# Run backend static checks and tests
megalith run demo/api check
megalith run demo/api test

# Run frontend type check, tests, and production build
megalith run demo/web check
megalith run demo/web test
megalith run demo/web build

# Start services for local development (run in separate terminals)
megalith run demo/api dev   # Starts FastAPI on http://localhost:8000
megalith run demo/web dev   # Starts Vite dev server on http://localhost:5173
```

### 3. Native Direct Commands
You can also run commands directly within service directories:
```bash
# Backend (apps/demo/api)
cd apps/demo/api
uvicorn src.main:app --port 8000 --reload
pytest tests/
ruff check src/ tests/

# Frontend (apps/demo/web)
cd apps/demo/web
pnpm dev
pnpm test
pnpm check
pnpm build
```

### 4. Local Docker Compose Workflow
To test the services containerized under a production-like Nginx reverse proxy topology:

```bash
# Validate Compose configuration syntax
docker compose -f platform/deploy/compose.yaml config

# Build container images
docker compose -f platform/deploy/compose.yaml build

# Start services in the background
docker compose -f platform/deploy/compose.yaml up -d

# Inspect health and status
docker compose -f platform/deploy/compose.yaml ps

# Access frontend in browser or via curl
curl http://localhost:8080/
curl http://localhost:8080/api/message

# Run automated container integration verification script
python3 tooling/verify_containers.py

# Stop and clean up containers
docker compose -f platform/deploy/compose.yaml down
```

### 5. Caddy Edge Ingress Workflow
To test the production-oriented topology with Caddy edge ingress, host routing, and network isolation:

```bash
# Start with local ingress overlay (Caddy on port 18082, private web and API)
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.local-ingress.yaml \
  up -d

# Test frontend and direct API routing via Caddy
curl http://localhost:18082/
curl -H "Host: demo.example.com" http://localhost:18082/api/message
curl -H "Host: demo.example.com" -X POST http://localhost:18082/api/counter/increment

# Run automated ingress verification suite
python3 tooling/verify_ingress.py

# Stop local ingress stack
docker compose \
  -f platform/deploy/compose.yaml \
  -f platform/deploy/compose.local-ingress.yaml \
  down
```
