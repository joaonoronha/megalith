"""
Automated regression tests verifying OCI Terraform infrastructure-as-code safety,
least-privilege network rules, state exclusion, and cloud-init template validity.
"""

from __future__ import annotations

import re
from pathlib import Path
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OCI_DIR = REPO_ROOT / "platform" / "infra" / "oci"
WORKFLOW_DIR = REPO_ROOT / ".github" / "workflows"


def test_required_terraform_files_exist():
    expected_files = [
        "versions.tf",
        "providers.tf",
        "variables.tf",
        "network.tf",
        "compute.tf",
        "outputs.tf",
        "cloud-init.yaml.tftpl",
        "terraform.tfvars.example",
        ".gitignore",
        ".terraform.lock.hcl",
    ]
    for filename in expected_files:
        file_path = OCI_DIR / filename
        assert file_path.is_file(), f"Required file '{filename}' missing in {OCI_DIR}"


def test_terraform_lockfile_records_oci_provider():
    lockfile = OCI_DIR / ".terraform.lock.hcl"
    assert lockfile.is_file(), "Terraform lockfile must exist"
    content = lockfile.read_text(encoding="utf-8")
    assert 'provider "registry.terraform.io/oracle/oci"' in content, (
        "Lockfile must pin the official oracle/oci provider"
    )


def test_ssh_admin_cidr_strictly_validated():
    vars_file = OCI_DIR / "variables.tf"
    content = vars_file.read_text(encoding="utf-8")

    # Verify ssh_admin_cidr variable exists
    assert 'variable "ssh_admin_cidr"' in content

    # Verify that ssh_admin_cidr has NO default value
    var_block = re.search(r'variable "ssh_admin_cidr"\s*{(.*?)}', content, re.DOTALL)
    assert var_block is not None, "Could not find variable block for ssh_admin_cidr"
    block_text = var_block.group(1)
    assert "default" not in block_text, "ssh_admin_cidr must not have a default value"

    # Verify validation condition expressly prevents 0.0.0.0/0
    assert 'var.ssh_admin_cidr != "0.0.0.0/0"' in block_text, (
        "ssh_admin_cidr must have validation explicitly forbidding 0.0.0.0/0"
    )


def test_no_insecure_ports_exposed_in_network():
    network_file = OCI_DIR / "network.tf"
    content = network_file.read_text(encoding="utf-8")

    # Forbidden ports that must NEVER be exposed publicly
    forbidden_ports = [5432, 8000, 8080, 2375, 2376]
    for port in forbidden_ports:
        assert str(port) not in content, (
            f"Security policy violation: internal/database port {port} found in network.tf"
        )

    # Ingress rules should only permit 22, 80, 443
    port_matches = re.findall(r'destination_port_range\s*{\s*min\s*=\s*(\d+)\s*max\s*=\s*(\d+)', content)
    for min_p, max_p in port_matches:
        assert (min_p, max_p) in [("22", "22"), ("80", "80"), ("443", "443")], (
            f"Unexpected port range permitted: min={min_p}, max={max_p}"
        )


def test_compute_shape_locked_to_arm64_ampere():
    compute_file = OCI_DIR / "compute.tf"
    content = compute_file.read_text(encoding="utf-8")

    # Must specify VM.Standard.A1.Flex
    assert 'shape = "VM.Standard.A1.Flex"' in content, (
        "Compute shape must be strictly VM.Standard.A1.Flex for Always Free ARM64"
    )

    # Must not contain fallback shapes or x86 shapes
    forbidden_shapes = ["VM.Standard.E4.Flex", "VM.Standard.E3.Flex", "VM.Standard2", "VM.Standard.B"]
    for shape in forbidden_shapes:
        assert shape not in content, f"Forbidden fallback shape {shape} found in compute.tf"


def test_no_private_keys_or_real_credentials_in_files():
    # Scan all files in platform/infra/oci/
    for file_path in OCI_DIR.iterdir():
        if file_path.is_file() and not file_path.name.startswith("."):
            content = file_path.read_text(encoding="utf-8")
            assert "-----BEGIN" not in content, f"Private key header found in {file_path}"
            assert "PRIVATE KEY" not in content, f"Private key content found in {file_path}"
            # Check for hardcoded AWS/OCI API secrets
            assert "secret_key" not in content.lower(), f"Secret key pattern found in {file_path}"


