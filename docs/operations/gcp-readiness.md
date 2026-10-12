# Google Cloud Platform (GCP) Operational Readiness Guide

This operational guide provides comprehensive instructions and architectural trust boundaries for running Megalith workloads on Google Cloud Platform Compute Engine per [ADR-011](../decisions/adr-011-cloud-portability.md) and Task 011 requirements.

---

## 1. Google Cloud Project and Billing Prerequisites

Before initiating any infrastructure provisioning:
1. **Google Cloud Account & Project**:
   - Create or designate an isolated Google Cloud Project (e.g., `megalith-prod-01`).
   - Link a verified Cloud Billing account.
2. **Enable Required APIs**:
   Ensure the following Google Cloud APIs are activated:
   ```bash
   gcloud services enable compute.googleapis.com
   gcloud services enable cloudresourcemanager.googleapis.com
   ```
3. **Billing Alerts**:
   - Set up billing budget alerts immediately before provisioning any compute resource (see Section 15).

---

## 2. Confirming Free-Tier Eligibility vs Paid Resources

Google Cloud offers an "Always Free" tier for Compute Engine with specific constraints:
* **Eligible Instance Type**: 1 non-preemptible `e2-micro` VM per month (shared-core, 2 vCPUs, 1 GB RAM).
* **Eligible Regions**: Only `us-west1` (Oregon), `us-central1` (Iowa), and `us-east1` (South Carolina).
* **Storage**: 30 GB standard persistent disk (`pd-standard`) per month.
* **Network Egress**: 1 GB network egress per month from North America to all region destinations (excluding China and Australia).
* **Public IPv4 Addressing**: Google Cloud charges approximately \$0.005/hour (~$3.65/month) for in-use external IPv4 addresses. Ephemeral IP addresses attached to running instances are not permanently free from hourly network charges.

> [!WARNING]
> **Budget Alerts Are NOT Spending Caps**:
> Google Cloud Billing Budgets send email notifications or Pub/Sub events when thresholds are met. **Budgets do NOT automatically stop, terminate, or shut down VMs or cap billing.** Resources continue to run and accrue charges unless explicitly terminated by an operator or automated programmatic action.

> [!WARNING]
> **Production Sizing Reality on `e2-micro`**:
> `e2-micro` provides approximately **1 GB of physical RAM**.
> - Host OS baseline (Ubuntu 24.04 kernel, systemd, containerd, dockerd): **~350–440 MiB**.
> - Micro staging stack (`compose.micro.yaml` - Caddy + static frontend): **~15 MiB**.
> - Total micro footprint: **~370–465 MiB**, leaving ~535–630 MiB free RAM.
> - Full production stack (Caddy + FastAPI + React + PostgreSQL + Alembic): **~750–1040 MiB**, leaving virtually 0 headroom and triggering the Linux Out-Of-Memory (OOM) killer.
> Therefore, `e2-micro` is strictly supported under the `micro` profile for bootstrap verification. `platform/infra/gcp/compute.tf` enforces this via fail-closed preconditions.

---

## 3. Region and Zone Selection

When configuring `platform/infra/gcp/terraform.tfvars`:
* **Free-Tier Eligible Choices**:
  - `us-central1` (Zones: `us-central1-a`, `us-central1-b`, `us-central1-c`, `us-central1-f`)
  - `us-east1` (Zones: `us-east1-b`, `us-east1-c`, `us-east1-d`)
  - `us-west1` (Zones: `us-west1-a`, `us-west1-b`, `us-west1-c`)
* **Default Staging Configuration**: `region = "us-central1"`, `zone = "us-central1-a"`.
* Any other region will be rejected by Terraform preconditions unless `allow_paid_resources = true`.

---

## 4. Required IAM Permissions for Provisioning

The operator or provisioning identity executing Terraform requires least-privilege administrative roles:
* `roles/compute.instanceAdmin.v1` (to create, update, and manage the VM instance).
* `roles/compute.networkAdmin` (to configure the custom VPC, subnet, and firewall rules).
* `roles/compute.securityAdmin` (to manage firewall policies).
* `roles/iam.serviceAccountAdmin` or `roles/resourcemanager.projectIamAdmin` (to create the dedicated zero-role VM service account).
* `roles/iam.serviceAccountUser` (to attach the runtime service account to the instance).

