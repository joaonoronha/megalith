# Megalith Product & Service Onboarding Runbook

**Document Version:** 1.0.0  
**Status:** Canonical Platform Operations Guide  
**Task Reference:** Megalith Task 019 — Product & Service Onboarding Framework  
**Governance Classification:** `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED` (ADR-013)  

---

## 1. Overview & Architecture

Megalith is an AI-first, polyglot monorepo hosting multiple independently deployable products and platform shared tooling. The Product & Service Onboarding Framework provides a reproducible, manifest-driven workflow for adding new products and services with secure defaults, automatic manifest validation, zero duplicated configuration, and zero cloud dependencies.

```
+----------------------------------------------------------------------------------------------------+
|                                    MEGALITH ONBOARDING PIPELINE                                    |
+--------------------------+------------------------------+------------------------------------------+
| 1. Scaffolding Phase     | 2. Manifest Validation       | 3. Deployment & CI Integration           |
+--------------------------+------------------------------+------------------------------------------+
| megalith product create  | tooling/validate.py          | tooling/classify_changes.py              |
| megalith service add     | megalith product validate    | compose.<service>.yaml snippets          |
| (Templates: Py/TS/Go)    | JSON Schema contracts        | Caddy ingress route snippets             |
| PostgreSQL ADR-007 init  | Port/Path conflict detection | Selective GitHub Actions test matrix     |
+--------------------------+------------------------------+------------------------------------------+
```

### Core Design Directives
1. **Single Source of Truth**: The root catalog `projects.yaml`, product manifests `apps/<product>/product.yaml`, and service manifests `apps/<product>/<service>/service.yaml` serve as the authoritative metadata. No redundant registries or secondary catalogs exist.
2. **Deterministic Scaffolding**: Code generation is entirely local, offline, deterministic, and safe. File operations check for collisions and refuse to overwrite existing files unless explicitly instructed (`--force`).
3. **Defense-in-Depth Container Security**: All scaffolded container definitions adhere to Compose v2 security standards: unprivileged non-root users (`appuser:10001`), dropped capabilities (`cap_drop: [ALL]`), no-new-privileges flags (`security_opt: [no-new-privileges:true]`), read-only root filesystems, and sanitized credential placeholders.
4. **Strict PostgreSQL Database Isolation (ADR-007)**: Stateful products receive their own isolated database (`db_<product>`) and separate migration DDL (`role_<product>_migrate`) vs application runtime DML (`role_<product>_app`) roles, preventing cross-product data contamination.

---

## 2. Quickstart: Onboarding Walkthrough

The platform CLI provides non-interactive, scriptable commands to scaffold products and services.

### Step 1: Create a New Product

Scaffold the product directory structure, manifest, and initial documentation:

```bash
# Preview changes (Dry Run)
megalith product create billing --name "Megalith Billing" --description "Subscription and invoicing platform" --dry-run

# Execute creation
megalith product create billing --name "Megalith Billing" --description "Subscription and invoicing platform"
```

This generates:
- `apps/billing/product.yaml`: Declares product metadata and registered services list.
- `apps/billing/README.md`: Canonical product documentation entry point.
- Registers `billing` in root `projects.yaml`.

### Step 2: Add a Backend API Service (Python FastAPI + PostgreSQL)

Add a stateful FastAPI service equipped with Alembic migrations and ADR-007 PostgreSQL isolation:

```bash
megalith service add billing api \
  --template fastapi \
  --type api \
  --port 8001 \
  --database
```

This generates:
- `apps/billing/api/service.yaml`: Service contract and lifecycle commands (`test`, `run`, `lint`, `migrate`).
- `apps/billing/api/pyproject.toml`: Modern Python project configuration with uv / pip standards.
- `apps/billing/api/Dockerfile`: Multi-stage non-root container image definition.
- `apps/billing/api/src/main.py`: FastAPI application with health probe (`/healthz`).
- `apps/billing/api/tests/test_main.py`: Pytest suite verifying endpoints and health checks.
- `apps/billing/api/alembic.ini` & `migrations/`: Pre-configured database migration environment.
- `platform/deploy/postgres/init/02-init-billing-db.sh`: Idempotent database, user, and schema initialization script.
- Updates `apps/billing/product.yaml` to register the new `api` service.

### Step 3: Add a Frontend Web Service (React + Vite + TypeScript)

Add a client-side frontend service:

```bash
megalith service add billing web \
  --template react \
  --type web \
  --port 8080
```

