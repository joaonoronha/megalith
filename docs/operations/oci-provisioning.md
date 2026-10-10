# OCI Infrastructure Provisioning & Operations Guide

This guide establishes the complete operational lifecycle for managing Megalith's single-node host infrastructure on Oracle Cloud Infrastructure (OCI) using Terraform (`platform/infra/oci/`).

> **CRITICAL HUMAN-IN-THE-LOOP REQUIREMENT**:
> Infrastructure changes must **never** be applied automatically or from unauthenticated/automated pipelines. All provisioning, plan reviews, and destructions require explicit human authorization and execution from a trusted local workstation.

---

## 1. Intended Infrastructure Lifecycle

```text
Prepare OCI account & verify Always Free limits
       │
       ▼
Configure local OCI CLI credentials (~/.oci/config)
       │
       ▼
Review and populate Terraform variables (terraform.tfvars)
       │
       ▼
terraform init
       │
       ▼
terraform validate
       │
       ▼
terraform plan -out=tfplan
       │
       ▼
Human review and approval of plan output
       │
       ▼
terraform apply tfplan  (MANUAL EXECUTION ONLY)
       │
       ▼
Verify VM status and administrative SSH access
```

---

## 2. OCI Account Prerequisites & IAM Permissions

### Prerequisites
- An active Oracle Cloud account (Always Free tier or paid tenancy with Always Free eligible credits).
- An SSH key pair generated on your local administrative workstation (e.g., `ssh-keygen -t ed25519 -C "admin@megalith"`).
- OCI CLI installed locally (`oci-cli`) for tenancy querying and credential generation.

### Required IAM Policy
The administrative user executing Terraform requires permissions to manage compute, networking, and query tenancy details within the target compartment. For a dedicated compartment `MegalithCompartment`:

```text
Allow group MegalithOperators to manage virtual-network-family in compartment MegalithCompartment
Allow group MegalithOperators to manage instance-family in compartment MegalithCompartment
Allow group MegalithOperators to manage volume-family in compartment MegalithCompartment
Allow group MegalithOperators to read instance-images in compartment MegalithCompartment
Allow group MegalithOperators to inspect compartments in tenancy
```

If operating directly within the tenancy root compartment, ensure your user belongs to the `Administrators` group or has equivalent policy allowances.

---

## 3. Region, Availability Domain, and Image Discovery

Before configuring Terraform, verify available regions, availability domains, and capacity using the OCI CLI.

### 3.1 Discover Available Regions
```bash
oci iam region-subscription list --output table
```
Ensure your tenancy is subscribed to your desired region (e.g., `us-ashburn-1`, `sa-saopaulo-1`, `eu-frankfurt-1`).

### 3.2 Discover Availability Domains (ADs)
In your target region, list the availability domains:
```bash
oci iam availability-domain list --region us-ashburn-1 --output table
```
Note the names returned (e.g., `UwhS:US-ASHBURN-AD-1`, `UwhS:US-ASHBURN-AD-2`, `UwhS:US-ASHBURN-AD-3`).

### 3.3 Query Available ARM64 Images
To discover the exact OCID of official Ubuntu 24.04 ARM64 images:
```bash
oci compute image list \
  --compartment-id <your-compartment-ocid> \
  --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" \
  --shape "VM.Standard.A1.Flex" \
  --sort-by TIMECREATED \
  --sort-order DESC \
  --output table \
  --query "data[*].{DisplayName:\"display-name\", OCID:id, Created:\"time-created\"}"
```

---

## 4. Always Free Capacity & Cost-Safety Considerations

### Always Free Limits (Ampere A1 Flex)
Oracle Cloud provides the following Always Free resource pool across your tenancy:
- **Compute**: Up to **4 OCPUs** and **24 GB RAM** across one or more Ampere A1 Flex VMs.
- **Storage**: Up to **200 GB total** boot and block volume storage.

### Megalith Baseline Sizing
The Megalith baseline consumes a conservative subset of these limits:
- `ocpus = 2` (50% of Always Free pool)
- `memory_in_gbs = 12` (50% of Always Free pool)
- `boot_volume_size_in_gbs = 50` (25% of Always Free pool)

This configuration leaves ample headroom for testing, snapshotting, or running a second smaller utility VM if needed, while comfortably fitting within the zero-cost tier.

### Cost Safety Rules
1. **Strict Shape Pinning**: The shape in `compute.tf` is hard-coded to `VM.Standard.A1.Flex`. It does not fallback to paid AMD/Intel shapes (`VM.Standard.E4.Flex`, `VM.Standard2.*`).
2. **No Billable Services**: The configuration explicitly avoids NAT Gateways, Load Balancers, Autonomous Databases, or Reserved Public IP reservations.
3. **Capacity Availability Warning**: Always Free Ampere capacity is subject to regional availability. If a region has exhausted its free-tier Ampere A1 pool, provisioning will return `Out of capacity for shape VM.Standard.A1.Flex`. **Do not alter the shape to an x86 paid shape**; instead, try another availability domain or wait for capacity replenishment.

---

## 5. Local Authentication Setup

Terraform uses standard OCI provider authentication via your local OCI CLI configuration file.

### 5.1 Generate and Configure OCI API Key
1. Generate an API signing key:
   ```bash
   mkdir -p ~/.oci
   openssl genrsa -out ~/.oci/oci_api_key.pem 2048
   chmod 600 ~/.oci/oci_api_key.pem
   openssl rsa -pubout -in ~/.oci/oci_api_key.pem -out ~/.oci/oci_api_key_public.pem
   ```
2. Upload `~/.oci/oci_api_key_public.pem` to your OCI Console:
   - Profile -> User Settings -> **API Keys** -> **Add API Key**.
