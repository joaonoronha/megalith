# Megalith

> An AI-first, polyglot monorepo engineered for personal applications developed by AI coding agents under human supervision.

---

## 1. What This Monorepo Is
**Megalith** is a single Git repository designed to house 6–15 personal applications and supporting platform tooling. Products in Megalith can span polyglot technology stacks:
- **TypeScript / JavaScript**: React, Next.js, Node.js
- **Python**: FastAPI, Typer CLI, background processors
- **Go**: High-performance services and CLI tooling
- **React Native / Expo**: Cross-platform mobile applications

The repository establishes explicit architectural boundaries, machine-readable manifest contracts, automated validation, and hierarchical AI agent instructions.

---

## 2. Why It Exists
Managing a suite of personal software across a dozen separate Git repositories causes:
- **Tooling and Dependency Drift**: Every repo ends up with divergent CI setups, linters, and helper scripts.
- **Cognitive Overhead**: Solo developers lose track of operational requirements and deployment mechanisms.
- **Context Fragmentation for AI Agents**: AI coding models lack global repository awareness, leading to hallucinated conventions and conflicting architectures.

Megalith solves this by centralizing platform infrastructure, manifests, and engineering policies into a single repository while strictly isolating products and deployable units.

---

## 3. Architectural Principles
1. **Simplicity and YAGNI**: No speculative abstractions or unnecessary framework layers.
2. **Product-Oriented Organization**: Products own their services (frontend, API, worker, mobile).
3. **Independent Deployability**: Every service has its own lifecycle commands, runtime, and deployment target.
4. **Strict Isolation**: Zero direct cross-product imports within `apps/`. Cross-cutting utilities must live in `packages/`.
5. **Polyglot Native Tooling**: Standard language toolchains (`npm`/`pnpm`, `uv`/`pip`, `go mod`). We explicitly reject complex monorepo orchestrators (Nx, Turborepo, Bazel) at this stage.
6. **Boring, Proven Infrastructure**: Deployment targets an Oracle Cloud Infrastructure (OCI) Always Free ARM64 VM running Docker Compose, Caddy ingress with automatic HTTPS, and a single PostgreSQL instance with isolated databases and roles per product.
7. **AI-First Engineering**: Clear hierarchical guidance, typed manifest contracts, automated validation, and mandatory human authorization before production releases.

---

## 4. Repository & Product Organization

```text
/
├── AGENTS.md                  # Canonical global AI agent guidelines & model routing
├── CLAUDE.md                  # Lightweight entry point for Claude Code
├── GEMINI.md                  # Lightweight entry point for Gemini CLI / Antigravity
├── README.md                  # Repository documentation
├── projects.yaml              # Root project catalog (single registry)
├── .gitignore                 # Polyglot gitignore rules
│
├── apps/                      # Products and their independent services
│   └── <product>/             # Product domain (e.g. fitness)
│       ├── product.yaml       # Product manifest
│       ├── AGENTS.md          # Product-specific AI instructions
│       ├── README.md          # Product documentation
│       ├── api/               # API service (contains service.yaml)
│       └── web/               # Web service (contains service.yaml)
│
├── packages/                  # Shared libraries and cross-cutting packages
│
├── platform/                  # Platform infrastructure & tooling
│   ├── cli/                   # Platform CLI (Python / Typer)
│   ├── deploy/                # Compose definitions and deployment scripts
│   └── infra/
│       └── oci/               # OCI host setup and provisioning recipes
│
├── tooling/                   # Manifest schemas, validation, and templates
│   ├── schemas/               # JSON Schemas for manifests
│   ├── templates/             # Reusable templates (e.g. product-AGENTS.md.template)
│   ├── tests/                 # Manifest validator test suite
│   ├── requirements.txt       # Tooling Python dependencies
│   └── validate.py            # Manifest validator CLI & engine
│
├── .ai/                       # Global AI standards and workflows
│   ├── standards/             # Lightweight engineering standards
│   └── workflows/             # Reusable agent prompt workflows
│
├── docs/                      # Architectural documentation
│   ├── architecture/          # Deep-dive system documentation
│   ├── decisions/             # Architecture Decision Records (ADR-001 - ADR-010)
│   └── operations/            # Operational runbooks and backup procedures
│
└── .github/
    └── workflows/             # CI/CD GitHub Actions workflows
```

---

## 5. How Manifests Work
The repository topology is defined via declarative YAML manifests validated against JSON Schemas:

- **Root Catalog (`projects.yaml`)**: The minimal registry listing active products and pointers to their manifest files. It avoids duplicating product metadata.
- **Product Manifest (`apps/<product>/product.yaml`)**: Declares product identifier, display name, description, documentation link, and list of owned services.
- **Service Manifest (`apps/<product>/<service>/service.yaml`)**: Declares service identifier, owning product, service type (`web`, `api`, `worker`, etc.), runtime, working path, lifecycle commands (`dev`, `build`, `test`, `lint`), build artifact format, deployment target, and dependencies.

**Naming Convention**: Fully qualified service identifiers follow `<product>/<service>` (e.g. `fitness/api`).

For detailed manifest contracts and schemas, see [Manifest Architecture](docs/architecture/manifests.md).

---

## 6. How to Run Manifest Validation

### Prerequisites
- Python 3.10+
- Dependencies installed:
  ```bash
  pip install -r tooling/requirements.txt
  ```

## 6. Megalith Platform CLI

The **Megalith CLI** (`megalith`) provides a unified developer interface for the monorepo, built using Python, Typer, and Rich.

### 6.1 Installation
Install the CLI in editable mode within your Python virtual environment or active Python environment:
```bash
pip install -e platform/cli
```

Verify installation:
```bash
megalith --help
```

### 6.2 Supported Commands & Examples
- **List products & services**:
  ```bash
  megalith list
  ```
  Lists all registered products and declared services in deterministic alphabetical order.
- **Service details**:
  ```bash
  megalith info <product>/<service>
  # Example: megalith info demo/api
  ```
  Displays validated service configuration (runtime, working directory, lifecycle commands, dependencies, build artifact, deployment eligibility).
- **Validate repository manifests**:
  ```bash
  megalith validate
  ```
  Executes complete schema and contract validation against all manifests (or directly via `python3 tooling/validate.py`).
- **Run lifecycle commands**:
  ```bash
  megalith run <product>/<service> <command>
  # Examples:
  megalith run demo/api test
  megalith run demo/web build
  ```
  Executes the declared command within the service's working directory, streaming output live and propagating exit codes.

### 6.3 Repository Discovery Behavior
The CLI can be invoked from any directory within the repository (root, product directory, service subdirectory, or nested package). It discovers the repository root by searching upward for canonical markers:
1. `projects.yaml`
2. `tooling/schemas/projects.schema.json`
3. `AGENTS.md`

To override auto-discovery, provide the `--repo-root PATH` option or set the `MEGALITH_ROOT` environment variable.

### 6.4 Lifecycle Execution Security
- **Explicit Declaration**: Only commands declared in validated `service.yaml` manifests may be executed. Arbitrary user commands are rejected.
- **Zero Shell Invocation**: Commands are executed directly via `subprocess` with `shell=False`. `eval`, shell expansion, and shell pipelines are forbidden.
- **Argument Vector Parsing**: Commands may be declared as shell command strings (tokenized via `shlex.split`) or explicit argument arrays (`["python", "-m", "pytest"]`).
- **Working Directory Isolation**: Working directories are validated to exist and strictly reside within the repository boundaries.
- **Real-Time Streaming & Exit Code Propagation**: Standard output and error are streamed live to the terminal, and exact exit codes are propagated to the caller.

### 6.5 Running Automated Tests
```bash
# Run all automated tests (validator + CLI)
pytest tooling/tests platform/cli/tests

# Run CLI tests only
pytest platform/cli/tests

# Or run using Python standard library unittest runner
python3 -m unittest discover -s platform/cli/tests
```

---

## 7. How AI Agents Use Repository Instructions
AI coding agents (Claude Code, Gemini CLI, etc.) interact with the repository following a tiered instruction model:
1. **Global Canonical Rules (`AGENTS.md`)**: The root `AGENTS.md` defines workspace rules, boundary enforcement, secret prevention, testing requirements, and the multi-model routing table.
2. **Tool Entry Points (`CLAUDE.md` and `GEMINI.md`)**: Lightweight entry points that point agents directly to `AGENTS.md` and highlight core verification commands.
3. **Product-Level Rules (`apps/<product>/AGENTS.md`)**: Domain concepts, service interactions, and framework specifics for each product.

> **Note**: Markdown instructions are behavioral guidance for agents, not security boundaries. Production deployments, database drops, and credential changes strictly require human authorization.

For details, see [AI Instruction Architecture](docs/architecture/ai-instructions.md).

---