This generates:
- `apps/billing/web/service.yaml`: Static web service manifest.
- `apps/billing/web/package.json` & `vite.config.ts`: React 18, Vite, and TypeScript toolchain.
- `apps/billing/web/Dockerfile` & `nginx.conf`: Unprivileged Nginx static file container.
- `apps/billing/web/src/App.tsx` & `src/App.test.tsx`: Component source and unit test suite.
- Updates `apps/billing/product.yaml` with the `web` service.

### Step 4: Validate Manifests & Contracts

Validate the new product manifests locally against schema definitions:

```bash
# Validate specific product
megalith product validate billing

# Validate entire repository catalog
python3 tooling/validate.py
```

---

## 3. Supported Template Matrix

The scaffolding engine supports three core runtime templates designed for polyglot services:

| Template | Runtime / Language | Framework / Tooling | Deployment Target | Default Port | Database Option |
|:---|:---|:---|:---|:---:|:---:|
| `fastapi` | Python 3.12+ | FastAPI, Pydantic v2, uv/pip | `oci-vm` | 8000 (or specified) | Yes (Alembic + PG16) |
| `react` | TypeScript / Node 20 | Vite, React 18, Nginx | `static` / `oci-vm` | 8080 | No (Stateless client) |
| `go` | Go 1.22+ | Standard library / HTTP router | `oci-vm` | 8000 (or specified) | No (External / Shared) |

### 3.1 Template A: Python FastAPI (`fastapi`)
* **Use Case:** High-performance REST APIs, asynchronous web services, and stateful application backends.
* **Commands Declared:**
  - `test`: `pytest tests -v`
  - `run`: `uvicorn src.main:app --host 0.0.0.0 --port <PORT>`
  - `lint`: `ruff check src tests`
  - `migrate`: `alembic upgrade head` (when `--database` is enabled)
* **Security Baseline:** Runs as UID/GID 10001 (`appuser`), non-root, slim base image, dropped system privileges.

### 3.2 Template B: React + TypeScript (`react`)
* **Use Case:** Web frontends, single-page applications (SPAs), and administrative portals.
* **Commands Declared:**
  - `build`: `pnpm build`
  - `test`: `pnpm test`
  - `lint`: `pnpm lint`
* **Container Runtime:** Multi-stage build producing static assets served by unprivileged Nginx on port 8080. Includes strict Content-Security-Policy headers and security options.

### 3.3 Template C: Go 1.22 (`go`)
* **Use Case:** High-throughput microservices, background task workers, and CLI tooling.
* **Commands Declared:**
  - `test`: `go test ./... -v`
  - `build`: `go build -o bin/service main.go`
  - `run`: `./bin/service`
* **Container Runtime:** Multi-stage build compiling a statically linked binary (`CGO_ENABLED=0`) running in a minimal unprivileged container.

---

## 4. PostgreSQL Database Isolation Model (ADR-007)

When `--database` is specified during service creation, the onboarding framework automatically provisions an idempotent database initialization script in `platform/deploy/postgres/init/XX-init-<product>-db.sh` conforming to Architecture Decision Record 007 (`ADR-007`):

### 4.1 Database & Role Naming Conventions
* **Database Name:** `db_<product>` (e.g. `db_billing`)
* **Migration Role (DDL):** `role_<product>_migrate` (owns schemas, tables, sequences; applied during CI/CD migrations)
* **Application Role (DML):** `role_<product>_app` (strictly limited to `SELECT`, `INSERT`, `UPDATE`, `DELETE`; used at runtime)

### 4.2 Security & Isolation Boundary
1. **Public Connect Revocation:**
   ```sql
   REVOKE CONNECT ON DATABASE db_<product> FROM PUBLIC;
   GRANT CONNECT ON DATABASE db_<product> TO role_<product>_migrate, role_<product>_app;
   ```
2. **Schema Separation:**
   - Database schema `app` is owned by `role_<product>_migrate`.
   - `role_<product>_app` receives runtime usage and table CRUD rights, but **cannot** perform `DROP TABLE`, `ALTER TABLE`, or create extensions.
3. **Sanitized Environment Variables:**
   - Credentials are never hardcoded. Initialization scripts reference sanitized environment variable placeholders:
     - `${DB_PASS_<PRODUCT>_MIGRATE:-...}`
     - `${DB_PASS_<PRODUCT>_APP:-...}`
   - Connection strings follow standard format:
     `postgresql+psycopg://role_<product>_app:****@postgres:5432/db_<product>?sslmode=prefer`

### 4.3 Applying Database Initialization to Existing Running Clusters (`megalith product db-init`)

