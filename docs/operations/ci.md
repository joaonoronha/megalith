# Continuous Integration Architecture & Operations Guide

This document provides a comprehensive operational and architectural reference for the Megalith continuous integration system implemented via GitHub Actions (`.github/workflows/ci.yaml`).

---

## 1. CI Workflow Architecture

Megalith uses a single, maintainable GitHub Actions workflow (`.github/workflows/ci.yaml`) divided into five logical stages designed for polyglot monorepo operations:

```text
 Stage A: Detect Changes (tooling/classify_changes.py)
   │
   ├───► Stage B1: Platform Validation (Manifests & Tooling tests) ─────┐
   │                                                                     │
   ├───► Stage B2: Terraform Validation (fmt, init, validate) ──────────┤
   │                                                                     │
   ├───► Stage C1: Service / demo-api (uv sync --frozen; ruff & pytest) ─┤
   │                                                                     │
   ├───► Stage C2: Service / demo-web (pnpm frozen; tsc, vitest, vite) ──┤
   │                                                                     │
   ├───► Stage D1: Container Build / demo-api (Buildx amd64 + arm64) ────┤
   │                                                                     │
   ├───► Stage D2: Container Build / demo-web (Buildx amd64 + arm64) ────┤
   │                                                                     │
   └───► Stage D3: Container & DB Smoke (verify_containers & verify_pg) ─┤
                                                                         ▼
                                                   Stage E: CI / required (Gate Job)
```

1. **Stage A (`changes`)**: Detects changed paths using a lightweight Python engine (`tooling/classify_changes.py`) and outputs boolean execution flags.
2. **Stage B1 (`platform`)**: Validates repository manifests and executes platform/CLI tests on every run.
3. **Stage B2 (`terraform`)**: Validates OCI Terraform formatting, initialization, and syntax when infrastructure files change.
4. **Stage C (`demo-api`, `demo-web`)**: Executes language-native checks and tests only when relevant code or shared contracts change.
5. **Stage D (`container-build-api`, `container-build-web`, `container-smoke`)**: Builds multi-arch container images (`linux/amd64`, `linux/arm64`) using Docker Buildx and executes the sanitized integration smoke tests for container networking and PostgreSQL persistence & recovery.
6. **Stage E (`required`)**: Canonical gate job named `CI / required` that enforces branch protection, verifies job outcomes, accepts intentional skips, and rejects unexpected failures or skips.

---

## 2. Trigger Events & Concurrency

The workflow triggers on:
- **Pull Requests (`pull_request`)**: Targeting the primary branch (`main`). Untrusted pull requests run in an isolated unprivileged context without secrets.
- **Pushes (`push`)**: To the primary branch (`main`).
- **Manual Execution (`workflow_dispatch`)**: Allows manual triggering from the GitHub Actions UI with conservative execution of all validation jobs.

