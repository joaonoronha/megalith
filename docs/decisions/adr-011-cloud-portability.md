# ADR-011: Cloud Portability and Secondary Provider (Google Cloud)

## Status
Accepted

## Context
[ADR-005](adr-005-hosting.md) selected Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 ARM64 instances as the primary hosting environment for Megalith. However, OCI Always Free compute capacity is subject to regional availability constraints and capacity exhaustion. When an operator cannot obtain an Ampere A1 instance in their registered home region, deployment cannot proceed without an alternative.

We need a secondary cloud hosting provider to maintain business continuity while preserving Megalith's single-node Docker Compose architecture, security model, and automated release pipeline without creating unnecessary abstraction layers or vendor lock-in.

## Decision
We introduce **Google Cloud Platform (GCP) Compute Engine** as an explicitly supported secondary cloud hosting provider alongside OCI.

We define strict architectural trust and lifecycle boundaries:
1. **Infrastructure Provisioning**: Separated into provider-specific Terraform modules under `platform/infra/<provider>/` (`platform/infra/oci/` and `platform/infra/gcp/`). Infrastructure modules describe VPC networking, firewall rules, compute instances, and cloud-init bootstrapping.
2. **Host Bootstrap**: Provider-tailored cloud-init templates configure the target operating system (Ubuntu 24.04 LTS), system packages, SSH daemon hardening, host firewall (UFW), Docker Engine with JSON log rotation, and directory skeletons (`/opt/megalith/deploy`).
3. **Container Workloads and Multi-Architecture Parity**: All application container images (`demo-api`, `demo-web`, Caddy, PostgreSQL) must be built for both `linux/arm64` (OCI Ampere A1) and `linux/amd64` (GCP Compute Engine e2 series).
4. **Application Deployment**: Docker Compose (`compose.yaml`, `compose.prod.yaml`), immutable release manifests, release verification, host concurrency locking, and safe rollbacks remain strictly **provider-agnostic**.
5. **Backup and Disaster Recovery**: Database dumps are encrypted using `age` X25519 and exported/retrieved via a provider-independent storage interface, allowing local simulation or synchronization with cloud object storage (OCI Object Storage / Google Cloud Storage) without embedding cloud SDKs in application containers.
6. **Provider Scope**: We explicitly reject building a generic multi-cloud framework or introducing Kubernetes / cross-cloud service meshes. We support exactly two target providers: OCI and GCP.

## Deployment Profiles
We define two explicit deployment profiles:
- **`full` (Production / Staging)**: Complete production stack (Caddy reverse proxy, FastAPI backend, React web frontend, PostgreSQL 16, Alembic migrations, encrypted backups, release verification, rollback). Recommended machine sizing: OCI `VM.Standard.A1.Flex` (2 OCPU, 12 GB RAM) or GCP `e2-standard-2` (2 vCPU, 8 GB RAM).
- **`micro` (Experimental Bootstrap Only)**: Deliberately constrained profile (`compose.micro.yaml`) designed solely to validate host bootstrap, SSH access, firewall ingress, Docker runtime, GHCR pull, and basic HTTP health on constrained hardware (such as GCP `e2-micro` with ~1 GB RAM). The `micro` profile is **strictly prohibited in production environments** and fails closed if attempted.

## Consequences
- Container CI must build and publish multi-arch images (`linux/arm64` and `linux/amd64`).
- Host preflight checks must inspect architecture, CPU, and RAM, validating suitability for the chosen deployment profile.
- Operational documentation must provide clear runbooks for both OCI and GCP deployments.
- OCI Terraform configuration is preserved untouched as a fully supported first-class target.
