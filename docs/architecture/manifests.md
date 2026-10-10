# Manifest Architecture & Contracts

## 1. Overview
The monorepo uses declarative, machine-readable YAML manifests backed by JSON Schemas to define products, services, dependencies, and lifecycle commands. This allows developers, CI/CD pipelines, and AI coding agents to discover repository topology without inspecting code heuristics or relying on fragile directory assumptions.

## 2. Source of Truth & Registry Architecture
We deliberately separate the root catalog from product-level manifests to maintain a single source of truth:
- **`projects.yaml` (Root Catalog)**: A minimal registry that lists active products and pointers to their manifest files. It contains no duplicated metadata (descriptions, services, commands).
- **`apps/<product>/product.yaml`**: The canonical definition of a product and its declared services.
- **`apps/<product>/<service>/service.yaml`**: The canonical definition of a service, its runtime, commands, build artifacts, and deployment requirements.

By keeping `projects.yaml` minimal, we prevent drift between product metadata and the root catalog.

## 3. Identifiers & Naming Conventions
- **Product Identifier (`id`)**: Must be lowercase alphanumeric with hyphens (kebab-case), matching regex `^[a-z0-9]+(-[a-z0-9]+)*$` (e.g., `fitness`, `finance-tracker`).
- **Service Identifier (`id`)**: Must be lowercase alphanumeric with hyphens, matching regex `^[a-z0-9]+(-[a-z0-9]+)*$` (e.g., `api`, `web`, `worker`, `mobile`).
- **Qualified Service Identifier**: A fully qualified service name is formatted as `<product>/<service>` (e.g., `fitness/api`, `fitness/web`). Qualified identifiers are globally unique across the monorepo and are used for inter-service dependencies.

## 4. Manifest Contracts

### 4.1 Root Catalog (`projects.yaml`)
Schema: `tooling/schemas/projects.schema.json`

```yaml
version: 1
products:
  - id: fitness
    manifest: apps/fitness/product.yaml
```

**Fields**:
- `version` (int, required): Manifest format version (currently `1`).
- `products` (array, required): List of registered products.
  - `id` (string, required): Stable product identifier.
  - `manifest` (string, required): Relative path from repo root to the product's `product.yaml`.

### 4.2 Product Manifest (`product.yaml`)
Schema: `tooling/schemas/product.schema.json`

```yaml
id: fitness
name: Fitness Tracker
description: Personal fitness and workout tracking suite
docs: README.md
services:
  - id: api
    manifest: api/service.yaml
  - id: web
    manifest: web/service.yaml
```

**Fields**:
- `id` (string, required): Stable product identifier (must match `projects.yaml` entry).
- `name` (string, required): Human-readable display name.
- `description` (string, required): Purpose and summary of the product.
- `docs` (string, required): Relative path to documentation (e.g., `README.md` within the product directory).
- `services` (array, required): List of services declared under this product.
  - `id` (string, required): Service identifier.
  - `manifest` (string, required): Relative path to `service.yaml` relative to this product manifest's directory.

### 4.3 Service Manifest (`service.yaml`)
Schema: `tooling/schemas/service.schema.json`

```yaml
id: api
product: fitness
type: api
runtime:
  language: python
  version: "3.12"
  framework: FastAPI
path: apps/fitness/api
commands:
  dev: "uvicorn app.main:app --reload --port 8000"
  test: "pytest"
  lint: "ruff check"
  build: "docker build -t fitness-api:latest ."
artifact:
  type: docker
  image_name: fitness-api
deployment:
  deployable: true
  target: oci-vm
dependencies:
  services: []
  external:
    - postgresql
```

**Fields**:
- `id` (string, required): Stable service identifier.
- `product` (string, required): Owning product identifier (must match parent `product.yaml`).
- `type` (string, required): `web`, `api`, `worker`, `mobile`, `cli`, `library`, or `other`.
- `runtime` (object, required):
  - `language` (string, required): `typescript`, `javascript`, `python`, `go`, or `other`.
  - `version` (string, optional): Runtime version specification.
  - `framework` (string, optional): High-level framework name.
- `path` (string, required): Path to service working directory relative to repository root.
- `commands` (object, required): Lifecycle commands (`dev`, `build`, `test`, `lint`, `typecheck`).
- `artifact` (object, required):
  - `type` (string, required): `docker`, `binary`, `bundle`, `static`, `package`, or `none`.
  - `image_name` (string, optional): Container image name when artifact type is `docker`.
- `deployment` (object, required):
  - `deployable` (boolean, required): Whether service is independently deployable.
  - `target` (string, required): `oci-vm`, `static`, `mobile-store`, or `none`.
- `dependencies` (object, required):
  - `services` (array of strings, optional): Qualified service IDs (`<product>/<service>`).
  - `external` (array of strings, optional): Third-party dependencies (e.g. `postgresql`).

## 5. Security & Path Safety Rules
- All file and directory paths in manifests must be relative.
- Path traversal sequences (such as `../` escaping the repository root) are strictly forbidden and rejected by the validator.
- Paths must resolve to existing files or directories within the repository.
