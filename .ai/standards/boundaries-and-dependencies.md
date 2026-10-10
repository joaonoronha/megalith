# Engineering Standard: Boundaries and Dependencies

## 1. Scope
This standard defines structural boundaries, dependency rules, and code-sharing constraints across products, services, and platform tooling.

## 2. Product Isolation
- **Domain Independence**: Each product under `apps/<product-id>` is an autonomous domain boundary.
- **No Direct Cross-Product Code Imports**: Code in `apps/product-a` MUST NOT import or directly reference source files from `apps/product-b`.
- **Database Isolation**: A product must only access its dedicated database (`db_<product_id>`). Cross-database queries or shared tables are strictly forbidden.
- **Inter-Product Communication**: If two products must communicate, they must do so via public network APIs (REST, gRPC, webhooks) with appropriate authentication.

## 3. Service Boundaries
- **Autonomous Deployability**: Each service under `apps/<product-id>/<service-id>` represents an independently deployable and runnable unit.
- **Service Declarations**: Every service must define its own `service.yaml` specifying commands, runtime, artifact format, and deployment target.
- **Dependencies**: Inter-service dependencies within a product (e.g. `web` depending on `api`) must be declared in `service.yaml` under `dependencies.services` using qualified IDs (`<product>/<service>`).

## 4. Shared Code via Packages
- **Location**: Truly reusable code, domain-agnostic utilities, and common protocol definitions belong in `packages/<package-id>`.
- **High Bar for Sharing**: Do not prematurely extract code to `packages/`. Code should be duplicated once before abstracting, unless it is a core platform client or type definition.
- **Package Contracts**: Shared packages must have clear interfaces, documentation, and independent test suites.

## 5. Third-Party Dependencies
- **Check Existing Dependencies**: Inspect existing lockfiles and package manifests before adding new dependencies.
- **Native Ecosystem Tooling**: Use native package managers (`pnpm`/`npm`, `uv`/`pip`, `go mod`) within each service.
- **Minimize Dependencies**: Avoid single-function or unmaintained third-party packages.