### Concurrency Policy
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```
- Superseded runs on pull request branches are automatically canceled to conserve runner minutes.
- Pushes to `main` are never canceled in progress to ensure complete audit trails for merged commits.

---

## 3. Change Detection Rules & Matrix

Path classification is governed by `tooling/classify_changes.py`, implementing a conservative rule set:

| Changed Files | Triggered Checks |
| :--- | :--- |
| `apps/demo/api/**` | `demo-api` checks & tests, `container-build-api`, `container-smoke` |
| `apps/demo/web/**` | `demo-web` checks, tests, build, `container-build-web`, `container-smoke` |
| `apps/demo/product.yaml` | Both `demo-api` and `demo-web`, both container builds, `container-smoke` |
| `projects.yaml` | Global validation and all services / container builds |
| `tooling/schemas/**` | Global validation and all services / container builds |
| `tooling/validate.py` | Global validation and all services / container builds |
| `platform/cli/**` | Platform tests and all services / container builds |
| `platform/infra/oci/**` | `terraform` formatting, initialization, and validation |
| `platform/deploy/**` (including `postgres/**`, `caddy/**`) | `container-build-api`, `container-build-web`, `container-smoke` |
| `tooling/verify_containers.py` | `container-build-api`, `container-build-web`, `container-smoke` |
| `tooling/verify_postgres.py` | `container-build-api`, `container-build-web`, `container-smoke` |
| `tooling/verify_ingress.py` | `container-build-api`, `container-build-web`, `container-smoke` |
| `.github/workflows/**` | Full verification of all services and container builds |
| Documentation-only (`docs/**`, `*.md`) | Lightweight `platform` validation; expensive service & container builds skipped |
| Unrecognized / unmatched paths | **Conservative fallback**: Triggers all validation and builds |

---

## 4. Required Validation Checks

The `platform` job runs on every workflow invocation:
1. `python3 tooling/validate.py`: Validates all manifests (`projects.yaml`, `product.yaml`, `service.yaml`) against schemas and domain contracts.
2. `pytest tooling/tests platform/cli/tests`: Executes the test suite for validator logic, CLI discovery, and lifecycle execution.

The Megalith CLI is installed in editable mode (`pip install -e platform/cli`) to verify package installability in a fresh environment.

---

## 5. Service-Specific Checks

Services are invoked strictly via the Megalith CLI harness (`megalith run`):

### Backend (`demo/api`)
- Runtime: Python 3.12, managed with `uv`.
- Installation: `uv sync --frozen --extra dev` using committed `apps/demo/api/uv.lock`.
- Commands executed:
  ```bash
  megalith run demo/api check  # ruff check src/ tests/
  megalith run demo/api test   # pytest tests/
  ```

### Frontend (`demo/web`)
- Runtime: Node.js 22 LTS, package manager `pnpm` 12.3.4.
- Installation: `pnpm install --frozen-lockfile` using committed `apps/demo/web/pnpm-lock.yaml`.
- Commands executed:
  ```bash
  megalith run demo/web check  # tsc --noEmit
  megalith run demo/web test   # vitest run
  megalith run demo/web build  # tsc --noEmit && vite build
  ```

---

## 6. Container Build Policy

- Built using Docker Buildx (`docker buildx build`).
- **No Registry Pushing**: Images are built exclusively for verification; `push: false` is enforced.
- **No Embedded Secrets**: Build arguments and environment variables contain zero credentials.
- **Base Image Immutability**: All Dockerfiles preserve strict cryptographic base-image digests (`sha256:...`).

### Integration Smoke Tests (`container-smoke`)
When triggered, the `container-smoke` job executes three end-to-end verification suites on the runner:
1. **Container Network & Reverse Proxy Smoke Test (`tooling/verify_containers.py`)**:
   - Validates Compose syntax, builds local images, and starts the stack.
   - Verifies health probes, non-root container users (UID 10001, UID 101), and port 8000 isolation.
   - Verifies frontend HTTP delivery (port 8080) and API reverse proxying (`/api/message`).
   - Verifies backend outage handling (504 Gateway Timeout) and automatic recovery upon restart.
2. **PostgreSQL Persistence & Recovery Test (`tooling/verify_postgres.py`)**:
   - Validates startup sequencing (`postgres` healthy -> `demo-migrate` successful -> `demo-api` healthy).
   - Verifies ADR-007 role isolation (application role denied DDL and cross-database access).
   - Verifies persistent endpoints (`GET /ready`, `GET /api/counter`, `POST /api/counter/increment`).
   - Verifies atomic concurrency under parallel increments.
   - Verifies logical backup creation (`pg_dump`) and isolated restore (`pg_restore` into temporary database).
   - Verifies durability across PostgreSQL container restart and stack recreation (`docker compose down` and `docker compose up -d`).
3. **Caddy Edge Ingress & Routing Test (`tooling/verify_ingress.py`)**:
   - Validates production and local Caddyfile syntax via `caddy validate`.
   - Starts dedicated stack on collision-resistant port 18082 with Caddy edge ingress.
   - Validates frontend routing, client-side SPA routing fallback, direct `/api/*` backend routing, and counter state mutations.
   - Validates security headers (CSP, nosniff, DENY, Referrer-Policy, Server header suppression) and omission of HSTS in local HTTP mode.
   - Confirms host port privacy (only Caddy port exposed; backend and database unexposed).
   - Validates container network segmentation (Caddy on `edge-network` cannot reach `postgres` on `data-network`).
   - Verifies API failure handling (clean 502 Bad Gateway without HTML SPA leak) and automatic recovery upon restart.


---

## 7. ARM64 Verification Policy

The eventual production deployment target is an OCI Always Free ARM64 Ampere VM. CI provides compatibility evidence via:
1. **Multi-Architecture Buildx Builds**: Each service image is built for `linux/amd64,linux/arm64`.
2. **QEMU Emulation**: Configured via `docker/setup-qemu-action` on GitHub-hosted `ubuntu-latest` x86_64 runners.
3. **Tradeoffs**:
   - Compiling and executing package installations under QEMU emulation introduces CPU overhead.
   - GitHub Actions layer caching (`type=gha,mode=max`) mitigates recurring build latency.
   - Runtime integration smoke tests (`tooling/verify_containers.py`) run natively on the runner's host architecture (`amd64`).

---

## 8. GitHub Actions Security Controls

Least-privilege security standards are strictly applied:
1. **Explicit Restrictive Permissions**:
   ```yaml
   permissions:
     contents: read
   ```
2. **Zero Elevated Workflow Triggers**: `pull_request_target` is strictly forbidden.
3. **Third-Party Action Pinning**: All GitHub Actions are pinned to full 40-character immutable commit SHA hashes:
   - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (`v4.2.2`)
   - `actions/setup-python@42375524e23c412d93fb67b49958b491fce71c38` (`v5.4.0`)
   - `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` (`v4.2.0`)
   - `pnpm/action-setup@7088e561eb65bb68695d245aa206f005ef30921d` (`v4.1.0`)
   - `astral-sh/setup-uv@1edb52594c857e2b5b13128931090f0640537287` (`v5.3.0`)
   - `docker/setup-qemu-action@29109295f81e9208d7d86ff1c6c12d2833863392` (`v3.6.0`)
   - `docker/setup-buildx-action@b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2` (`v3.10.0`)
   - `hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd` (`v3.1.2`)
4. **No Secrets in CI**: No cloud credentials, SSH keys, or registry tokens exist in the workflow.

---

## 9. Caching Strategy

To optimize runner duration without compromising reproducibility:
- **Python / Pip**: Cached via `actions/setup-python` cache.
- **Python / uv**: Cached via `astral-sh/setup-uv` (`enable-cache: true`).
- **Node / pnpm**: Cached via `actions/setup-node` tied to `apps/demo/web/pnpm-lock.yaml`.
- **Docker Buildx**: Layer caching via GitHub Actions cache backend (`type=gha,scope=<service>,mode=max`).

---

## 10. Required Gate & Interpreting Skipped Jobs

In selective CI, skipped jobs can break branch protection if individual job names are marked required. Megalith resolves this with a single gate job:

### Status Check Name: `CI / required`
- **Execution**: Runs on `if: always()`.
- **Logic**:
  - `changes` and `platform` MUST succeed.
  - If a service was triggered, its job MUST succeed.
  - If a service was not triggered, its job MUST be `skipped`.
  - Any job failure or cancellation immediately causes `CI / required` to exit 1.
  - An unexpected skip (e.g. triggered service job skipped unexpectedly) causes the gate to fail.
- **Reporting**: Generates a GitHub Step Summary Markdown table detailing each check's trigger status and outcome.

---

## 11. Local Reproduction

To run the exact checks executed by CI locally:

```bash
# 1. Manifest and platform tests
python3 tooling/validate.py
pytest tooling/tests platform/cli/tests

# 2. Test change classification logic
python3 tooling/classify_changes.py --files apps/demo/api/src/main.py

# 3. Backend checks
megalith run demo/api check
megalith run demo/api test

# 4. Frontend checks
megalith run demo/web check
megalith run demo/web test
megalith run demo/web build

# 5. Container verification
python3 tooling/verify_containers.py

# 6. Workflow linting (if actionlint is installed)
actionlint .github/workflows/ci.yaml
```

---

## 12. Configuring GitHub Branch Protection

To protect the `main` branch:
1. Navigate to repository **Settings** -> **Branches** -> **Branch protection rules** (or **Rulesets**).
2. Target branch: `main`.
3. Enable **Require status checks to pass before merging**.
4. Search for and select exactly one status check:
   ```text
   CI / required
   ```
5. Do NOT select individual service jobs (`Service / demo-api`, etc.), as those are intentionally skipped when changes do not affect them.

---

## 13. Adding Another Product or Service to CI

When a new product or service is added (e.g., `apps/fitness/api`):

1. **Service Manifest**: Define lifecycle commands (`check`, `test`, `build`) in `apps/fitness/api/service.yaml`.
2. **Path Classification**: Add path matching rules to `tooling/classify_changes.py`:
   - Add `apps/fitness/api/**` to a `fitness_api` trigger output.
   - Update tests in `tooling/tests/test_classify_changes.py`.
3. **Workflow Jobs**: Add a `fitness-api` job to `.github/workflows/ci.yaml` following the pattern of `demo-api`.
4. **Gate Update**: Add `fitness-api` to the `needs` list and validation checks in `CI / required`.

This explicit approach prevents hidden magic, ensuring every service's CI requirements remain visible, auditable, and testable.

---

## 14. Release Packaging & Controlled Deployment Workflows

In addition to PR and push validation (`ci.yaml`), Megalith provides two dedicated deployment workflows:

### Release Packaging (`.github/workflows/release.yaml`)
- **Trigger**: `workflow_dispatch` with `git_sha`, `environment`, and optional `release_id`.
- **Preflight Verification**: Automatically queries the GitHub Checks API to verify that the canonical status check `CI / required` has completed with `conclusion: success` for the exact commit SHA before any build begins.
- **Multi-Architecture Builds**: Builds container images for both `linux/amd64` and `linux/arm64` using Docker Buildx and QEMU.
- **Digest Pinning**: Emits cryptographic digest-pinned references (`image@sha256:...`) and generates a sealed `release.json` manifest conforming to `tooling/schemas/release.schema.json`.
- **Artifact Upload**: Publishes `release.json` as a workflow artifact for review and authorization.

### Controlled Deployment (`.github/workflows/deploy.yaml`)
- **Trigger**: `workflow_dispatch` requiring dual input confirmation (`release_id` and `confirm_release_id` must match).
- **Schema Validation**: Validates the release manifest against JSON schema and verifies immutable digests.
- **Authorization Audit**: Seals human operator identity, timestamp, and environment into the deployment audit record.