## 8. What Has Been Implemented
- [x] Initial directory structure and Git hygiene (`.gitignore`, `.gitkeep` placeholders).
- [x] 10 Architecture Decision Records in `docs/decisions/` (ADR-001 through ADR-010).
- [x] JSON Schemas for `projects.yaml`, `product.yaml`, and `service.yaml` in `tooling/schemas/`.
- [x] Root project catalog `projects.yaml` (accepts empty catalog cleanly).
- [x] Automated manifest validator in `tooling/validate.py` (path safety, duplicate checks, schema verification, dependency cycle detection).
- [x] Comprehensive validator test suite in `tooling/tests/test_validator.py` (31 passing automated tests).
- [x] Canonical `AGENTS.md` with multi-model routing policy.
- [x] Lightweight `CLAUDE.md` and `GEMINI.md` entry points.
- [x] Reusable product AI instruction template in `tooling/templates/product-AGENTS.md.template`.
- [x] Global engineering standards in `.ai/standards/`.
- [x] Deep-dive architecture documentation in `docs/architecture/`.
- [x] **Platform CLI (`megalith`)** under `platform/cli/` supporting `list`, `info`, `validate`, and `run`.
- [x] Comprehensive CLI test suite in `platform/cli/tests/test_cli.py` (24 passing automated tests).
- [x] CLI architecture documentation in `docs/architecture/cli.md`.
- [x] **First Polyglot Product (`apps/demo`)**:
  - `demo/web`: TypeScript / React 19 / Vite frontend with local proxy, error resilience, and Vitest suite.
  - `demo/api`: Python / FastAPI backend with health and message endpoints, Pydantic models, and pytest suite.
  - Manifest contracts, product/service AI instructions (`AGENTS.md`), and end-to-end integration verification.
- [x] **Containerization & Local Compose (`platform/deploy/compose.yaml`)**:
  - Multi-stage, non-root Dockerfiles with pinned multi-arch digests for `demo/api` (Python 3.12 / uv) and `demo/web` (Node 22 / pnpm / Nginx unprivileged).
  - Production reverse proxy configuration mapping `/api/*` to private backend service `demo-api:8000`.
  - Private container bridge network with backend host port isolation.
  - Health checks, non-root user enforcement (UID 10001, UID 101), read-only root filesystems, and dropped capabilities.
  - Automated verification script (`tooling/verify_containers.py`) and documentation (`docs/architecture/containerization.md`).
- [x] **Continuous Integration & Selective Execution (`.github/workflows/ci.yaml`)**:
  - Secure, selective GitHub Actions CI pipeline running on pull requests, pushes to `main`, and manual dispatch.
  - Least-privilege permissions (`contents: read`) and immutable third-party action SHAs.
  - Deterministic change classification engine (`tooling/classify_changes.py`) triggering only affected services and container builds.
  - Multi-architecture container image build verification (`linux/amd64`, `linux/arm64`) using Docker Buildx and QEMU.
  - Automated manifest validation, platform tests, locked backend (`uv`) and frontend (`pnpm`) checks.
  - Predictable required gate job (`CI / required`) generating Markdown summaries for branch protection.
  - Operations documentation in [`docs/operations/ci.md`](docs/operations/ci.md) and [`docs/operations/container-verification.md`](docs/operations/container-verification.md).
- [x] **OCI Always Free ARM64 Infrastructure Foundation (`platform/infra/oci/`)**:
  - Declarative Terraform configuration for OCI Virtual Cloud Network, public subnet, internet gateway, and instance-level Network Security Groups.
  - Hard-pinned `VM.Standard.A1.Flex` ARM64 compute instance with conservative Always Free sizing (2 OCPUs, 12 GB RAM, 50 GB boot volume) and zero paid fallback shapes.
  - Strict administrative SSH security requiring explicit administrator CIDR blocks (forbidding `0.0.0.0/0`) and key-based authentication.
  - Automated cloud-init bootstrap configuring Ubuntu 24.04 LTS ARM64, non-root user (`ubuntu`), UFW firewall, Docker Engine & Compose plugin, and Docker daemon log rotation (max 20MB, 3 files per ADR-010).
  - Provider dependency lockfile (`.terraform.lock.hcl`), variable examples, non-sensitive outputs, and strict state/secret git exclusions.
  - Automated safety tests (`tooling/tests/test_terraform_safety.py`), CI validation integration (`.github/workflows/ci.yaml`), architecture reference ([`docs/architecture/infrastructure.md`](docs/architecture/infrastructure.md)), and operational runbook ([`docs/operations/oci-provisioning.md`](docs/operations/oci-provisioning.md)).
