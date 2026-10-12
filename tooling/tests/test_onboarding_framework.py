"""
Automated regression tests for Megalith Product & Service Onboarding Framework (Task 019).

Verifies all 16 required failure, edge, and safety scenarios:
1. Valid product generation.
2. Valid service generation (FastAPI, React, Go).
3. Duplicate identifiers rejection.
4. Unsafe paths and path traversal rejection.
5. Existing-file preservation.
6. Deterministic generation.
7. Manifest validation passing via ManifestValidator.
8. Language-specific template syntax and structure.
9. PostgreSQL role and database isolation script generation (ADR-007).
10. Manifest-driven selective CI discovery.
11. Compose configuration generation and syntax validation.
12. Ingress routing and port conflict detection.
13. Resource and architecture compatibility.
14. Secret hygiene (zero plaintext credentials).
15. Preview mode without filesystem writes.
16. No cloud operations (100% offline).
"""

from __future__ import annotations

import ast
import json
import os
import shutil
import sys
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "cli"))
sys.path.insert(0, str(REPO_ROOT / "tooling"))

from megalith.scaffold import (
    ConflictError,
    InvalidIdentifierError,
    PathTraversalError,
    ScaffoldEngine,
    ScaffoldError,
    TemplateNotFoundError,
    validate_identifier,
)
from classify_changes import classify_files  # type: ignore
from validate import ManifestValidator  # type: ignore


@pytest.fixture
def mock_repo(tmp_path: Path) -> Path:
    """Sets up an isolated mock monorepo with projects.yaml and platform templates."""
    # Copy templates
    shutil.copytree(REPO_ROOT / "platform" / "templates", tmp_path / "platform" / "templates")
    # Copy schemas
    shutil.copytree(REPO_ROOT / "tooling" / "schemas", tmp_path / "tooling" / "schemas")

    # Create projects.yaml with baseline demo product
    projects_content = """version: 1
products:
  - id: demo
    manifest: apps/demo/product.yaml
"""
    (tmp_path / "projects.yaml").write_text(projects_content, encoding="utf-8")

    # Create apps/demo with minimal manifest
    demo_dir = tmp_path / "apps" / "demo"
    demo_dir.mkdir(parents=True)
    demo_product = """id: demo
name: Megalith Demo
description: Baseline demo product.
docs: README.md
services:
  - id: api
    manifest: api/service.yaml
  - id: web
    manifest: web/service.yaml
"""
    (demo_dir / "product.yaml").write_text(demo_product, encoding="utf-8")
    (demo_dir / "README.md").write_text("# Demo\n", encoding="utf-8")

    # demo api
    (demo_dir / "api").mkdir()
    demo_api_svc = """id: api
product: demo
type: api
runtime:
  language: python
  version: "3.12"
  framework: FastAPI
path: apps/demo/api
commands:
  dev:
    - uvicorn
    - src.main:app
    - --port
    - "8000"
  test:
    - pytest
  check:
    - ruff
    - check
artifact:
  type: docker
  image_name: megalith-demo-api
deployment:
  deployable: true
  target: oci-vm
"""
    (demo_dir / "api" / "service.yaml").write_text(demo_api_svc, encoding="utf-8")

    # demo web
    (demo_dir / "web").mkdir()
    demo_web_svc = """id: web
product: demo
type: web
runtime:
  language: typescript
  version: "5.x"
  framework: React
path: apps/demo/web
commands:
  dev:
    - pnpm
    - dev
  test:
    - pnpm
    - test
  check:
    - pnpm
    - check
artifact:
  type: docker
  image_name: megalith-demo-web
deployment:
  deployable: true
  target: oci-vm
"""
    (demo_dir / "web" / "service.yaml").write_text(demo_web_svc, encoding="utf-8")

    # Create deploy compose.yaml
    deploy_dir = tmp_path / "platform" / "deploy"
    deploy_dir.mkdir(parents=True)
    compose_content = """services:
  demo-api:
    image: megalith-demo-api:local
    ports:
      - "8000:8000"
  demo-web:
    image: megalith-demo-web:local
    ports:
      - "8080:8080"
"""
    (deploy_dir / "compose.yaml").write_text(compose_content, encoding="utf-8")

    return tmp_path


