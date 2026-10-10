# Megalith OCI Always Free ARM64 Infrastructure Foundation

This directory contains the Terraform configuration for provisioning the single-node hosting foundation for Megalith on **Oracle Cloud Infrastructure (OCI)** using Always Free **Ampere A1 ARM64** compute resources.

> **CRITICAL POLICY NOTICE**:
> Infrastructure code here must **never** be applied automatically. All cloud provisioning operations require human review, local execution, and explicit authorization. Do not commit state files, private keys, or API credentials to this repository.

---

## 1. Architecture Overview

In alignment with [ADR-005](../../../docs/decisions/adr-005-hosting.md), Megalith utilizes a single-node architecture running Docker Compose behind Caddy on an Ampere A1 ARM64 virtual machine.

```text
                           Internet
                              │
                    ┌─────────┴─────────┐
                    │ HTTPS :443        │ HTTP :80
                    ▼                   ▼
             OCI Public IPv4 (Assigned to VNIC)
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
        - Shape: VM.Standard.A1.Flex (Fixed, no paid fallback)
        - Sizing: 2 OCPUs, 12 GB RAM, 50 GB Boot Volume
        - OS: Canonical Ubuntu 24.04 LTS (ARM64)
        - Bootstrap: cloud-init (Docker CE, UFW, non-root user)
```

---

## 2. Directory Structure

```text
platform/infra/oci/
├── .gitignore               # Strict exclusion of state, tfvars, plans, logs
├── .terraform.lock.hcl      # Committed provider dependency lockfile
├── versions.tf              # Terraform CLI and oracle/oci provider constraints
├── providers.tf             # OCI provider definition (region parameterized)
├── variables.tf             # Input variables with strict validation rules
├── network.tf               # VCN, Internet Gateway, Route Table, Subnet, NSG rules
├── compute.tf               # Availability domain, ARM64 image data sources, VM resource
├── cloud-init.yaml.tftpl    # Host bootstrap: hardening, UFW, Docker Engine & Compose
├── outputs.tf               # Non-sensitive infrastructure outputs
├── terraform.tfvars.example # Example variable values with sanitized placeholders
└── README.md                # Infrastructure documentation (this file)
```

---

## 3. Resource Specifications

### Networking
- **Virtual Cloud Network (`oci_core_vcn`)**: Dedicated CIDR block `10.0.0.0/16` with DNS label `megalith`.
- **Internet Gateway (`oci_core_internet_gateway`)**: Provides public routing for the VCN.
- **Route Table (`oci_core_route_table`)**: Default route `0.0.0.0/0` targeting the Internet Gateway.
- **Security List (`oci_core_security_list`)**: Attached to the public subnet with an empty ingress set and full egress. Ingress is governed strictly via the VNIC Network Security Group to override OCI's default open-SSH security list.
- **Public Subnet (`oci_core_subnet`)**: Subnet `10.0.1.0/24` with public IP assignment permitted.
- **Network Security Group (`oci_core_network_security_group`)**:
  - **SSH (TCP 22)**: Restricted strictly to `var.ssh_admin_cidr`. Variable validation prevents `0.0.0.0/0`.
  - **HTTP (TCP 80)**: Open to internet for ACME HTTP-01 challenges and HTTPS redirection.
  - **HTTPS (TCP 443)**: Open to internet for future Caddy edge reverse proxy.
  - **Internal Ports**: Ports `5432` (PostgreSQL), `8000` (FastAPI), `8080` (Demo Web), and Docker daemon sockets are **not** exposed to the subnet or internet.

### Compute & Host Bootstrap
- **Shape**: Fixed strictly to `VM.Standard.A1.Flex`. No fallback shapes (such as x86 or AMD) are configured to ensure zero accidental billing.
- **Compute Sizing**:
  - `ocpus`: 2 (Always Free limit: up to 4 total across tenancy).
  - `memory_in_gbs`: 12 GB (Always Free limit: up to 24 GB total across tenancy).
  - `boot_volume_size_in_gbs`: 50 GB (Always Free limit: up to 200 GB total storage).
- **Operating System Image**: Canonical Ubuntu 24.04 LTS ARM64 retrieved dynamically via `oci_core_images` filtered for shape `VM.Standard.A1.Flex`, or explicitly overridden via `var.image_ocid`.
- **Cloud-Init Bootstrap**:
  - Non-root administrative user (`ubuntu`) configured with sudo rights and the provided SSH public key.
  - Password authentication disabled in SSH daemon configuration.
  - UFW host firewall configured to allow port 22 before enabling (preventing administrative lockout), plus 80 and 443.
  - Docker Engine and Docker Compose plugin installed from the official Docker apt repository for ARM64.
  - Docker daemon log rotation configured in `/etc/docker/daemon.json` (`max-size: 20m`, `max-file: 3`) per [ADR-010](../../../docs/decisions/adr-010-operations.md).
  - Megalith deployment skeleton directory created at `/opt/megalith/deploy`.

---

## 4. Local Validation Workflow

To validate this configuration locally:

```bash
# Navigate to the infrastructure directory
cd platform/infra/oci

# 1. Format check
terraform fmt -check -recursive

# 2. Provider initialization (no backend or credentials required)
terraform init -backend=false

# 3. Static configuration validation
terraform validate
```

---

## 5. Provisioning Lifecycle & Operational Runbook

For complete instructions on authenticating to OCI, sizing and capacity verification, human plan review, manual provisioning, post-provisioning verification, and teardown, consult the **[OCI Provisioning Operations Guide](../../../docs/operations/oci-provisioning.md)**.
