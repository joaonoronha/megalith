# Infrastructure Architecture: OCI Always Free ARM64 Foundation

This document defines the cloud infrastructure architecture for Megalith, designed to host 6–15 personal applications and supporting shared services (PostgreSQL, Caddy) on a single **Oracle Cloud Infrastructure (OCI)** Always Free ARM64 virtual machine.

---

## 1. Architectural Principles & ADR Alignment

The infrastructure foundation is governed by accepted Architecture Decision Records:
- **[ADR-005: Hosting Strategy](../decisions/adr-005-hosting.md)**: Single-node OCI Ampere A1 ARM64 VM (`VM.Standard.A1.Flex`), managed with Docker Compose. Kubernetes is explicitly rejected to eliminate control-plane overhead and distributed failure modes.
- **[ADR-006: Public Ingress](../decisions/adr-006-public-ingress.md)**: Caddy reverse proxy on ports 80 and 443 with automatic TLS certificate lifecycle management.
- **[ADR-007: Persistence Strategy](../decisions/adr-007-persistence.md)**: Single shared PostgreSQL daemon container with isolated databases and credentials per product.
- **[ADR-008: CI/CD Strategy](../decisions/adr-008-cicd.md)**: Independent, selective GitHub Actions verification; builds target `linux/arm64`.
- **[ADR-010: Operations and Observability](../decisions/adr-010-operations.md)**: Minimal operational footprint, Docker daemon log rotation (max 20MB, 3 files), and off-host automated backups.

---

## 2. Infrastructure Topology

```text
                           Internet
                              │
                    ┌─────────┴─────────┐
                    │ HTTPS :443        │ HTTP :80
                    ▼                   ▼
             OCI Public IPv4 (Assigned to VM VNIC)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
       OCI Virtual Cloud Network (VCN: 10.0.0.0/16)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
       OCI Public Subnet (10.0.1.0/24; Route Table -> IGW)
                              │
       ┌──────────────────────┴──────────────────────┐
       │   OCI Network Security Group (NSG)          │
       │   - Inbound SSH :22 (var.ssh_admin_cidr)    │
       │   - Inbound HTTP :80 (0.0.0.0/0)            │
       │   - Inbound HTTPS :443 (0.0.0.0/0)          │
       │   - Outbound Egress: All traffic            │
       └──────────────────────┬──────────────────────┘
                              │
                              ▼
        OCI Compute: VM.Standard.A1.Flex (ARM64)
        - Shape: VM.Standard.A1.Flex (Hard-pinned, no fallback)
        - Baseline Sizing: 2 OCPUs, 12 GB RAM, 50 GB Boot Volume
        - Operating System: Canonical Ubuntu 24.04 LTS ARM64
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            Host Security Controls (UFW, SSH Hardening)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            Docker Engine & Compose Plugin (ARM64)
            - Daemon Log Rotation: max-size 20m, max-file 3
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         Megalith Deployment Target (/opt/megalith/deploy)
         - Caddy (future ingress controller)
         - Docker Compose application services (future)
         - PostgreSQL (future persistence)
```

---

## 3. Component Details & Security Model

### 3.1 Network Isolation & Least-Privilege Exposure
- **Dedicated VCN**: All Megalith resources reside in a dedicated VCN (`10.0.0.0/16`) isolated from any other cloud workloads.
- **Default Security List Suppression**: OCI creates default security lists that expose SSH (port 22) to `0.0.0.0/0`. Megalith attaches a restrictive custom security list to the subnet with zero open ingress ports, moving all ingress definitions into an explicit **Network Security Group (NSG)** attached directly to the instance VNIC.
- **SSH Ingress Protection**:
  - Administrative SSH access is restricted to `var.ssh_admin_cidr`.
  - Variable validation actively forbids `0.0.0.0/0` and requires a valid CIDR block.
  - SSH uses key-based authentication exclusively; password authentication and root password logins are disabled via cloud-init.
- **Port Exposure Policy**:
  - Allowed ingress: TCP 80 (HTTP), TCP 443 (HTTPS), TCP 22 (SSH from admin CIDR).
  - Explicitly forbidden ingress: TCP 5432 (PostgreSQL), TCP 8000 (FastAPI), TCP 8080 (Web), TCP 2375/2376 (Docker daemon).

### 3.2 Compute Sizing & Always Free Eligibility
- **Target Shape**: `VM.Standard.A1.Flex` (Ampere A1 ARM64).
- **No Paid Fallback**: To prevent accidental cloud billing, no fallback logic exists in Terraform. If free-tier Ampere capacity is exhausted in the target AD, Terraform fails cleanly rather than allocating paid x86 compute.
- **Conservative Allocation**:
  - Tenancy Always Free allowance: 4 OCPUs, 24 GB RAM, 200 GB storage.
  - Megalith allocation: 2 OCPUs, 12 GB RAM, 50 GB boot volume.
  - Headroom remaining: 2 OCPUs, 12 GB RAM, 150 GB storage.

### 3.3 Host Bootstrap via Cloud-Init
Host initialization prepares the virtual machine without embedding credentials or application artifacts:
1. **User configuration**: Creates a non-root administrative user (`ubuntu`) with sudo rights and public-key authentication.
2. **Hardening**: Disables password authentication and direct root login.
3. **Firewall**: Configures UFW with a default-deny policy, explicitly opening port 22 prior to activation to prevent administrative lockout.
4. **Runtime**: Installs Docker Engine and Compose plugin from the official Docker ARM64 apt repository.
5. **Log Rotation**: Configures `/etc/docker/daemon.json` with `max-size: 20m` and `max-file: 3` to satisfy ADR-010 and prevent host disk exhaustion.
6. **Skeleton**: Creates `/opt/megalith/deploy` directory structure ready for future platform deployment.

---

## 4. Operational Management

Infrastructure code resides in `platform/infra/oci/`. Detailed operational procedures for account setup, planning, manual provisioning, and teardown are documented in the **[OCI Provisioning Operations Guide](../operations/oci-provisioning.md)**.
