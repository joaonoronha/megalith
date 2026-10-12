# Megalith Production Readiness & Operational Hardening

This document provides a comprehensive audit and specification of the operational readiness, security boundaries, and disaster recovery architecture implemented in **Task 010**.

---

## 1. Production Readiness Objectives Summary

| Area | Production Requirement | Implementation & Enforcement | Local Verification Evidence |
|---|---|---|---|
| **Deployment Authorization** | Independent of release manifests; immutable releases; prevent forged approvals. | Manifest Schema v2 (`release.schema.json`) + Operator Authorization Schema v1 (`authorization.schema.json`). Authorization binds operator identity, target environment, and canonical SHA-256 manifest digest. Self-declared approvals in manifests cannot self-authorize. | `tooling/verify_operations.py` (Scenarios 1–3), `tooling/tests/test_release_manifest.py`. |
| **CI Provenance** | Fail-closed exact-commit CI verification. | `verify_ci_provenance.py` queries GitHub Actions runs enforcing exact Git SHA, workflow identity (`ci.yaml`), repository name, and head branch. | `tooling/tests/test_ci_provenance.py`. |
| **Crash Safety** | Crash-safe deployment state; interrupted operation recovery. | Durable state machine with `os.fsync` on both file and directory before mutation. Phase transitions (`prepared` -> `migrating` -> `applying` -> `verifying` -> `succeeded`). `deploy.py recover` inspects container state and live Alembic revision. Zero automatic database drops/downgrades. | `tooling/verify_operations.py` (Scenarios 6–10), `tooling/tests/test_deployment_state.py`. |
| **Encrypted Backups** | Authenticated encryption, zero plaintext on disk, off-host export. | `age` (X25519) streaming directly from `pg_dump` through UNIX pipe. Manifest `.meta.json` with SHA-256 digest, Alembic revision, export status. Atomic export to off-host target. | `tooling/verify_operations.py` (Scenarios 11–14), `tooling/tests/test_backup_retention.py`. |
| **Clean-Environment Restore** | Prove backup recoverability in clean environment. | `restore.py drill` decrypts into a clean temporary database, validates schema & tables, asserts primary database was untouched, marks `verified_restorable: true`, and tears down drill DB. | `tooling/verify_operations.py` (Scenarios 15–17). |
| **Retention Policy** | Fail-closed backup retention. | `prune_backups` enforces minimum retention, blocks pruning if backup/export/restore-drill failed, and never prunes the last verified restorable backup. | `tooling/verify_operations.py` (Scenarios 18–19), `tooling/tests/test_backup_retention.py`. |
| **Resource Safeguards** | Host resource thresholds before mutation. | `preflight.py` asserts >=5 GB disk headroom on state partition, >=1024 MB available RAM, OS/CPU architecture (`aarch64`), Docker daemon availability, and port bindings. | `tooling/verify_operations.py` (Scenario 21), `platform/deploy/scripts/preflight.py`. |
| **Logging & Audit Trail** | Tamper-resistant local audit records. | Host deployment audit log `/var/lib/megalith/audit.log` written with mode `0600` for every transaction attempt, transition, success, failure, and rollback. Docker `json-file` log rotation capped at 20MB / 3 files. | `platform/deploy/scripts/deploy.py`, `platform/deploy/compose.yaml`. |
| **Proxy Header Trust** | Strict forwarded proxy headers. | Static Caddy IP `172.28.0.10` scoped strictly to `compose.prod.yaml`. FastAPI `FORWARDED_ALLOW_IPS: "127.0.0.1,172.28.0.10"` rejects header spoofing from untrusted containers. | `platform/deploy/compose.prod.yaml`, `tooling/tests/test_merged_compose.py`. |
| **Operational Preflight** | Non-destructive pre-deployment checks. | `preflight.py` CLI checks OS, Docker, Compose v2, RAM, disk, ports, and directory permissions without mutating system state. | `tooling/verify_operations.py` (Scenario 21). |

---

## 2. Security Boundaries & Threat Model

### Threat: Forged Release Manifest Approval
* **Risk**: An attacker with commit rights to a feature branch modifies a release manifest's JSON to declare `"authorized_by": "lead-platform-engineer"`.
* **Mitigation**: Release manifest Schema v2 rejects embedded approvals as authorization. The deployment engine strictly requires a separate `DeploymentAuthorization` object. The authorization must match the target environment and the canonical SHA-256 digest of the manifest's immutable content.

### Threat: Man-in-the-Middle Header Spoofing
* **Risk**: A malicious peer container on the Docker network sends forged `X-Forwarded-For` or `X-Forwarded-Proto` headers to backend services.
* **Mitigation**: Backend services configure `FORWARDED_ALLOW_IPS: "127.0.0.1,172.28.0.10"`. FastAPI and Uvicorn only accept proxy headers when arriving from the trusted Caddy proxy IP.

