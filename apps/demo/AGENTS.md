# AGENTS.md — Megalith Demo Product Guidelines

> **Notice**: These instructions provide behavioral guidance for AI coding agents working on the **demo** product. Markdown instructions are not security boundaries.

---

## 1. Product Purpose
The `demo` product is a reference polyglot application built to demonstrate independent frontend and backend service operation, manifest-driven orchestration, and robust HTTP communication across runtime boundaries.

## 2. Architecture & Service Topology
The product contains two independently deployable services under `apps/demo/`:
- **`api` (`demo/api`)**: Python FastAPI backend service exposing REST endpoints (`/health`, `/api/message`).
- **`web` (`demo/web`)**: TypeScript / React 19 / Vite client-rendered frontend service consuming `/api/message`.

Each service contains its own `service.yaml`, local `AGENTS.md`, and dedicated test suite.

## 3. Service Boundaries & Isolation
- **No Cross-Service Direct Code Imports**: `demo/web` must not import Python modules from `demo/api`, and `demo/api` must not import web files.
- **Cross-Product Modifications Forbidden**: Agent edits must remain confined to `apps/demo/` unless modifying global manifests (`projects.yaml`) or tooling contracts with explicit justification.
- **Independent Life Cycles**: Each service must remain buildable and testable independently. Do not introduce build-time coupling between `web` and `api`.

## 4. Inter-Service Communication & API Contracts
- **Endpoint Contracts**:
  - `GET /health` -> `{"status": "ok", "service": "demo/api"}`
  - `GET /api/message` -> `{"message": "Hello from Megalith API", "service": "demo/api"}`
- **Proxy Configuration**: `demo/web` uses relative paths (`/api/*`). The Vite development server proxies requests to `http://localhost:8000`.
- **Breaking Contract Changes**: Any modification to response keys, status codes, or payload schemas in `apps/demo/api` requires:
  1. Updating backend Pydantic models in `apps/demo/api/src/main.py`.
  2. Updating backend tests in `apps/demo/api/tests/test_api.py`.
  3. Updating frontend TypeScript types and consuming components in `apps/demo/web/src/App.tsx`.
  4. Updating frontend Vitest mock fixtures in `apps/demo/web/src/App.test.tsx`.

## 5. Development & Testing Workflow
- **Validation**:
  ```bash
  python3 tooling/validate.py
  # or
  megalith validate
  ```
- **Service Verification**:
  ```bash
  megalith run demo/api check
  megalith run demo/api test
  megalith run demo/web check
  megalith run demo/web test
  megalith run demo/web build
  ```

## 6. Constraints & Non-Goals
- Do not introduce databases, ORMs, message brokers, authentication, or Docker containers in this product.
- Keep dependencies lean and preserve native tooling (`pnpm`, `pytest`, `ruff`, `vite`).