- [x] **PostgreSQL Persistence Foundation & Product Isolation (`platform/deploy/`)**:
  - Shared PostgreSQL 16 Alpine container pinned to multi-arch digest (`postgres:16-alpine@sha256:7218...`), private to internal Compose network (port 5432 unexposed).
  - Strict ADR-007 role isolation: separate administrative (`postgres`), schema migration (`role_demo_migrate`), and runtime application (`role_demo_app`) roles with least privilege.
  - Idempotent cluster initialization script (`01-init-demo-db.sh`) and standalone administrative provisioning utility (`provision.py`).
  - Production-grade Alembic migrations for `demo/api` executed deterministically via one-shot Compose service `demo-migrate`.
  - Persistent atomic counter endpoints (`GET /api/counter`, `POST /api/counter/increment`) and database readiness probe (`GET /ready`).
  - Automated backup (`backup.py` / `pg_dump`) and isolated restore testing (`restore.py` / `pg_restore` into temporary database).
  - Data durability verified across container restart and Compose stack recreation without volume loss.
  - End-to-end verification suite (`tooling/verify_postgres.py`), architecture documentation ([`docs/architecture/persistence.md`](docs/architecture/persistence.md)), and operations guide ([`docs/operations/postgres-operations.md`](docs/operations/postgres-operations.md)).