Do NOT use the overly permissive `roles/owner` or `roles/editor` primitive roles for CI/CD automation or service accounts.

---

## 5. VM Service Account Permissions and Least Privilege

The Compute Engine VM instance adheres to strict least-privilege security boundaries:
1. **Dedicated Service Account**:
   Terraform declares a dedicated runtime service account `google_service_account.vm_sa` (`megalith-staging-vm-sa`).
2. **Zero Project IAM Roles**:
   `google_service_account.vm_sa` has exactly **0 IAM roles** granted on the GCP project. It cannot create or modify any GCP cloud resources.
3. **Empty API Scopes**:
   In `platform/infra/gcp/compute.tf`, the instance is configured with:
   ```hcl
   service_account {
     email  = google_service_account.vm_sa.email
     scopes = [] # No Google Cloud API scopes granted to the VM
   }
   ```
   If the VM is ever compromised, the attacker cannot access Google Cloud APIs, Cloud Storage, or IAM credentials.

---

## 6. SSH Access, Host Bootstrap, and Firewall Alignment

1. **Restricted Admin Source IP**:
   Administrative SSH access (port 22) is never exposed to the public internet (`0.0.0.0/0`).
   The firewall rule `megalith-allow-ssh` enforces:
   ```hcl
   source_ranges = [var.ssh_admin_cidr] # Operator's specific public IP/CIDR (e.g. "203.0.113.50/32")
   ```
2. **Host UFW Alignment**:
   In `cloud-init.yaml.tftpl`, the host UFW firewall mirrors the VPC restriction exactly:
   ```bash
   ufw allow proto tcp from ${ssh_admin_cidr} to any port 22
   ```
   Unrestricted `22/tcp` is strictly forbidden.
3. **Operator IP Change Recovery**:
   If the operator's public IP changes:
   - Recommended: Update `ssh_admin_cidr` in `terraform.tfvars` and apply the update to refresh the VPC firewall rule.
   - For host UFW: Connect via Google Cloud Console SSH or IAP tunnel (`gcloud compute ssh --tunnel-through-iap`) and run `sudo ufw allow proto tcp from <new-ip>/32 to any port 22`.
4. **Automated Cloud-Init Bootstrap**:
   On first boot, `platform/infra/gcp/cloud-init.yaml.tftpl` automatically:
   - Configures the unprivileged administrative user `megalith-admin`.
   - Installs the operator's public SSH key (`0600` authorized_keys).
   - Installs Docker Engine (Docker CE) and Docker Compose plugin from official Docker apt repositories.
   - Enables and starts Docker daemon.
   - Configures UFW host firewall: allows 22 strictly from `ssh_admin_cidr`, allows 80/443 globally, and rejects all other inbound traffic.

---

## 7. GHCR Private-Image Authentication & Staging Transfer

Megalith application images (`demo-api`, `demo-web`) can be deployed to the staging VM using two supported methods:
1. **Air-Gapped / Direct SSH Pipe (No Registry Auth Needed)**:
   For rapid staging experiments, pipe local images directly over SSH:
   ```bash
   docker save megalith-demo-web:v2 | gzip | ssh -i ~/.ssh/id_ed25519 megalith-admin@<public_ip> 'gunzip | docker load'
   ```
2. **GHCR Private Image Registry**:
   - Create a GitHub Personal Access Token (PAT) with `read:packages` scope.
   - Authenticate Docker on the VM host:
     ```bash
     echo "$GHCR_PAT" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
     ```
   - Pull pinned release image by digest:
     ```bash
     docker pull ghcr.io/your-org/demo-web@sha256:108482f061900f8c87ec8bbec3c1274e1fe6e08cb9b77062fc8a2c33299e7804
     ```

---

## 8. DNS and HTTPS Ingress Prerequisites

