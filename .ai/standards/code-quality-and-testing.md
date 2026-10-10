# Engineering Standard: Code Quality and Testing

## 1. Scope
This standard establishes baseline expectations for code quality, readability, error handling, and automated testing across all languages and frameworks in the repository.

## 2. Code Quality & Readability
- **Simplicity First**: Write straightforward, maintainable code. Avoid premature optimization, clever one-liners, and speculative generalizations (YAGNI).
- **Explicit over Implicit**: Code should be readable from top to bottom. Avoid hidden magic, monkey-patching, or excessive global state.
- **Documentation Integrity**: Preserve existing comments, docstrings, and license headers. Update documentation whenever modifying adjacent behavior.
- **Formatting and Linting**: Each service must define and run standard linting commands (e.g. `ruff check` / `ruff format` for Python, `eslint` / `prettier` for TypeScript, `go vet` / `golangci-lint` for Go).

## 3. Error Handling
- **No Silent Failures**: Never catch exceptions silently or swallow errors without logging or handling them appropriately.
- **Fail Fast & Explicitly**: Validate inputs at boundary layers (HTTP handlers, CLI inputs, event subscribers) and return clear, descriptive error messages.
- **Structured Error Responses**: HTTP APIs must return consistent, structured JSON error payloads (e.g., `{ "error": { "code": "NOT_FOUND", "message": "Item was not found" } }`).
- **Resource Cleanup**: Ensure database connections, file handles, and network sockets are closed using language idioms (context managers in Python, `defer` in Go, `try...finally` or `using` in TypeScript).

## 4. Automated Testing Expectations
- **Coverage where it Matters**: Core business logic, data transformations, API route handlers, and manifest contracts must have automated tests.
- **Test Independence**: Tests must be hermetic and repeatable. Do not depend on real external cloud APIs in automated test runs; use mocks, fakes, or local ephemeral containers.
- **Fast Feedback**: Unit test suites should execute in seconds.
- **Evidence Before Claims**: Never report a task as complete without executing tests locally and confirming exit code 0.
- **Standard Lifecycle Commands**: Every service must expose a `test` command in its `service.yaml` (e.g., `pytest`, `npm test`, `go test ./...`).