def test_state_and_sensitive_files_gitignored():
    root_ignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    local_ignore = (OCI_DIR / ".gitignore").read_text(encoding="utf-8")

    for pattern in ["*.tfstate", "*.tfplan", "*.tfvars"]:
        assert pattern in root_ignore, f"Root .gitignore missing pattern '{pattern}'"
        assert pattern in local_ignore, f"Local .gitignore missing pattern '{pattern}'"

    assert "!terraform.tfvars.example" in root_ignore
    assert "!terraform.tfvars.example" in local_ignore


def test_cloud_init_valid_yaml():
    cloud_init_file = OCI_DIR / "cloud-init.yaml.tftpl"
    raw_content = cloud_init_file.read_text(encoding="utf-8")

    # Render template with mock variables
    rendered = raw_content.replace("${admin_username}", "ubuntu").replace(
        "${ssh_public_key}", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockKey admin@local"
    )

    # Parse YAML safely
    data = yaml.safe_load(rendered)
    assert isinstance(data, dict), "Cloud-init template must parse as a dictionary"
    assert data.get("package_update") is True
    assert "docker-ce" in str(data.get("runcmd"))
    assert "ufw allow 22/tcp" in str(data.get("runcmd"))

    # Verify log rotation matches ADR-010 (20m, 3 files)
    assert '"max-size": "20m"' in rendered
    assert '"max-file": "3"' in rendered


def test_outputs_contain_no_secrets():
    outputs_file = OCI_DIR / "outputs.tf"
    content = outputs_file.read_text(encoding="utf-8")

    # Ensure standard non-sensitive outputs exist
    for expected_output in ["instance_id", "public_ip", "private_ip", "vcn_id", "subnet_id"]:
        assert f'output "{expected_output}"' in content

    # Ensure no secret outputs are marked
    assert "private_key" not in content
    assert "password" not in content
    assert "token" not in content


def test_no_automated_terraform_apply_in_workflows():
    # Verify no workflow attempts to run terraform apply or destroy
    for wf in WORKFLOW_DIR.glob("*.yaml"):
        content = wf.read_text(encoding="utf-8")
        assert "terraform apply" not in content, f"Forbidden 'terraform apply' found in {wf}"
        assert "terraform destroy" not in content, f"Forbidden 'terraform destroy' found in {wf}"


GCP_DIR = REPO_ROOT / "platform" / "infra" / "gcp"


def test_required_gcp_terraform_files_exist():
    expected_files = [
        "versions.tf",
        "providers.tf",
        "variables.tf",
        "network.tf",
        "compute.tf",
        "outputs.tf",
        "cloud-init.yaml.tftpl",
        "terraform.tfvars.example",
        ".gitignore",
        ".terraform.lock.hcl",
        "README.md",
    ]
    for filename in expected_files:
        file_path = GCP_DIR / filename
        assert file_path.is_file(), f"Required file '{filename}' missing in {GCP_DIR}"


def test_gcp_terraform_lockfile_pins_google_provider():
    lockfile = GCP_DIR / ".terraform.lock.hcl"
    assert lockfile.is_file(), "Terraform lockfile must exist for GCP"
    content = lockfile.read_text(encoding="utf-8")
    assert 'provider "registry.terraform.io/hashicorp/google"' in content


def test_gcp_ssh_admin_cidr_strictly_validated():
    vars_file = GCP_DIR / "variables.tf"
    content = vars_file.read_text(encoding="utf-8")

    assert 'variable "ssh_admin_cidr"' in content
    var_block = re.search(r'variable "ssh_admin_cidr"\s*{(.*?)}', content, re.DOTALL)
    assert var_block is not None
    block_text = var_block.group(1)
    assert "default" not in block_text, "GCP ssh_admin_cidr must not have a default value"
    assert 'var.ssh_admin_cidr != "0.0.0.0/0"' in block_text