1. **Public IP Allocation**:
   Retrieve the external IPv4 address from Terraform outputs:
   ```bash
   terraform -chdir=platform/infra/gcp output public_ip
   ```
   *(Note: `instance_public_ip` is also available as a backward-compatible alias).*
2. **Staging Smoke Testing Without DNS**:
   The `micro` staging profile binds `:80` and includes an explicit `/health` endpoint with `auto_https off` in `Caddyfile.micro`. This allows immediate smoke testing directly via IP without requiring DNS configuration:
   ```bash
   curl -s http://<public_ip>/health
   # Response: {"status":"ok","profile":"micro","smoke_test":true}
   ```
3. **Production DNS A Record**:
   When deploying a live public service with TLS:
   - Name: `demo.yourdomain.com`
   - Type: `A`
   - Value: `<public_ip>`
   - TTL: `300` (5 minutes during initial setup)
   - Caddy automatically provisions and renews TLS certificates via Let's Encrypt / ZeroSSL on ports 80/443.

---

## 9. Firewall and Ingress Validation

Verify the three-tier firewall model:
1. **Edge Firewall (GCP VPC)**:
   - Port 80 (HTTP) -> `0.0.0.0/0` (Allow).
   - Port 443 (HTTPS) -> `0.0.0.0/0` (Allow).
   - Port 22 (SSH) -> `var.ssh_admin_cidr` (Allow).
   - All other inbound ports -> Deny.
2. **Host Firewall (UFW)**:
   - Port 22 -> `var.ssh_admin_cidr` strictly (Allow).
   - Port 80, 443 -> `0.0.0.0/0` (Allow).
   - Default incoming policy -> Deny.
3. **Internal Container Isolation (Docker bridge)**:
   - `postgres` (port 5432) -> restricted to `data-network` with zero host port binding.
   - `demo-api` (port 8000) -> restricted to `edge-network` and `data-network` with zero host port binding.
   - `demo-web` (port 8080) -> restricted to `edge-network` with zero host port binding.
   - Only `caddy` binds ports 80 and 443 on the host interface.

---

## 10. Host Preflight: Profiles, Memory, and Disk Requirements

Run the operational preflight checker before executing any deployments:
```bash
python3 platform/deploy/scripts/preflight.py --provider gcp --profile full --environment production
```

### Profile Guardrails
* **`full` Profile (Production Standard)**:
  - Requires minimum **4 GB RAM** (e.g. GCP `e2-medium` or `e2-standard-2`).
  - Minimum 10 GB free disk space.
  - Deploys Caddy, FastAPI, React/Nginx, PostgreSQL, Alembic migrations, and encrypted backups.
* **`micro` Profile (Experimental Smoke Test Only)**:
  - Supported for testing on `e2-micro` (1 GB RAM).
  - Deploys minimal static Caddy ingress and health respondent (`compose.micro.yaml`).
  - **HARD POLICY**: Strictly forbidden in `production` environment. The deployment controller and preflight checker will reject `--profile micro --environment production` with an explicit error.

---

## 11. Backup Destination Selection

Per [ADR-011](../decisions/adr-011-cloud-portability.md), Megalith utilizes a provider-independent off-host backup abstraction (`BackupStorageBackend`):
1. **Local Disk Isolation**: Plaintext database dumps are never written to disk unencrypted (`pg_dump | age -r <pubkey>`).
2. **Simulated / Mounted Destination**: During Phase A, `DirectoryBackupStorage` exports verified ciphertext and metadata manifests (`.meta.json`) to an isolated directory or attached storage volume.
3. **Cloud Storage Readiness**: For live cloud operations, an S3/GCS-compatible object storage backend can be plugged into the interface without altering backup encryption or verification logic.

---

## 12. Encryption Key Custody and Disaster Recovery

* **Key Generation**:
  ```bash
  python3 platform/deploy/postgres/backup.py keygen --output /path/to/backup_key.txt
  ```
* **Custody**:
  - Store the private key (`AGE-SECRET-KEY-1...`) in a secure offline password manager (1Password, Bitwarden, or hardware security module).
  - Do NOT store the private key on the production VM host. The host only needs the **public recipient key** (`age1...`) to create encrypted backups.