- [x] **Production Edge Ingress with Caddy (`platform/deploy/caddy/`, `platform/deploy/compose.prod.yaml`)**:
  - Hard-pinned multi-arch Caddy v2.9 Alpine container (`caddy:2.9-alpine@sha256:b4e3...`) with minimal capabilities (`cap_drop: [ALL]`, `cap_add: [NET_BIND_SERVICE]`, `security_opt: [no-new-privileges:true]`).
  - Production-ready edge ingress topology where Caddy publishes ports 80 and 443 while all upstream services (`demo-web`, `demo-api`, `postgres`) remain private.
  - Strict network segmentation across `edge-network` and `data-network`, guaranteeing Caddy has zero network access to PostgreSQL.
  - Direct route segregation: `/api*` proxies directly to `demo-api:8000`, while static assets and SPA fallback route to `demo-web:8080`. API failures cleanly return 502 Bad Gateway without leaking HTML SPA fallbacks.
  - Defense-in-depth security headers (CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Server` header suppression, and HSTS for HTTPS).
  - Forwarded header security via Uvicorn proxy CIDR trust restrictions narrowed to loopback and dedicated edge network (`127.0.0.1, 172.28.0.0/24`).
  - Safe local testing mode (`compose.local-ingress.yaml`, `Caddyfile.local`) on collision-resistant test ports with automatic HTTPS disabled and HSTS omitted.
  - Automated end-to-end verification suite (`tooling/verify_ingress.py`), architecture documentation ([`docs/architecture/ingress.md`](docs/architecture/ingress.md)), and operational runbook ([`docs/operations/ingress.md`](docs/operations/ingress.md)).
- [x] **Controlled Deployment Pipeline, Immutable Releases, and Safe Rollback (`platform/deploy/scripts/`, `.github/workflows/`)**:
  - Release manifest schema with versioning, strict validation, and human authorization metadata ([`tooling/schemas/release.schema.json`](tooling/schemas/release.schema.json), [`platform/deploy/scripts/release.py`](platform/deploy/scripts/release.py)).
  - Cryptographic digest pinning: deployment strictly requires immutable `@sha256:...` image references; mutable tags (`:latest`, `:v1.0`) are unconditionally rejected.
  - Two-stage GitHub Actions workflows: release packaging ([`.github/workflows/release.yaml`](.github/workflows/release.yaml)) verifying exact-commit `CI / required` gate, building multi-arch images, and emitting sealed release manifests; controlled deployment workflow ([`.github/workflows/deploy.yaml`](.github/workflows/deploy.yaml)) with dual-confirmation inputs (`confirm_release_id == release_id`).
  - Host-side deployment engine ([`platform/deploy/scripts/deploy.py`](platform/deploy/scripts/deploy.py)) featuring non-blocking concurrency locking (`fcntl.flock`), atomic state tracking (`/var/lib/megalith/state.json`), pre-deploy database migrations (`role_demo_migrate`), and selective container recreation (preserving unchanged PostgreSQL and Caddy instances).
  - Conservative rollback mechanics: automated rollback on health probe failure, manual rollback command, and strict blockage of automated container rollback when non-backward-compatible database migrations were applied.
  - Task 008 follow-ups addressed: narrowed proxy CIDR trust (`127.0.0.1, 172.28.0.0/24`), host-scoped HSTS, test port collision resilience (`find_available_port`), and automated merged compose topology test ([`tooling/tests/test_merged_compose.py`](tooling/tests/test_merged_compose.py)).
  - Automated 16-scenario deployment & rollback verification suite ([`tooling/verify_deployment.py`](tooling/verify_deployment.py)), architecture documentation ([`docs/architecture/deployment.md`](docs/architecture/deployment.md)), deployment runbook ([`docs/operations/deployment.md`](docs/operations/deployment.md)), and rollback runbook ([`docs/operations/rollback.md`](docs/operations/rollback.md)).
- [x] **Production Readiness, Deployment Security, Operational Hardening, and Disaster Recovery (`platform/deploy/`, `docs/operations/`)**:
  - Independent deployment authorization: Immutable Schema v2 manifests separated from host-side operator authorizations bound to canonical SHA-256 digests ([`tooling/schemas/authorization.schema.json`](tooling/schemas/authorization.schema.json), [`platform/deploy/scripts/release.py`](platform/deploy/scripts/release.py)).
  - Exact-commit CI provenance verification ([`platform/deploy/scripts/verify_ci_provenance.py`](platform/deploy/scripts/verify_ci_provenance.py)) preventing untrusted check substitution.
  - Crash-safe deployment state engine with `os.fsync` pre-mutation writes, durable phase transitions, audit trails (`/var/lib/megalith/audit.log`), and interrupted-operation recovery (`deploy.py recover`).
  - Encrypted, streaming PostgreSQL backups using `age` (X25519) with zero plaintext on disk, companion `.meta.json` manifests, SHA-256 verification, and off-host export ([`platform/deploy/postgres/backup.py`](platform/deploy/postgres/backup.py)).
  - Clean-environment restore drills (`restore.py drill`), fail-closed retention pruning, and dedicated systemd units (`megalith-backup.service`, `megalith-backup.timer`).
  - Operational preflight validation checking host architecture, Docker, memory, disk thresholds, and port bindings ([`platform/deploy/scripts/preflight.py`](platform/deploy/scripts/preflight.py)).
  - Precise reverse proxy trust with static Caddy IP `172.28.0.10` scoped to `compose.prod.yaml` and `FORWARDED_ALLOW_IPS: "127.0.0.1,172.28.0.10"`.
  - Comprehensive operational documentation: Disaster Recovery Runbook ([`docs/operations/disaster-recovery-runbook.md`](docs/operations/disaster-recovery-runbook.md)) and Production Readiness Specification ([`docs/operations/production-readiness.md`](docs/operations/production-readiness.md)).
  - Automated 22-scenario operational resilience and failure-injection verification suite ([`tooling/verify_operations.py`](tooling/verify_operations.py)) passing all tests.

---

## 9. What Is Planned but Not Implemented
The following components are deferred to subsequent tasks in accordance with scope restrictions:
- **Production Public TLS Issuance**: Caddy automatic HTTPS configuration is implemented; public ACME issuance will occur upon production deployment once public DNS points to OCI.
- **Production Hosting on OCI**: Local deployment pipeline, ingress, and persistence verified; no production workloads or databases have been deployed to OCI.
- **Shared Libraries**: No code exists yet in `packages/`.
- **Actual Cloud Infrastructure Provisioning**: Real OCI resources have not been created; provisioning requires manual execution with authenticated credentials.

---

## 10. How to Add a Product in the Future

Follow this step-by-step workflow when introducing a new product:

1. **Create the Product Directory**:
   ```bash
   mkdir -p apps/<product-id>
   ```
2. **Initialize Product Documentation & Instructions**:
   - Copy `tooling/templates/product-AGENTS.md.template` to `apps/<product-id>/AGENTS.md` and document domain architecture, concepts, and conventions.
   - Create `apps/<product-id>/README.md` explaining the product.
3. **Scaffold Services**:
   - Create service directories: `apps/<product-id>/<service-id>/` (e.g. `api`, `web`).
   - Add a `service.yaml` manifest in each service directory defining its commands, runtime, artifact, and deployment target.
4. **Create the Product Manifest**:
   - Create `apps/<product-id>/product.yaml` referencing all declared services and docs.
5. **Register in the Root Catalog**:
   - Add an entry in `projects.yaml`:
     ```yaml
     products:
       - id: <product-id>
         manifest: apps/<product-id>/product.yaml
     ```
6. **Validate the Manifests**:
   ```bash
   python3 tooling/validate.py
   ```
   Ensure validation reports `STATUS: SUCCESS` with 0 errors.