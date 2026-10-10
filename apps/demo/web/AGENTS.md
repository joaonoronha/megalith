# AGENTS.md — Demo Web Service Guidelines

> **Notice**: These instructions guide AI coding agents working on the frontend service `demo/web`.

---

## 1. Service Role & Boundaries
- **Service Identifier**: `demo/web`
- **Location**: `apps/demo/web`
- **Role**: Client-rendered React 19 application built with TypeScript and Vite.
- **Boundaries**: Edits must be strictly confined to `apps/demo/web/`. Do not import backend code or modify other products.

## 2. Frontend Conventions & Architecture
- **Framework / Tooling**: React, TypeScript, Vite.
- **Package Manager**: `pnpm`.
- **Component Organization**: Components reside in `src/`. Keep components small, functional, and explicit.
- **Styling**: Inline CSS / simple CSS styles without external heavyweight CSS frameworks.
- **State Management**: Standard React hooks (`useState`, `useEffect`, `useCallback`). Do not introduce Redux, Zustand, or TanStack Query for this minimal demo.

## 3. API Communication & Proxies
- **Relative Fetch**: Always use relative URLs (e.g. `/api/message`) for API requests. Do not hardcode `http://localhost:8000` or production hostnames in source code.
- **Development Proxy**: Vite dev server proxies `/api` to the backend (default `http://localhost:8000`, configurable via `VITE_API_URL`).
- **Resilience**: The application must remain functional when the backend is unreachable, displaying an explicit error state and a retry trigger.

## 4. Testing Expectations
- **Test Framework**: Vitest with `@testing-library/react` and `jsdom`.
- **Mocking**: Mock network calls (`fetch`) in tests. Tests must not rely on an active backend server.
- **Commands**:
  ```bash
  # Run tests
  pnpm test

  # Run type checks
  pnpm check

  # Run production build
  pnpm build
  ```

## 5. Dependency Restrictions
- Check `package.json` before introducing any new library.
- Do not introduce server-side rendering (SSR), UI component libraries, or complex build plugins.
