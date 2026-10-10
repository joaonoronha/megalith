"""
Unit tests for Megalith selective CI change classification.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "tooling"))

from classify_changes import classify_files, write_github_outputs  # type: ignore


def test_api_only_changes():
    res = classify_files(["apps/demo/api/src/main.py", "apps/demo/api/tests/test_api.py"])
    assert res.platform is True
    assert res.demo_api is True
    assert res.container_api is True
    assert res.container_smoke is True
    assert res.demo_web is False
    assert res.container_web is False
    assert res.docs_only is False
    assert res.all_triggered is False


def test_web_only_changes():
    res = classify_files(["apps/demo/web/src/App.tsx", "apps/demo/web/package.json"])
    assert res.platform is True
    assert res.demo_web is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.demo_api is False
    assert res.container_api is False
    assert res.docs_only is False
    assert res.all_triggered is False


def test_demo_product_manifest_changes():
    res = classify_files(["apps/demo/product.yaml"])
    assert res.platform is True
    assert res.demo_api is True
    assert res.demo_web is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.docs_only is False


@pytest.mark.parametrize(
    "shared_file",
    [
        "projects.yaml",
        "tooling/schemas/service.schema.json",
        "tooling/validate.py",
        "platform/cli/megalith/runner.py",
        ".github/workflows/ci.yaml",
    ],
)
def test_global_infrastructure_triggers_all(shared_file: str):
    res = classify_files([shared_file])
    assert res.platform is True
    assert res.terraform is True
    assert res.demo_api is True
    assert res.demo_web is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.all_triggered is True
    assert res.docs_only is False


def test_container_infrastructure_changes():
    res = classify_files(["platform/deploy/compose.yaml", "tooling/verify_containers.py"])
    assert res.platform is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.docs_only is False


def test_docs_only_changes():
    res = classify_files([
        "docs/decisions/adr-008-cicd.md",
        "README.md",
        "apps/demo/README.md",
        ".github/pull_request_template.md",
    ])
    assert res.platform is True
    assert res.docs_only is True
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.container_api is False
    assert res.container_web is False
    assert res.container_smoke is False
    assert res.all_triggered is False


def test_mixed_docs_and_code():
    res = classify_files([
        "README.md",
        "apps/demo/api/src/main.py",
    ])
    assert res.platform is True
    assert res.demo_api is True
    assert res.container_api is True
    assert res.container_smoke is True
    assert res.demo_web is False
    assert res.container_web is False
    assert res.docs_only is False


def test_terraform_only_changes():
    res = classify_files([
        "platform/infra/oci/versions.tf",
        "platform/infra/oci/network.tf",
        "platform/infra/oci/compute.tf",
    ])
    assert res.platform is True
    assert res.terraform is True
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.container_api is False
    assert res.container_web is False
    assert res.container_smoke is False
    assert res.docs_only is False
    assert res.all_triggered is False


def test_terraform_docs_only_changes():
    res = classify_files(["platform/infra/oci/README.md"])
    assert res.platform is True
    assert res.docs_only is True
    assert res.terraform is False
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.container_api is False
    assert res.container_web is False
    assert res.container_smoke is False


def test_unmatched_file_triggers_conservative_fallback():
    res = classify_files(["packages/unknown/file.txt"])
    assert res.platform is True
    assert res.terraform is True
    assert res.all_triggered is True
    assert res.demo_api is True
    assert res.demo_web is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.docs_only is False


def test_force_all_triggers_everything():
    res = classify_files([], force_all=True)
    assert res.platform is True
    assert res.terraform is True
    assert res.all_triggered is True
    assert res.demo_api is True
    assert res.demo_web is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.container_smoke is True
    assert res.docs_only is False


def test_github_output_writing(tmp_path: Path):
    output_file = tmp_path / "github_output.txt"
    res = classify_files(["apps/demo/api/src/main.py"])
    write_github_outputs(res, str(output_file))

    content = output_file.read_text(encoding="utf-8")
    assert "platform=true\n" in content
    assert "terraform=false\n" in content
    assert "demo_api=true\n" in content
    assert "demo_web=false\n" in content
    assert "container_api=true\n" in content
    assert "container_web=false\n" in content
    assert "container_smoke=true\n" in content
    assert "docs_only=false\n" in content


def test_postgres_changes_trigger_containers():
    res = classify_files([
        "platform/deploy/postgres/init/01-init-demo-db.sh",
        "platform/deploy/postgres/provision.py",
        "tooling/verify_postgres.py",
    ])
    assert res.platform is True
    assert res.container_smoke is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.terraform is False
    assert res.docs_only is False


def test_ingress_changes_trigger_containers():
    res = classify_files([
        "platform/deploy/caddy/Caddyfile",
        "platform/deploy/caddy/Caddyfile.local",
        "platform/deploy/compose.local-ingress.yaml",
        "platform/deploy/compose.prod.yaml",
        "tooling/verify_ingress.py",
    ])
    assert res.platform is True
    assert res.container_smoke is True
    assert res.container_api is True
    assert res.container_web is True
    assert res.demo_api is False
    assert res.demo_web is False
    assert res.terraform is False
    assert res.docs_only is False
