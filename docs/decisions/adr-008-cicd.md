# ADR-008: CI/CD Strategy

## Status
Accepted

## Context
In a monorepo with 6–15 products, a change in one service must not trigger rebuilding or redeploying the entire repository. Furthermore, builds must target the production architecture (`linux/arm64`) and deployments must be predictable, reproducible, and easily rolled back.

## Decision
We use **GitHub Actions** for CI/CD with the following rules:
1. **Independent Triggers**: Workflows use Git path filters (e.g., `paths: apps/fitness/api/**`) so only modified services trigger CI and CD pipelines.
2. **ARM64 Native Images**: Container images are built for `linux/arm64` (utilizing GitHub Actions ARM runners or Docker Buildx with QEMU/cache optimization).
3. **Immutable Image Digests**: Container images are tagged with Git commit SHA and deployed using immutable cryptographic digests (`sha256:...`) rather than mutable tags like `latest`.
4. **Independent Service Deployments**: Deployments update only the targeted service's compose definition or container instance on the host VM.

## Rationale
- **Minimal Waste and Fast CI**: Changes to one product do not queue builds for unrelated products.
- **Auditability and Immutability**: Pinning deployments to immutable SHA digests guarantees that the exact tested artifact is deployed and makes rollbacks deterministic.
- **Architectural Parity**: Building for ARM64 prevents runtime binary incompatibilities on the OCI Ampere A1 production VM.
- **Simplicity**: Leverages native GitHub Actions tooling without self-hosting third-party CI orchestration servers.

## Alternatives Considered
- **Monolithic Build All Pipeline**: Rejected because build times grow linearly with the number of products, wasting CI runner minutes and slowing feedback loops.
- **Deploying Mutable `:latest` Tags**: Rejected because mutable tags create non-reproducible deployments, prevent reliable rollbacks, and obscure what code is running in production.
- **Self-Hosted CI Server (Jenkins/Drone)**: Rejected due to maintenance overhead, security patching, and resource costs.

## Consequences
- Workflows must maintain clear path definitions or leverage reusable workflow templates.
- Emulated ARM64 builds on x86_64 runners can be slower; using GitHub-hosted ARM runners or Docker layer caching is recommended.
- Deployment secrets (SSH keys, registry tokens) must be scoped and securely stored in GitHub Actions secrets.