### Threat: Unattended Remote Deployment Hijacking
* **Risk**: A compromised CI token or repository actor triggers an unattended workflow that pushes and deploys untrusted code directly to the host.
* **Mitigation**: Remote deployment via GitHub Actions is disabled by default. Deployment is operator-initiated on the host using explicit authorization records with `0600` permissions.

### Threat: Silent Database Corruption During Rollback
* **Risk**: An automated rollback reverts application code to an older version after a breaking schema migration has been applied.
* **Mitigation**: The deployment engine inspects the release's migration declarations. If any migration has `backward_compatible: false`, automated container rollback is blocked. If an interrupted deployment is recovered, the live Alembic revision is inspected against the target; incompatible revisions block automated rollback and require manual operator database restoration.

---

## 3. Operational Preflight Verification

The non-mutating preflight checker (`platform/deploy/scripts/preflight.py`) validates:
1. **Host Architecture**: `aarch64` / ARM64 or compatible Linux kernel.
2. **Docker Daemon**: Reachability and Compose v2 plugin availability.
3. **Resource Headroom**:
   - Disk space on the target state directory: `>= 5.0 GB` free.
   - Host memory: `>= 1024 MB` available RAM.
4. **Port Availability**: Loopback ports `80` and `443` free from port conflicts.
5. **State Directory Permissions**: Validates that state directories exist or can be created with restricted permissions (`0700` or `0750`).

Run preflight checks at any time:
```bash
python3 platform/deploy/scripts/preflight.py
```

---

## 4. Disaster Recovery Drills & Automated Verification

Megalith includes an automated test harness covering all 22 failure-injection and operational resilience scenarios in `tooling/verify_operations.py`:

```bash
python3 tooling/verify_operations.py
```

### Scenario Breakdown:
1. **Scenario 1**: Validate trusted Schema v2 release manifest.
2. **Scenario 2**: Reject forged self-approval block in manifest.
3. **Scenario 3**: Reject deployment authorization referencing a mismatched release ID.
4. **Scenario 4**: Unit-test exact-commit CI verification with workflow identity checks.
5. **Scenario 5**: Execute an isolated deployment with verified operator authorization.
6. **Scenario 6**: Interruption simulation prior to container application (`prepared` phase).
7. **Scenario 7**: Interruption simulation during `verifying` phase.
8. **Scenario 8**: Execute `deploy.py recover` and verify safe rollback.
9. **Scenario 9**: Confirm active state restored to last-known-good release.
10. **Scenario 10**: Verify database counter data and Alembic schema remain durable.
11. **Scenario 11**: Create encrypted PostgreSQL logical backup with `age` (X25519).
12. **Scenario 12**: Validate ciphertext SHA-256 checksum against `.meta.json`.
13. **Scenario 13**: Reject decryption with incorrect X25519 private key.
14. **Scenario 14**: Reject corrupted ciphertext during restore.
15. **Scenarios 15–17**: Automated clean-environment restore drill in isolated database, verifying restored counter, Alembic revision, and asserting primary database untouched.
16. **Scenario 18**: Simulate unavailable off-host backup destination.
17. **Scenario 19**: Verify fail-closed retention pruning guards.
18. **Scenario 20**: Verify deployment concurrency lock (`deploy.lock`).
19. **Scenario 21**: Verify resource preflight rejects low disk space.
20. **Scenario 22**: Clean teardown of isolated test-owned resources.

---

## 5. Distinction Between Local Verification and Live OCI Activation

| Capability | Verified Locally in Task 010 | Reserved for Live OCI Host Activation |
|---|---|---|
| **Container & Network Isolation** | Verified in isolated Docker Compose projects with bridge networks. | Enforced by host iptables and OCI Virtual Cloud Network security lists. |
| **Reverse Proxy & TLS** | Caddy reverse proxy routing, security headers, and mock HTTPS verified. | Public Let's Encrypt TLS issuance via ACME over public ports 80/443. |
| **Host Resources** | Validated via non-mutating preflight check against local filesystem/RAM. | Enforced against OCI Ampere A1 instance (4 OCPUs, 24 GB RAM, 200 GB volume). |
| **PostgreSQL Backups** | Zero-plaintext streaming `age` encryption, checksums, clean restore drills. | Scheduled via systemd timer syncing to OCI Object Storage cold bucket. |
| **Terraform Configuration** | Validated with `terraform fmt` and `terraform validate`. | `terraform apply` to provision real VCN, subnet, security lists, and Compute VM. |