# Scenario 1: Valid product generation
def test_valid_product_generation(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    result = engine.create_product(
        product_id="fitness",
        name="Fitness Tracker",
        description="Personal workout logging application.",
    )

    assert result.product_id == "fitness"
    assert result.dry_run is False

    prod_yaml = mock_repo / "apps" / "fitness" / "product.yaml"
    readme = mock_repo / "apps" / "fitness" / "README.md"
    assert prod_yaml.is_file()
    assert readme.is_file()

    # Verify registration in projects.yaml
    projects_content = (mock_repo / "projects.yaml").read_text(encoding="utf-8")
    assert "- id: fitness" in projects_content
    assert "manifest: apps/fitness/product.yaml" in projects_content


# Scenario 2: Valid service generation across all 3 templates
@pytest.mark.parametrize("template", ["fastapi", "react", "go"])
def test_valid_service_generation_all_templates(mock_repo: Path, template: str):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product(product_id="analytics")

    result = engine.add_service(
        product_id="analytics",
        service_id=f"svc-{template}",
        template=template,
        port=9000,
    )

    assert result.service_id == f"svc-{template}"
    svc_dir = mock_repo / "apps" / "analytics" / f"svc-{template}"
    assert svc_dir.is_dir()
    assert (svc_dir / "service.yaml").is_file()
    assert (svc_dir / "Dockerfile").is_file()

    # Check template-specific marker files
    if template == "fastapi":
        assert (svc_dir / "pyproject.toml").is_file()
        assert (svc_dir / "src" / "main.py").is_file()
        assert (svc_dir / "tests" / "test_main.py").is_file()
    elif template == "react":
        assert (svc_dir / "package.json").is_file()
        assert (svc_dir / "tsconfig.json").is_file()
        assert (svc_dir / "src" / "App.tsx").is_file()
    elif template == "go":
        assert (svc_dir / "go.mod").is_file()
        assert (svc_dir / "main.go").is_file()
        assert (svc_dir / "main_test.go").is_file()


# Scenario 3: Duplicate identifiers rejection
def test_duplicate_identifiers_rejected(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product(product_id="billing")

    # Duplicate product rejected
    with pytest.raises(ConflictError) as exc_p:
        engine.create_product(product_id="billing")
    assert "already registered" in str(exc_p.value)

    engine.add_service(product_id="billing", service_id="api", template="fastapi")

    # Duplicate service rejected
    with pytest.raises(ConflictError) as exc_s:
        engine.add_service(product_id="billing", service_id="api", template="fastapi")
    assert "already registered" in str(exc_s.value)


# Scenario 4: Unsafe paths and path traversal rejection
@pytest.mark.parametrize(
    "bad_id",
    [
        "../traversal",
        "/absolute",
        "invalid_underscore",
        "CamelCase",
        "spaces in name",
        "punct!uation",
        "system",  # reserved
        "platform",  # reserved
    ],
)
def test_unsafe_paths_and_identifiers_rejected(mock_repo: Path, bad_id: str):
    engine = ScaffoldEngine(mock_repo)
    with pytest.raises((InvalidIdentifierError, PathTraversalError)):
        engine.create_product(product_id=bad_id)


# Scenario 5: Existing-file preservation
def test_existing_file_preservation(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product(product_id="notes")

    # Manually create conflicting file
    notes_dir = mock_repo / "apps" / "notes" / "api"
    notes_dir.mkdir(parents=True)
    custom_file = notes_dir / "custom.txt"
    custom_file.write_text("precious user content", encoding="utf-8")

    # Adding service without force must fail and preserve custom.txt
    with pytest.raises(ConflictError):
        engine.add_service(product_id="notes", service_id="api", template="fastapi", force=False)

    assert custom_file.read_text(encoding="utf-8") == "precious user content"


# Scenario 6: Deterministic generation
def test_deterministic_generation(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)

    res1 = engine.create_product("det-prod", dry_run=True)
    res2 = engine.create_product("det-prod", dry_run=True)

    assert len(res1.files_to_create) == len(res2.files_to_create)
    for f1, f2 in zip(res1.files_to_create, res2.files_to_create):
        assert f1.relative_path == f2.relative_path
        assert f1.content == f2.content


# Scenario 7: Manifest validation passing via ManifestValidator
def test_manifest_validation_succeeds_on_scaffolded_product(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("inventory")
    engine.add_service("inventory", "api", template="fastapi", port=9010)
    engine.add_service("inventory", "web", template="react", port=9020)
    engine.add_service("inventory", "worker", template="go", port=9030, service_type="worker")

    validator = ManifestValidator(repo_root=mock_repo)
    res = validator.validate(catalog_rel_path="projects.yaml")

    assert res.is_valid is True, f"Manifest validation failed with errors: {res.errors}"
    assert "inventory" in res.products
    assert "inventory/api" in res.services
    assert "inventory/web" in res.services
    assert "inventory/worker" in res.services


# Scenario 8: Language-specific template syntax and structure
def test_language_specific_syntax_and_structure(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("polyglot")

    engine.add_service("polyglot", "api", template="fastapi")
    engine.add_service("polyglot", "web", template="react")
    engine.add_service("polyglot", "worker", template="go")

    # 1. FastAPI: Python AST parse verification
    main_py = (mock_repo / "apps" / "polyglot" / "api" / "src" / "main.py").read_text(encoding="utf-8")
    ast.parse(main_py)

    # 2. React: JSON validity
    pkg_json = json.loads((mock_repo / "apps" / "polyglot" / "web" / "package.json").read_text(encoding="utf-8"))
    assert pkg_json["name"] == "polyglot-web"
    assert "react" in pkg_json["dependencies"]

    # 3. Go: Module check
    go_mod = (mock_repo / "apps" / "polyglot" / "worker" / "go.mod").read_text(encoding="utf-8")
    assert "module megalith/apps/polyglot/worker" in go_mod


# Scenario 9: PostgreSQL role and database isolation script generation (ADR-007)
def test_postgresql_isolation_script_generation(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("finance")
    engine.add_service("finance", "api", template="fastapi", with_database=True)

    # Verify service dependencies declare postgresql
    svc_data = yaml.safe_load((mock_repo / "apps" / "finance" / "api" / "service.yaml").read_text(encoding="utf-8"))
    assert "postgresql" in svc_data.get("dependencies", {}).get("external", [])
    assert "migrate" in svc_data.get("commands", {})

    # Verify init script generated
    init_dir = mock_repo / "platform" / "deploy" / "postgres" / "init"
    scripts = list(init_dir.glob("*-init-finance-db.sh"))
    assert len(scripts) == 1
    script_content = scripts[0].read_text(encoding="utf-8")

    # Assert ADR-007 isolation constraints
    assert "db_finance" in script_content
    assert "role_finance_migrate" in script_content
    assert "role_finance_app" in script_content
    assert "REVOKE CONNECT ON DATABASE ${DB_NAME} FROM PUBLIC;" in script_content
    assert "GRANT USAGE ON SCHEMA public TO ${DB_APP_USER};" in script_content
    assert "ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_MIGRATE_USER}" in script_content


# Scenario 10: Manifest-driven selective CI discovery
def test_manifest_driven_ci_discovery(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("iot")
    engine.add_service("iot", "gateway", template="go")

    # Classifying file change in newly scaffolded service
    res = classify_files(["apps/iot/gateway/main.go"], repo_root=mock_repo)
    assert res.platform is True
    assert "iot/gateway" in res.triggered_services
    assert "iot" in res.triggered_products
    assert res.docs_only is False


# Scenario 11: Compose configuration generation and syntax validation
def test_compose_snippet_generation_and_validity(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    snippet = engine.generate_compose_snippet(
        product_id="auth",
        service_id="server",
        template="fastapi",
        port=8085,
        with_database=True,
    )

    full_yaml = f"services:\n{snippet}\nnetworks:\n  edge-network:\n  data-network:\n"
    parsed = yaml.safe_load(full_yaml)
    assert "auth-server" in parsed["services"]
    svc = parsed["services"]["auth-server"]
    assert "edge-network" in svc["networks"]
    assert "data-network" in svc["networks"]
    assert "no-new-privileges:true" in svc["security_opt"]
    assert svc["read_only"] is True


# Scenario 12: Ingress routing and port conflict detection
def test_ingress_and_port_conflict_detection(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)

    # Check conflict against demo api (port 8000)
    conflicts = engine.check_ingress_conflicts("newapp", "api", port=8000)
    assert len(conflicts) > 0
    assert "Port conflict: Port 8000 is already used" in conflicts[0]

    # Generate Caddy route snippet
    caddy_snippet = engine.generate_caddy_route_snippet("newapp", "api", port=8005)
    assert "reverse_proxy newapp-api:8005" in caddy_snippet


# Scenario 13: Resource and architecture compatibility
def test_resource_and_architecture_compatibility(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("edge")
    engine.add_service("edge", "agent", template="go", target="oci-vm", deployable=True)

    svc_data = yaml.safe_load((mock_repo / "apps" / "edge" / "agent" / "service.yaml").read_text(encoding="utf-8"))
    assert svc_data["deployment"]["deployable"] is True
    assert svc_data["deployment"]["target"] == "oci-vm"
    assert svc_data["artifact"]["type"] == "docker"


# Scenario 14: Secret hygiene (zero plaintext credentials)
def test_secret_hygiene(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    engine.create_product("secure")
    engine.add_service("secure", "api", template="fastapi", with_database=True)

    svc_dir = mock_repo / "apps" / "secure" / "api"
    for path in svc_dir.rglob("*"):
        if path.is_file():
            content = path.read_text(encoding="utf-8", errors="ignore")
            # Verify no real credentials, only sanitized placeholders
            assert "supersecret" not in content.lower()
            assert "real_password" not in content.lower()
            assert "prod_key" not in content.lower()


# Scenario 15: Preview mode without filesystem writes
def test_preview_mode_without_filesystem_writes(mock_repo: Path):
    engine = ScaffoldEngine(mock_repo)
    result = engine.create_product("ghost", dry_run=True)

    assert result.dry_run is True
    assert len(result.files_to_create) == 2
    assert not (mock_repo / "apps" / "ghost").exists()

    # projects.yaml must NOT be modified
    projects_content = (mock_repo / "projects.yaml").read_text(encoding="utf-8")
    assert "ghost" not in projects_content


# Scenario 16: No cloud operations (100% offline)
def test_no_cloud_operations(mock_repo: Path, monkeypatch):
    import urllib.request

    def fail_on_network(*args, **kwargs):
        raise AssertionError("Network / cloud request made during local scaffolding!")

    monkeypatch.setattr(urllib.request, "urlopen", fail_on_network)

    engine = ScaffoldEngine(mock_repo)
    engine.create_product("offline-prod")
    engine.add_service("offline-prod", "api", template="fastapi")
    engine.add_service("offline-prod", "web", template="react")
    engine.add_service("offline-prod", "worker", template="go")

    assert (mock_repo / "apps" / "offline-prod").is_dir()
