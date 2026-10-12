# Product & Service Onboarding Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Task Reference:** Megalith Task 019 — Product & Service Onboarding Framework  
**Governance Classification:** `COOPERATIVELY ENFORCED, OPERATOR-REVIEWED` (ADR-013)  
**Branch:** `onboarding/task-019-product-service-framework`  

---

## 1. File Structure & Responsibilities

```
platform/
  templates/
    fastapi/
      service.yaml.tpl
      pyproject.toml.tpl
      Dockerfile.tpl
      src/main.py.tpl
      tests/test_main.py.tpl
      alembic/ (optional db)
    react/
      service.yaml.tpl
      package.json.tpl
      tsconfig.json.tpl
      vite.config.ts.tpl
      index.html.tpl
      Dockerfile.tpl
      nginx.conf.tpl
      src/App.tsx.tpl
      src/main.tsx.tpl
      src/App.test.tsx.tpl
    go/
      service.yaml.tpl
      go.mod.tpl
      main.go.tpl
      main_test.go.tpl
      Dockerfile.tpl
    postgres/
      init-db.sh.tpl
    product/
      product.yaml.tpl
      README.md.tpl
  cli/
    megalith/
      scaffold.py      # Core scaffolding logic, validation, file emission, preview mode
      product.py       # Typer CLI subcommands: megalith product create, list, validate
      service.py       # Typer CLI subcommands: megalith service add
      main.py          # Mounts product_app and service_app
tooling/
  classify_changes.py  # Manifest-driven CI discovery of dynamic products and services
  tests/
    test_onboarding_framework.py  # Comprehensive 16-scenario test suite
docs/
  operations/
    product-onboarding.md  # Canonical operations guide & template reference
```

---

## 2. Implementation Tasks

### Task 1: Versioned Template Library (`platform/templates/`)
- [ ] Create `platform/templates/product/` with `product.yaml.tpl` and `README.md.tpl`.
- [ ] Create `platform/templates/fastapi/` with Python package, `pyproject.toml.tpl` (uv), `Dockerfile.tpl`, `src/main.py.tpl`, `tests/test_main.py.tpl`, and Alembic migration templates.
- [ ] Create `platform/templates/react/` with `package.json.tpl` (pnpm), `tsconfig.json.tpl`, `vite.config.ts.tpl`, `index.html.tpl`, `Dockerfile.tpl`, `nginx.conf.tpl`, `src/App.tsx.tpl`, `src/main.tsx.tpl`.
- [ ] Create `platform/templates/go/` with `go.mod.tpl`, `main.go.tpl`, `main_test.go.tpl`, `Dockerfile.tpl`.
- [ ] Create `platform/templates/postgres/` with `init-db.sh.tpl` implementing isolated database and migration/app roles per ADR-007.

### Task 2: Core Scaffolding Engine (`platform/cli/megalith/scaffold.py`)
- [ ] Implement identifier validation (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- [ ] Implement safe path resolution preventing traversal or writes outside the repository root.
- [ ] Implement template renderer using standard string substitution or Jinja-free deterministic placeholder formatting.
- [ ] Implement `create_product(...)`:
  - Registers product in `projects.yaml`.
  - Creates `apps/<product>/product.yaml` and `apps/<product>/README.md`.
  - Supports `--dry-run` / `--preview`.
  - Refuses to overwrite existing files without `--force`.
- [ ] Implement `add_service(...)`:
  - Validates parent product existence.
  - Scaffolds chosen template (`fastapi`, `react`, `go`).
  - Registers service in `apps/<product>/product.yaml`.
  - Generates isolated PostgreSQL init script if `--database` requested.
  - Supports `--dry-run` / `--preview`.
  - Refuses to overwrite existing files without `--force`.
- [ ] Implement `validate_product(...)` integrating with `ManifestValidator`.

### Task 3: CLI Subcommands (`platform/cli/megalith/`)
- [ ] Create `platform/cli/megalith/product.py` with `create`, `list`, `validate`.
- [ ] Create `platform/cli/megalith/service.py` with `add`.
- [ ] Mount `product_app` and `service_app` in `platform/cli/megalith/main.py`.
- [ ] Add unit tests in `platform/cli/tests/test_cli.py` for new commands.

### Task 4: Manifest-Driven CI Discovery (`tooling/classify_changes.py`)
- [ ] Enhance `classify_changes.py` to dynamically discover products and services from `projects.yaml`.
- [ ] Map changes in `apps/<product>/<service>/**` to service execution flags or dynamic check triggers.
- [ ] Preserve conservative fallback for unknown or malformed files.
- [ ] Update `tooling/tests/test_classify_changes.py` to verify dynamic discovery.

### Task 5: Ingress and Compose Generation / Conflict Detection
- [ ] Implement port collision check and service name collision check in `scaffold.py`.
- [ ] Provide modular Compose generation helper or overlay generator.
- [ ] Provide Caddy route snippet generation helper.

### Task 6: Comprehensive Automated Test Suite (`tooling/tests/test_onboarding_framework.py`)
- [ ] Implement tests for all 16 required scenarios:
  1. Valid product generation.
  2. Valid service generation (FastAPI, React, Go).
  3. Duplicate identifiers rejection.
  4. Unsafe paths / path traversal rejection.
  5. Existing-file preservation.
  6. Deterministic generation.
  7. Manifest validation.
  8. Language-specific template builds and syntax.
  9. PostgreSQL role/database isolation script.
  10. Dynamic CI discovery.
  11. Compose configuration generation.
  12. Ingress routing conflict detection.
  13. Resource and architecture compatibility.
  14. Secret hygiene (zero plaintext secrets).
  15. Preview mode without filesystem writes.
  16. No cloud operations (100% offline).

### Task 7: Synthetic Onboarding Demonstration & Cleanup
- [ ] Run synthetic product generation using CLI: `megalith product create synth-demo` and `megalith service add synth-demo api --template fastapi`.
- [ ] Validate manifests with `tooling/validate.py`.
- [ ] Verify existing `demo` product is unaffected.
- [ ] Verify repeated generation fails safely.
- [ ] Clean up synthetic product cleanly.

### Task 8: Documentation & PR Finalization
- [ ] Write `docs/operations/product-onboarding.md`.
- [ ] Update completion report artifact.
- [ ] Push branch `onboarding/task-019-product-service-framework` and open PR.
- [ ] Verify GitHub Actions CI and halt for operator review.
