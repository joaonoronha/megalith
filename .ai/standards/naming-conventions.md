# Engineering Standard: Naming Conventions

## 1. Scope
This standard defines naming conventions for repositories, products, services, directories, and identifiers across the Megalith monorepo.

## 2. Repository & Directory Structure
- **Root Folders**: Lowercase alphanumeric, standard words (e.g., `apps`, `packages`, `platform`, `tooling`, `docs`).
- **Product Folders**: `apps/<product-id>` using kebab-case.
- **Service Folders**: `apps/<product-id>/<service-id>` using kebab-case.
- **Shared Package Folders**: `packages/<package-id>` using kebab-case.

## 3. Product & Service Identifiers
- **Product IDs**: Must be lowercase-kebab-case matching regex `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - Examples: `fitness`, `finance-tracker`, `home-automation`
  - Anti-patterns: `FitnessApp`, `fitness_api`, `fitness-`
- **Service IDs**: Must be lowercase-kebab-case matching regex `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - Common service IDs: `web`, `api`, `worker`, `mobile`, `cli`
  - Anti-patterns: `API`, `fitness_worker`
- **Qualified Service Identifiers**: Always formatted as `<product-id>/<service-id>`.
  - Examples: `fitness/api`, `fitness/web`, `finance-tracker/worker`

## 4. Git Branches & Commits
- **Branch Naming**:
  - `feat/<product-or-area>/<short-desc>` (e.g., `feat/fitness/workout-endpoint`)
  - `fix/<product-or-area>/<short-desc>` (e.g., `fix/platform/validator-path`)
  - `chore/<short-desc>` (e.g., `chore/bump-deps`)
- **Commit Messages**: Conventional commits format:
  - `<type>(<scope>): <summary>`
  - Examples: `feat(fitness/api): add session logging endpoint`, `docs(adrs): add ADR-004 for platform CLI`

## 5. File Naming
- **Configuration & Manifests**: Lowercase YAML files (`projects.yaml`, `product.yaml`, `service.yaml`, `docker-compose.yml`).
- **Documentation**: Markdown files in lowercase-kebab-case (`naming-conventions.md`, `adr-001-monorepo-strategy.md`) or uppercase for root platform standards (`README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`).
