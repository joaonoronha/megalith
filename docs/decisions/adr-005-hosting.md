# ADR-005: Hosting Strategy

## Status
Accepted

## Context
We need a hosting environment for 6–15 personal applications and supporting platform infrastructure (PostgreSQL, Caddy). The solution must be cost-effective, maintainable by a single operator, have sufficient computing headroom, and avoid excessive complexity.

## Decision
We host applications on an **Oracle Cloud Infrastructure (OCI) Always Free ARM64 VM** (Ampere A1 architecture, up to 4 OCPUs, 24 GB RAM) managed with **Docker** and **Docker Compose**. We explicitly reject Kubernetes.

Infrastructure provisioning recipes and host setup scripts will reside in `platform/infra/oci/`, and compose definitions in `platform/deploy/`.

## Rationale
- **Resource Headroom**: 4 OCPUs and 24 GB of RAM provide ample headroom to run 15+ containerized services, PostgreSQL, and Caddy concurrently at near-zero operating cost.
- **Operational Simplicity**: Docker Compose is declarative, widely understood, and eliminates the multi-node distributed failure modes of Kubernetes.
- **Low Cognitive Overhead**: A solo engineer assisted by AI coding agents can inspect running containers via `docker compose ps` and `docker logs` without navigating complex cluster abstractions.
- **Determinism**: Containers package dependencies identically between local testing and production deployment.

## Alternatives Considered
- **Kubernetes (k3s / k8s)**: Rejected because ingress controllers, persistent volume claims, daemonsets, and control plane memory overhead introduce excessive complexity for a single-node personal setup.
- **Serverless / PaaS (Vercel, Render, Fly.io, Railway)**: Rejected due to compounding monthly costs across 10+ services, cold-start latencies, and vendor lock-in.

## Consequences
- Single-node availability: Hardware failures or host maintenance will incur transient downtime (acceptable for personal products).
- Target architecture is `linux/arm64`: All deployed container images must be built for ARM64 or multi-arch.
- Host configuration (OS hardening, firewall, Docker daemon) must be documented and repeatable.