* **Data Loss Impact**:
  - ChaCha20-Poly1305 encryption is cryptographically irreversible without the private key. If the private identity key is lost, **all database backups are permanently unrecoverable**.

---

## 13. Deployment and Rollback Procedure

### Step 1: Preflight
```bash
python3 platform/deploy/scripts/preflight.py --provider gcp --profile full --manifest /path/to/release.manifest.json
```

### Step 2: Operator Authorization
Authorize the release out-of-tree (file mode 0600):
```bash
python3 platform/deploy/scripts/release.py authorize \
  --manifest /opt/megalith/deploy/release.manifest.json \
  --operator "lead-platform-engineer" \
  --environment production \
  --output /opt/megalith/deploy/auth.json
```

### Step 3: Deploy
```bash
python3 platform/deploy/scripts/deploy.py apply \
  --provider gcp \
  --profile full \
  --manifest /opt/megalith/deploy/release.manifest.json \
  --auth /opt/megalith/deploy/auth.json \
  --environment production
```

### Step 4: Emergency Rollback
If application health checks fail or manual rollback is needed:
```bash
python3 platform/deploy/scripts/deploy.py rollback \
  --provider gcp \
  --profile full \
  --environment production
```

---

## 14. Disaster Recovery from a Lost VM (Total Host Loss)

If the GCP Compute Engine VM is destroyed or rendered unbootable:
1. **Reprovision VM**:
   Run `terraform -chdir=platform/infra/gcp apply` to spin up a fresh host.
2. **Retrieve Encrypted Backup**:
   Use the retrieval utility to fetch the backup ciphertext and manifest from off-host storage:
   ```bash
   python3 platform/deploy/postgres/backup.py retrieve \
     --backup-id <backup-id> \
     --source /path/to/offhost_storage \
     --output-dir /opt/megalith/backups
   ```
3. **Execute Clean-Container Restore Drill**:
   Provide the offline private identity key:
   ```bash
   python3 platform/deploy/postgres/restore.py clean-container-drill \
     --backup-file /opt/megalith/backups/<backup-id>.dump.age \
     --identity /safe/offline/backup_key.txt
   ```
4. **Deploy Application**:
   Deploy the release manifest using `deploy.py apply`.

---

## 15. Expected Cost Risks and Budget Alerts

### Cost Risk Drivers
1. **Public IPv4 Addresses**: Billed per hour ($0.005/hr) when in use, and higher when idle ($0.010/hr). Expect ~\$3.65/month per running public IPv4 address.
2. **Machine Type Beyond Free Tier**: Provisioning `e2-standard-2` or `e2-medium` will incur compute charges (~\$25 to \$50/month) if left running continuously.
3. **Egress Traffic**: Egress exceeding 1 GB/month is billed at standard internet egress rates (~$0.12/GB).
4. **Snapshots & Disks**: Persistent disks beyond 30 GB or disk types other than `pd-standard` (e.g. `pd-balanced`, `pd-ssd`) are chargeable.
5. **Stopped Instances**: A stopped Compute Engine instance still incurs storage charges for its attached persistent disk ($0.040/GB/month) and public IPv4 reservation charges ($0.010/hr) unless ephemeral IPs and disks are destroyed.

### Critical Notice: Budget Alerts Are NOT Spending Caps
> [!WARNING]
> Google Cloud Billing Budgets are notification mechanisms only. Setting a budget does **NOT** cap spending, throttle services, or shut down VMs when the budget threshold is exceeded. To avoid unexpected charges, operators must monitor resources and execute `terraform destroy` when staging verification is complete.

### Setting Up Budget Alerts
1. Go to **Google Cloud Console** -> **Billing** -> **Budgets & alerts**.
2. Click **Create Budget**.
3. Name: `Megalith-Monthly-Safety-Budget`.
4. Target amount: Set a conservative limit (e.g., \$10.00 / month).
5. Trigger thresholds: 50%, 90%, 100%.
6. Notification: Send email alerts to the primary operator and platform engineering group.