3. Create `~/.oci/config`:
   ```ini
   [DEFAULT]
   user=ocid1.user.oc1..aaaaaaaaxxxxxxxxxxxxxxxxxxxxxxxxx
   fingerprint=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
   tenancy=ocid1.tenancy.oc1..aaaaaaaaxxxxxxxxxxxxxxxxxxxxx
   region=us-ashburn-1
   key_file=~/.oci/oci_api_key.pem
   ```
4. Verify CLI connectivity:
   ```bash
   oci os ns get
   ```

---

## 6. Variable Configuration

Copy the example file in `platform/infra/oci/`:
```bash
cd platform/infra/oci
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
1. `compartment_ocid`: Enter your compartment OCID.
2. `region`: Set your primary OCI region (e.g., `us-ashburn-1`).
3. `ssh_admin_cidr`: Determine your current public IPv4 address (`curl -s https://ifconfig.me/ip`) and format as a `/32` (e.g., `203.0.113.50/32`).
   > **Note**: Setting `0.0.0.0/0` is blocked by variable validation for security.
4. `ssh_public_key`: Paste your public key string (e.g., contents of `~/.ssh/id_ed25519.pub`).

---

## 7. Plan Review & Approval Procedure

Run the planning procedure locally:

```bash
cd platform/infra/oci

# 1. Format check
terraform fmt -check -recursive

# 2. Initialize provider plugins
terraform init

# 3. Validate configuration
terraform validate

# 4. Generate speculative plan
terraform plan -out=tfplan
```

### Plan Inspection Checklist
Before executing `apply`, carefully verify the plan output:
- [ ] Exactly 8 resources to add (VCN, IGW, Route Table, Subnet, Security List, NSG, 4 NSG Rules, Compute Instance).
- [ ] Instance shape is `VM.Standard.A1.Flex`.
- [ ] OCPUs = 2, Memory = 12 GB, Boot Volume = 50 GB.
- [ ] Ingress rules:
  - Port 22 allowed **only** from your `ssh_admin_cidr`.
  - Ports 80 and 443 open to `0.0.0.0/0`.
  - Ports 5432, 8000, 8080 are **absent**.
- [ ] No resources scheduled for destruction or in-place replacement.

---

## 8. Manual Provisioning Procedure

When the plan inspection is satisfactory, execute:

```bash
terraform apply tfplan
```

Terraform will provision the VCN, network security groups, and ARM64 compute instance.

Outputs will display:
```text
Apply complete! Resources: 8 added, 0 changed, 0 destroyed.

Outputs:

instance_id = "ocid1.instance.oc1..."
public_ip = "129.153.xxx.xxx"
private_ip = "10.0.1.xxx"
ssh_admin_user = "ubuntu"
ssh_connect_command = "ssh ubuntu@129.153.xxx.xxx"
subnet_id = "ocid1.subnet.oc1..."
vcn_id = "ocid1.vcn.oc1..."
```

---

## 9. Post-Provisioning Verification & SSH Connection

### 9.1 Connect via SSH
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<public_ip>
```

### 9.2 Host Health Verification
Once connected, verify the host baseline:

1. **Verify cloud-init status**:
   ```bash
   cloud-init status --wait
   ```
   (Must output `status: done`).

2. **Verify architecture**:
   ```bash
   uname -m
   # Output must be: aarch64
   ```

3. **Verify host firewall (UFW)**:
   ```bash
   sudo ufw status verbose
   ```
   Confirm Status is `active` with ports 22, 80, 443 allowed.

4. **Verify Docker Engine & Compose**:
   ```bash
   docker --version
   docker compose version
   ```

5. **Verify Docker daemon log rotation configuration**:
   ```bash
   cat /etc/docker/daemon.json
   ```
   Confirm `max-size: "20m"` and `max-file: "3"`.

6. **Verify deployment directory**:
   ```bash
   ls -ld /opt/megalith/deploy
   ```

---

## 10. Terraform State Management & Backup

### State Security Notice
Terraform state contains metadata describing cloud resources and IP addresses.
- **Never commit `terraform.tfstate` to Git**. `.gitignore` files at both repository root and `platform/infra/oci/` strictly exclude it.
- **Back up state securely**: Store `terraform.tfstate` in an encrypted local location, password manager, or secure off-site backup vault.
- **Losing State**: If the state file is lost, Terraform loses tracking of OCI resources. Resources must either be manually imported using `terraform import` or deleted via the OCI web console.

---

## 11. Manual Teardown Procedure

To cleanly destroy all provisioned cloud resources:

```bash
cd platform/infra/oci

# Generate destruction plan
terraform plan -destroy -out=destroy.tfplan

# Review the destroy plan carefully
terraform show destroy.tfplan

# Apply destruction plan
terraform apply destroy.tfplan
```

All 8 OCI resources (compute instance, subnet, NSG, route table, internet gateway, VCN) will be terminated, releasing the Always Free allocation back to the pool.

---

## 12. Troubleshooting & Recovery

| Issue | Cause | Remediation |
| :--- | :--- | :--- |
| `Out of host capacity for shape VM.Standard.A1.Flex` | OCI region or AD free capacity is temporarily saturated | Switch `availability_domain_number` (1, 2, or 3) or retry periodically. Do not switch to paid x86 shape. |
| `Connection timed out` on SSH | Administrator public IP changed | Update `ssh_admin_cidr` in `terraform.tfvars`, run `terraform apply`, and retry SSH. |
| `Permission denied (publickey)` | SSH key mismatch | Verify that `ssh_public_key` matches the private key specified in `ssh -i <key>`. |
| `Error 404 NotAuthorizedOrNotFound` | Invalid compartment OCID or missing IAM permissions | Check compartment OCID in `terraform.tfvars` and ensure IAM policy grants permissions on `virtual-network-family` and `instance-family`. |
