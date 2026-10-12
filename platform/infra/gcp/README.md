# Megalith Google Cloud Infrastructure Foundation

This directory contains the Terraform configuration for provisioning a single-node hosting foundation on **Google Cloud Platform (GCP) Compute Engine**.

> **CRITICAL POLICY NOTICE**:
> Infrastructure code here must **never** be applied automatically. All cloud provisioning operations require human review, local execution, and explicit operator authorization. Do not commit state files, private keys, or API credentials to this repository.

---

## 1. Architecture Overview

In alignment with [ADR-005](../../../docs/decisions/adr-005-hosting.md) and [ADR-011](../../../docs/decisions/adr-011-cloud-portability.md), Megalith utilizes a single-node architecture running Docker Compose behind Caddy on a Compute Engine virtual machine.

```text
                           Internet
                               │
                    ┌──────────┴──────────┐
                    │ HTTPS :443          │ HTTP :80
                    ▼                     ▼
             GCP External IPv4 (Compute Engine Instance)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
        GCP Virtual Private Cloud (VPC: megalith-vpc)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
        GCP Dedicated Subnet (10.10.0.0/24; us-central1)
                               │
        ┌──────────────────────┴──────────────────────┐
        │   GCP Firewall Rules (VPC Level)            │
        │   - Inbound SSH :22 (var.ssh_admin_cidr)    │
        │   - Inbound HTTP :80 (0.0.0.0/0)            │
        │   - Inbound HTTPS :443 (0.0.0.0/0)          │
        │   - Outbound Egress: Default allow          │
        └──────────────────────┬──────────────────────┘
                               │
                               ▼
         Compute Engine: e2-standard-2 / e2-micro (x86_64)
         - Sizing:
             * Full Profile : e2-standard-2 (2 vCPU, 8 GB RAM, 30 GB Disk)
             * Micro Profile: e2-micro (2 vCPU burst, 1 GB RAM, 30 GB Disk) [Experimental only!]
         - OS: Canonical Ubuntu 24.04 LTS (x86_64 / amd64)
         - Bootstrap: cloud-init (Docker CE, UFW, non-root user)
```

---

## 2. Directory Structure

```text
platform/infra/gcp/
├── .gitignore               # Strict exclusion of state, tfvars, plans, logs
├── versions.tf              # Terraform CLI and hashicorp/google provider constraints
├── providers.tf             # Google provider definition (project, region, zone parameterized)
├── variables.tf             # Input variables with strict validation rules
├── network.tf               # Custom VPC, Subnet, Firewall rules
├── compute.tf               # Compute Engine VM, Shielded VM, cloud-init user-data
├── cloud-init.yaml.tftpl    # Host bootstrap: hardening, UFW, Docker Engine & Compose for x86_64
├── outputs.tf               # Non-sensitive infrastructure outputs
├── terraform.tfvars.example # Example variable values with sanitized placeholders
└── README.md                # Infrastructure documentation (this file)
```

---

## 3. Resource Specifications & Security Baseline

### Networking & Firewall Rules
- **VPC Network (`google_compute_network`)**: Custom subnet mode (`auto_create_subnetworks = false`) preventing default subnet sprawl.
- **Subnet (`google_compute_subnetwork`)**: Dedicated CIDR block `10.10.0.0/24` in the configured region.
- **Firewall Rules**:
  - **SSH (TCP 22)**: Restricted strictly to `var.ssh_admin_cidr`. Variable validation prohibits `0.0.0.0/0`.
  - **HTTP (TCP 80)**: Open to internet for Let's Encrypt ACME HTTP-01 challenges and HTTPS redirection.
  - **HTTPS (TCP 443)**: Open to internet for Caddy edge reverse proxy.
  - **Internal Ports**: Ports `5432` (PostgreSQL), `8000` (FastAPI), `8080` (Demo Web), and Docker daemon sockets are **not** exposed to the internet.
- **Zero Heavy Infrastructure**: No Google Cloud Load Balancers, Cloud NAT, Cloud Routers, or Cloud SQL instances are used.

### Compute Engine VM
- **Operating System**: Canonical Ubuntu 24.04 LTS (`amd64`).
- **Shielded VM**: Secure Boot, vTPM, and Integrity Monitoring enabled.
- **Service Account**: Minimal service account with empty OAuth scopes (`scopes = []`) preventing the VM from calling GCP APIs with default broad credentials.
- **Cloud-Init Bootstrap**:
  - Administrative user configured with sudo rights and the provided SSH public key.
  - SSH daemon hardened (password authentication disabled, root login restricted).
  - UFW host firewall configured with default-deny incoming before enabling.
  - Docker Engine and Docker Compose plugin installed from the official Docker apt repository for `amd64`.
  - Docker daemon log rotation configured in `/etc/docker/daemon.json` (`max-size: 20m`, `max-file: 3`) per [ADR-010](../../../docs/decisions/adr-010-operations.md).
  - Platform directory skeleton created at `/opt/megalith/deploy`.

---

## 4. Honest Profiles: Full vs. Micro

| Feature | Full Profile (Production) | Micro Profile (Experimental Smoke Test Only) |
|:---|:---|:---|
| **Intended Environment** | `production`, `staging` | `test`, bootstrap validation |
| **Recommended Machine** | `e2-standard-2` (2 vCPU, 8 GB RAM) | `e2-micro` (2 vCPU burstable, 1 GB RAM) |
| **Supported Workload** | Caddy, FastAPI, React Web, PostgreSQL 16, Migrations, age backups | Minimal HTTP health smoke test (`compose.micro.yaml`) |
| **Database Support** | Full PostgreSQL with isolated roles | In-memory or none; Postgres will OOM on 1 GB RAM |
| **Production Use** | **Supported** | **FORBIDDEN (fails closed if attempted)** |
| **Approximate Monthly Cost** | ~$48/mo compute + ~$3.60/mo IPv4 | Free tier compute eligible; ~$3.60/mo for IPv4 |

---

## 5. Cost Considerations & Free Tier Realities

1. **e2-micro Free Tier**: Google Cloud offers 1 non-preemptible `e2-micro` VM per month in US regions (`us-central1`, `us-east1`, `us-west1`).
2. **Persistent Disk Free Tier**: 30 GB of Standard Persistent Disk (`pd-standard`) per month is free. Selecting `pd-balanced` or `pd-ssd` incurs charges.
3. **Public IPv4 Charges**: Google Cloud charges approximately **$0.005/hour** for all external IPv4 addresses, even when attached to a running VM. Expect approximately **$3.60/month** in networking charges for a VM with an external IPv4 address.
4. **Egress Traffic**: 1 GB of egress per month to worldwide destinations (excluding China and Australia) is included.
5. **Budget Alerts**: Always configure a budget and budget alerts in Google Cloud Billing before creating resources.

---

## 6. Local Validation Workflow

```bash
# 1. Format configuration
terraform -chdir=platform/infra/gcp fmt -check

# 2. Initialize provider (without backend or remote state)
terraform -chdir=platform/infra/gcp init -backend=false

# 3. Validate syntax and resource definitions
terraform -chdir=platform/infra/gcp validate
```
