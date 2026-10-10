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

---

## 9. What Is Planned but Not Implemented
The following components are deferred to subsequent tasks in accordance with scope restrictions:
- **Continuous Deployment (CD)**: Automated production release and deployment pipelines.
- **Production Edge Ingress**: No host Caddy reverse proxy or public TLS certificate configuration exists yet.
- **OCI Infrastructure**: No OCI Terraform or host provisioning recipes exist yet in `platform/infra/oci/`.
- **Database Provisioning**: No PostgreSQL container or database/role provisioning scripts exist yet.
- **Shared Libraries**: No code exists yet in `packages/`.

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