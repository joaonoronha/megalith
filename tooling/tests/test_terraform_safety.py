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