> [!IMPORTANT]
> **Docker Initdb Behavior Limitation**: Official PostgreSQL Docker images only execute `/docker-entrypoint-initdb.d/` scripts on the **very first container startup** when the persistent data volume is completely empty. Adding a new stateful product to an existing local cluster will **not** trigger automatic execution of the new product's init script.

To onboard a newly scaffolded database into an already running local cluster without dropping volumes or restarting PostgreSQL:

```bash
# Preview initialization steps and SQL commands (Dry Run)
megalith product db-init billing --dry-run

# Execute against the active container (e.g. megalith-postgres)
megalith product db-init billing
```

**Key Execution Guarantees:**
- **Zero Data Loss**: Existing databases, roles, and volumes are preserved. No `DROP DATABASE` or volume teardown is performed.
- **Auto-Discovery**: Detects running PostgreSQL containers (`megalith-postgres`, `postgres`) or falls back to local `psql`.
- **Idempotence**: SQL scripts check `IF NOT EXISTS` for roles and databases, making repeated execution safe.


---

## 5. Selective CI Integration

Megalith uses change-path classification to avoid running redundant build and test steps for untouched products.

### 5.1 Manifest-Driven Service Discovery
The change classification engine (`tooling/classify_changes.py`) dynamically parses `projects.yaml` and product manifests to register valid monorepo components. It does **not** rely on hardcoded path lists:

```python
from tooling.classify_changes import discover_registered_services

# Dynamically loads all active products and services
services = discover_registered_services(repo_root)
# Returns: {'demo/api', 'demo/web', 'billing/api', 'billing/web', ...}
```

### 5.2 Triggering Workflows
* Changes within `apps/<product>/<service>/**` trigger tests and builds **only** for that specific service.
* Changes to product manifests `apps/<product>/product.yaml` trigger testing across all services within that product.
* Changes to global infrastructure (`platform/**`, `tooling/**`, `projects.yaml`) trigger comprehensive monorepo verification.

---

## 6. Deployment & Ingress Integration

### 6.1 Modular Standalone Snippets (`compose.snippet.yaml` & `caddy.snippet.txt`)

When a service is scaffolded, the engine writes modular configuration snippets directly into the service directory (`apps/<product>/<service>/`):

1. **`compose.snippet.yaml`**: A hardened Compose v2 service definition ready to be merged into `platform/deploy/compose.yaml` or used in local docker compose commands.
2. **`caddy.snippet.txt`**: A Caddy reverse-proxy block ready to be included in `platform/deploy/caddy/Caddyfile`.

```yaml
# apps/billing/api/compose.snippet.yaml
  billing-api:
    build:
      context: ../../apps/billing/api
      dockerfile: Dockerfile
    image: ${IMAGE_BILLING_API:-megalith-billing-api:local}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgresql+psycopg://role_billing_app:billing_app_dev_password@postgres:5432/db_billing}
    networks:
      - edge-network
      - data-network
    ports:
      - "${PORT_BILLING_API:-8001}:8001"
    healthcheck:
      test: ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health').read()"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
```

### 6.2 Service Type Scoping & Worker Isolation
* **API and Web Services (`api`, `web`)**: Attached to `edge-network` and `data-network` (if database-backed), declare container port forwardings, and generate `caddy.snippet.txt`.
* **Worker Services (`worker`)**:
  - Bound strictly to `internal-network` (and `data-network` if database-backed).
  - Edge ports are **omitted** to eliminate ingress attack surface.
  - Caddy ingress snippet `caddy.snippet.txt` is **not generated**.

### 6.3 Transactional Scaffolding & Regeneration Guardrails
* **Transactional Rollback**: File generation operates within a transactional envelope. If an error occurs during file rendering or writing (e.g., disk I/O, permissions), modified manifest backups (e.g. `projects.yaml`, `product.yaml`) are automatically restored and any partially created files are deleted.
* **Collision Protection**: Scaffolding refuses to overwrite existing services or product directories unless `--force` is explicitly provided.
* **Post-Scaffold Customization**: Once scaffolded, application code and manifest settings are meant to evolve independently. Using `--force` will regenerate files from templates and will overwrite local modifications; manual edits to `service.yaml` are the recommended method for configuration updates.


---

## 7. CLI Reference & Options

