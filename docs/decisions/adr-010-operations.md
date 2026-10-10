# ADR-010: Operations and Observability

## Status
Accepted

## Context
Running 6–15 personal applications on a single OCI ARM64 virtual machine requires a pragmatic operational model. We must ensure services are healthy, failures are quickly detectable, rollbacks are fast and reliable, and persistent data is protected against hardware loss or human error without running heavy enterprise monitoring clusters.

## Decision
We establish standard operational baselines across all services and shared platform components:
1. **Health Checks**: Every deployable service must expose an HTTP health endpoint (e.g., `GET /health` or `/live`) and declare a Docker `HEALTHCHECK` in its container definition or Compose configuration.
2. **Deterministic Rollback**: Deployments are pinned to immutable image digests (`sha256:...`). Rollbacks are executed by reverting the image digest reference in the deployment configuration and recreating the container.
3. **Structured Logging**: Services must emit structured logs (JSON or key-value format) to `stdout`/`stderr`. Docker's default `json-file` log driver with log rotation (max size 20MB, max 3 files) manages disk consumption.
4. **Automated Off-Host Backups**: A scheduled backup cron dumps product databases via `pg_dump`, encrypts the backup archives with GPG/age, and synchronizes them to an off-host object storage bucket (e.g., OCI Object Storage / S3-compatible bucket).
5. **Periodic Restore Verification**: Backup procedures must document and support test restores to guarantee recovery viability.

## Rationale
- **High Signal, Low Overhead**: HTTP health checks and Docker log rotation prevent runaway disk filling and enable automated container recovery without installing heavy monitoring daemons.
- **Disaster Recovery**: Off-host backups ensure that even if the OCI tenancy or VM is lost, product databases can be completely restored on a new host.
- **Fast Recovery**: Digest-based rollbacks take seconds and require zero rebuild time.

## Alternatives Considered
- **Full Observability Stack (Prometheus + Grafana + Loki + OpenTelemetry)**: Rejected because running metric scrapers, agents, and storage daemons consumes several gigabytes of RAM and substantial CPU, which is wasteful on a single personal VM.
- **Manual Backups**: Rejected because manual routines are inevitably forgotten, risking total data loss.
- **On-Host Only Backups**: Rejected because VM corruption or host deletion destroys both the primary data and the backups.

## Consequences
- Every API and web service must implement a lightweight `/health` check returning HTTP 200.
- Off-host backup storage bucket and credentials must be provisioned during host infrastructure setup.
- Log rotation settings must be globally configured in `/etc/docker/daemon.json` or compose files.
