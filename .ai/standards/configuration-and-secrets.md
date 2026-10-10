# Engineering Standard: Configuration and Secrets Handling

## 1. Scope
This standard establishes rules for configuration management, environment variables, and zero-leakage secrets handling across development, CI/CD, and production.

## 2. Configuration Management (12-Factor App)
- **Environment Parity**: Applications must strictly follow 12-factor configuration principles: store configuration in environment variables, not in hardcoded source files.
- **Typed Configuration**: In Python services use `pydantic-settings`; in TypeScript services use `zod` or `t3-oss/env-core`; in Go services use structured environment parsers. Validate configuration at startup and fail fast if required variables are missing.
- **Default Values**: Safe defaults may be provided for local development, but production secrets must never have default values in code.

## 3. Secrets Handling & Prevention
- **Zero Secrets in Git**: No API keys, database passwords, OAuth secrets, private keys (`.pem`, `.key`), or sensitive tokens may ever be committed to the repository.
- **Gitignore Enforcement**: Root `.gitignore` explicitly excludes `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `*.cert`.
- **Environment Examples**: Every service requiring environment variables must maintain a `.env.example` file containing descriptive placeholder values:
  ```env
  # .env.example
  DATABASE_URL=postgresql://user:password@localhost:5432/db_name
  PORT=8000
  API_KEY=your_api_key_here
  ```
- **Production Secret Injection**: Secrets are injected at runtime via Docker environment files (`.env.production` on the OCI host, never committed) or GitHub Actions Secrets for CI.
- **Immediate Revocation**: If a secret is accidentally committed to Git, it must be considered compromised and rotated immediately, regardless of repository visibility.