### `megalith product create`
```
Usage: megalith product create [OPTIONS] PRODUCT_ID

Arguments:
  PRODUCT_ID    Unique product identifier in lowercase-kebab-case (e.g. 'billing'). [required]

Options:
  -n, --name TEXT          Human-readable product display name.
  -d, --description TEXT   Brief description of the product purpose.
  --docs TEXT              Product documentation file name. [default: README.md]
  --repo-root PATH         Explicit path to monorepo root.
  --dry-run                Preview generated files without writing to disk.
  --force                  Overwrite existing files or registrations if they exist.
```

### `megalith service add`
```
Usage: megalith service add [OPTIONS] PRODUCT_ID SERVICE_ID

Arguments:
  PRODUCT_ID    Existing product identifier (e.g. 'billing'). [required]
  SERVICE_ID    Unique service identifier in lowercase-kebab-case (e.g. 'api'). [required]

Options:
  -t, --template [fastapi|react|go]
                           Template to scaffold from. [required]
  --type [api|web|worker|library|cli|other]
                           Architectural role enum. [default: api]
  -p, --port INTEGER       Default development/container port. [default: 8000]
  --database / --no-database
                           Configure PostgreSQL 16 database and isolated roles (ADR-007). [default: no-database]
  --deployable / --no-deployable
                           Whether service is eligible for standalone deployment. [default: deployable]
  --target TEXT            Target deployment platform ('oci-vm', 'static', 'none'). [default: oci-vm]
  --repo-root PATH         Explicit path to monorepo root.
  --dry-run                Preview generated files without writing to disk.
  --force                  Overwrite existing files if they exist.
```

### `megalith product validate`
```
Usage: megalith product validate [OPTIONS] [PRODUCT_ID]

Arguments:
  [PRODUCT_ID]    Specific product ID to validate, or all if omitted.

Options:
  --catalog TEXT    Relative path to project catalog. [default: projects.yaml]
  --repo-root PATH  Explicit path to monorepo root.
```

### `megalith product db-init`
```
Usage: megalith product db-init [OPTIONS] PRODUCT_ID

Arguments:
  PRODUCT_ID    Product identifier whose database initialization script should be applied. [required]

Options:
  --dry-run         Preview SQL and execution steps without applying changes.
  --repo-root PATH  Explicit path to monorepo root.
```

---

## 8. Troubleshooting & Common Issues

### Issue 1: `InvalidIdentifierError`
* **Symptoms:** Scaffolding command fails with `Identifier '...' is invalid`.
* **Cause:** Identifier violates lowercase-kebab-case pattern (`^[a-z0-9]+(-[a-z0-9]+)*$`) or uses reserved keywords (`platform`, `system`, `shared`, `infra`, `root`, `all`).
* **Resolution:** Use lowercase letters, digits, and hyphens only (e.g. `billing-service` instead of `billing_service` or `BillingService`).

### Issue 2: `PathTraversalError`
* **Symptoms:** Error message indicates path escapes repository root.
* **Cause:** Relative path components contain `..` or absolute path prefixes.
* **Resolution:** Specify relative paths contained strictly within the product directory.

### Issue 3: Port Collision Warning
* **Symptoms:** CLI outputs `Port 8000 is already assigned to service 'demo/api'`.
* **Cause:** Another service in `projects.yaml` is already using port 8000.
* **Resolution:** Provide a unique port via `--port <PORT>` (e.g. `8001`, `8002`, `8080`).

### Issue 4: Manifest Validation Failure
* **Symptoms:** `python3 tooling/validate.py` reports schema errors on new service.
* **Cause:** Required manifest field omitted or dependency references non-existent service.
* **Resolution:** Run `megalith product validate <product-id>` to isolate error details. Ensure dependency references use `<product>/<service>` qualified ID format.

### Issue 5: PostgreSQL Database Not Found in Running Local Stack
* **Symptoms:** Application fails to connect to `db_<product>` on a pre-existing PostgreSQL container.
* **Cause:** PostgreSQL Docker entrypoint scripts only execute upon first initialization of an empty volume. Existing database clusters do not automatically execute newly added init scripts.
* **Resolution:** Run `megalith product db-init <product-id>` to safely execute the initialization script against the running container without tearing down existing data.

### Issue 6: Scaffolding Aborted and Rolled Back
* **Symptoms:** CLI displays `ScaffoldError: Scaffolding transaction aborted and rolled back: <error>`.
* **Cause:** An unhandled error occurred during file creation or manifest modification (e.g., file permissions or disk error).
* **Resolution:** The engine's transactional rollback guarantees that `projects.yaml` and `product.yaml` were restored to their pre-operation state, and any partially generated files were cleaned up. Inspect the error message, resolve permissions or invalid paths, and re-run.

