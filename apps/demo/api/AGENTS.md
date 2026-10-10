# AGENTS.md — Demo API Service Guidelines

> **Notice**: These instructions guide AI coding agents working on the backend service `demo/api`.

---

## 1. Service Role & Boundaries
- **Service Identifier**: `demo/api`
- **Location**: `apps/demo/api`
- **Role**: Lightweight, stateless REST API built with FastAPI serving the Megalith Demo frontend.
- **Boundaries**: All edits must remain strictly scoped to `apps/demo/api/`. Do not import from or modify `apps/demo/web/` or unrelated products.

## 2. Framework Conventions & Standards
- **Framework**: FastAPI (Python 3.11+).
- **Application Entrypoint**: `src.main:app`.
- **Response Validation**: Every endpoint must declare a typed Pydantic response model (e.g. `HealthResponse`, `MessageResponse`) with field descriptions.
- **Error Handling**: Use standard FastAPI `HTTPException` with explicit status codes and JSON error detail objects.
- **Routing**: In this minimal service, routes reside in `src/main.py`. If additional domains are introduced, group routes into routers under `src/routers/`.

## 3. API Contracts
- `GET /health` -> `{"status": "ok", "service": "demo/api"}`
- `GET /api/message` -> `{"message": "Hello from Megalith API", "service": "demo/api"}`

Keep response models backwards-compatible with `apps/demo/web`.

## 4. Testing Expectations
- All endpoints must have automated tests under `tests/` using `starlette.testclient.TestClient`.
- Tests must execute deterministically in-memory without requiring an externally running server process.
- Run tests:
  ```bash
  pytest tests/
  ```
- Run static checks and formatting verification:
  ```bash
  ruff check src/ tests/
  ```

## 5. Dependency Management
- Declare all runtime dependencies under `[project.dependencies]` in `pyproject.toml`.
- Declare test/development dependencies under `[project.optional-dependencies.dev]`.
- Avoid adding database clients, ORMs, or background task queues at this stage.
