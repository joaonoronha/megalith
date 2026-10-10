# ADR-001: Monorepo Strategy

## Status
Accepted

## Context
The platform will host between 6 and 15 independent personal applications over time. These products span diverse domains (e.g., fitness, finance, productivity) and technologies (TypeScript, Python, Go, React Native), but share common platform requirements:
- Infrastructure definitions (OCI ARM64, Caddy ingress, PostgreSQL).
- Shared development tooling and platform CLI.
- Standardized AI coding instructions, schemas, and engineering policies.
- A single human operator assisted by AI coding agents.

Maintaining separate Git repositories for each product and service leads to tooling divergence, cross-repo dependency coordination friction, and fragmented context for AI coding agents.

## Decision
We adopt a single Git repository (monorepo) containing all products (`apps/`), shared packages (`packages/`), platform definitions (`platform/`), and tooling (`tooling/`).

## Rationale
- **Single Source of Truth**: All manifests, schemas, deployment configurations, and AI instructions reside in one repository.
- **Atomic Platform Evolution**: Updates to tooling, schemas, or CI/CD pipelines can be validated and applied across all products in a single commit.
- **AI Agent Context**: AI coding agents have full visibility into platform conventions, schemas, and adjacent reference implementations.
- **Operational Simplicity**: A single repository simplifies Git operations, access control, and issue tracking for a solo maintainer.

## Alternatives Considered
- **Multi-Repo (Repository per product/service)**: Rejected because it introduces repository proliferation, configuration drift, difficult version synchronization of platform tooling, and high operational overhead.
- **Split Tooling and Application Repos**: Rejected because schema changes in the platform repository would require cross-repository coordination with application repositories.

## Consequences
- Requires clear directory boundaries to prevent unintended cross-product coupling.
- Tooling must support selective testing, building, and deployment so unaffected services are not rebuilt.
- Binary assets and large datasets must not be committed to Git to keep repository clone times fast.