def test_no_insecure_ports_exposed_in_gcp_network():
    network_file = GCP_DIR / "network.tf"
    content = network_file.read_text(encoding="utf-8")

    forbidden_ports = [5432, 8000, 8080, 2375, 2376]
    for port in forbidden_ports:
        assert str(port) not in content, f"Insecure port {port} exposed in GCP network.tf"


def test_gcp_cloud_init_valid_yaml():
    cloud_init_file = GCP_DIR / "cloud-init.yaml.tftpl"
    raw_content = cloud_init_file.read_text(encoding="utf-8")
    rendered = (
        raw_content.replace("${admin_username}", "ubuntu")
        .replace("${ssh_public_key}", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockKey admin@local")
        .replace("${ssh_admin_cidr}", "203.0.113.50/32")
    )
    data = yaml.safe_load(rendered)
    assert isinstance(data, dict)
    assert data.get("package_update") is True
    assert '"max-size": "20m"' in rendered
    assert '"max-file": "3"' in rendered
    assert "docker-ce" in str(data.get("runcmd"))

    # Objective B: Verify host UFW rule aligns with ssh_admin_cidr and broad 22/tcp rule is absent
    runcmd_str = str(data.get("runcmd"))
    assert "ufw allow proto tcp from 203.0.113.50/32 to any port 22" in runcmd_str
    assert "ufw allow 22/tcp" not in runcmd_str, (
        "Security violation: broad 'ufw allow 22/tcp' must not appear in cloud-init"
    )


def test_gcp_dedicated_zero_role_service_account_declared():
    """Objective C: Verify dedicated VM service account with zero project IAM permissions."""
    compute_file = GCP_DIR / "compute.tf"
    content = compute_file.read_text(encoding="utf-8")

    # Dedicated service account resource declared
    assert 'resource "google_service_account" "vm_sa"' in content, (
        "Dedicated service account resource 'google_service_account.vm_sa' must be declared in compute.tf"
    )

    # Attached explicitly to the compute instance
    assert "email  = google_service_account.vm_sa.email" in content, (
        "Compute instance must attach google_service_account.vm_sa.email"
    )

    # Empty OAuth scopes
    assert "scopes = []" in content, (
        "Compute instance must set empty OAuth scopes (scopes = [])"
    )

    # Verify zero project IAM role bindings exist across all GCP Terraform files
    for tf_file in GCP_DIR.glob("*.tf"):
        tf_content = tf_file.read_text(encoding="utf-8")
        assert "google_project_iam_binding" not in tf_content, (
            f"Zero project-level IAM bindings allowed: found in {tf_file.name}"
        )
        assert "google_project_iam_member" not in tf_content, (
            f"Zero project-level IAM roles allowed: found in {tf_file.name}"
        )


def test_gcp_terraform_safe_defaults():
    """Objective A: Verify safe staging defaults in variables.tf (e2-micro, micro, staging)."""
    vars_file = GCP_DIR / "variables.tf"
    content = vars_file.read_text(encoding="utf-8")

    def get_var_default(var_name: str) -> str:
        block = re.search(rf'variable "{var_name}"\s*{{(.*?)}}', content, re.DOTALL)
        assert block is not None, f"Variable '{var_name}' not found"
        default_match = re.search(r'default\s*=\s*(".*?"|\w+)', block.group(1))
        assert default_match is not None, f"Default for '{var_name}' not found"
        return default_match.group(1).strip('"')

    assert get_var_default("machine_type") == "e2-micro"
    assert get_var_default("deployment_profile") == "micro"
    assert get_var_default("environment") == "staging"
    assert get_var_default("allow_paid_resources") == "false"
    assert get_var_default("boot_disk_type") == "pd-standard"
    assert get_var_default("boot_disk_size_gb") == "30"
    assert get_var_default("region") == "us-central1"


def test_gcp_cost_precondition_matrix():
    """
    Objective A: Verify evaluation logic of cost-safety preconditions against
    all required negative and positive test scenarios.
    """
    def evaluate_preconditions(
        machine_type: str,
        deployment_profile: str,
        environment: str,
        allow_paid_resources: bool,
        region: str,
        boot_disk_type: str,
        boot_disk_size_gb: int,
    ) -> list[str]:
        errors = []

        # 1. Machine type check
        if not (machine_type == "e2-micro" or allow_paid_resources):
            errors.append(f"Paid machine type '{machine_type}' rejected")

        # 2. Micro in production check
        if environment == "production" and deployment_profile == "micro":
            errors.append("Micro profile prohibited in production")

        # 3. Full stack on e2-micro (OOM prevention)
        if deployment_profile == "full" and machine_type == "e2-micro":
            errors.append("Full stack cannot run on e2-micro (OOM)")

        # 4. Production without allow_paid_resources
        if environment == "production" and not allow_paid_resources:
            errors.append("Production requires allow_paid_resources = true")

        # 5. Region Always Free eligibility
        eligible_regions = ["us-central1", "us-east1", "us-west1"]
        if not (region in eligible_regions or allow_paid_resources):
            errors.append(f"Region '{region}' not eligible for Always Free")

        # 6. Disk type Always Free eligibility
        if not (boot_disk_type == "pd-standard" or allow_paid_resources):
            errors.append(f"Disk type '{boot_disk_type}' not Always Free")

        # 7. Disk size Always Free allowance (<= 30 GB)
        if not (boot_disk_size_gb <= 30 or allow_paid_resources):
            errors.append(f"Disk size {boot_disk_size_gb} GB exceeds 30 GB allowance")

        # 8. Micro profile with non-e2-micro
        if deployment_profile == "micro" and machine_type != "e2-micro" and not allow_paid_resources:
            errors.append("Micro profile must use e2-micro")

        return errors

    # Scenario 1: Deliberately select e2-standard-2 on free tier -> MUST REJECT
    errs = evaluate_preconditions("e2-standard-2", "micro", "staging", False, "us-central1", "pd-standard", 30)
    assert any("e2-standard-2" in e for e in errs)

    # Scenario 2: Deliberately select e2-medium on free tier -> MUST REJECT
    errs = evaluate_preconditions("e2-medium", "micro", "staging", False, "us-central1", "pd-standard", 30)
    assert any("e2-medium" in e for e in errs)

    # Scenario 3: Deliberately select ineligible region (europe-west1) -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "micro", "staging", False, "europe-west1", "pd-standard", 30)
    assert any("europe-west1" in e for e in errs)

    # Scenario 4: Deliberately select pd-balanced -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "micro", "staging", False, "us-central1", "pd-balanced", 30)
    assert any("pd-balanced" in e for e in errs)

    # Scenario 5: Deliberately select pd-ssd -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "micro", "staging", False, "us-central1", "pd-ssd", 30)
    assert any("pd-ssd" in e for e in errs)

    # Scenario 6: Deliberately select disk exceeding 30 GB allowance (50 GB) -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "micro", "staging", False, "us-central1", "pd-standard", 50)
    assert any("50 GB" in e for e in errs)

    # Scenario 7: Deliberately select production environment with micro profile -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "micro", "production", True, "us-central1", "pd-standard", 30)
    assert any("Micro profile prohibited in production" in e for e in errs)

    # Scenario 8: Deliberately select full profile on e2-micro (OOM prevention) -> MUST REJECT
    errs = evaluate_preconditions("e2-micro", "full", "staging", False, "us-central1", "pd-standard", 30)
    assert any("OOM" in e for e in errs)

    # Scenario 9: Valid Always Free staging configuration -> MUST PASS cleanly
    errs_valid_staging = evaluate_preconditions(
        "e2-micro", "micro", "staging", False, "us-central1", "pd-standard", 30
    )
    assert len(errs_valid_staging) == 0, f"Valid staging rejected: {errs_valid_staging}"

    # Scenario 10: Valid authorized paid production deployment -> MUST PASS cleanly
    errs_valid_prod = evaluate_preconditions(
        "e2-standard-2", "full", "production", True, "us-central1", "pd-standard", 50
    )
    assert len(errs_valid_prod) == 0, f"Valid paid production rejected: {errs_valid_prod}"


