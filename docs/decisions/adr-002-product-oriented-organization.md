# ADR-002: Product-Oriented Organization

## Status
Accepted

## Context
Applications in this monorepo often consist of multiple tiers or components: a web frontend, an HTTP API, a background worker, or a mobile client. We need an organizational structure that maintains clear mental boundaries, prevents spaghetti architectures, and ensures independent deployability.

## Decision
We organize applications by **product** under the `apps/` directory (e.g., `apps/<product>/`). Each product owns its services as subdirectories (e.g., `apps/fitness/web`, `apps/fitness/api`, `apps/fitness/worker`, `apps/fitness/mobile`).

Each service is an independent deployment and execution unit. Cross-product code sharing is restricted to explicitly published modules in `packages/`. Direct cross-product imports within `apps/` are forbidden.

## Rationale
- **Domain Cohesion**: All components delivering a product domain live together, allowing developers and AI agents to understand the full system context.
- **Independent Deployability**: Each service possesses its own lifecycle commands (dev, test, build) and deployment configuration.
- **Clear Ownership and Blast Radius**: Changes to `apps/fitness/api` do not affect `apps/finance/api`.
- **Natural AI Context Boundary**: An AI agent working on a specific product can focus on `apps/<product>/` without reading irrelevant code from other products.

## Alternatives Considered
- **Technical-Tier Organization (`frontends/`, `apis/`, `workers/`)**: Rejected because it scatters domain logic across disparate top-level folders, forcing developers and AI agents to jump across directories for a single feature.
- **Monolithic Multi-Tier Services (Single directory for API + Web + Worker)**: Rejected because it blurs deployment boundaries, couples runtimes, and prevents independent scaling or containerization.

## Consequences
- Every product must define a `product.yaml` manifest.
- Every service within a product must define a `service.yaml` manifest.
- Shared code must be factored out into `packages/` with explicit semantic contracts rather than ad-hoc imports.
