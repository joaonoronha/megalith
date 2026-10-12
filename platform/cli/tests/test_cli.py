"""
Comprehensive tests for Megalith Platform CLI.

Covers:
- Repository root discovery (root, nested directories, outside repo, overrides)
- megalith --help
- megalith list (empty, populated, ordering, invalid catalog)
- megalith info (existing, unknown, optional fields, dependency rendering)
- megalith validate (valid, invalid manifests, exit codes)
- megalith run (successful execution, exit code propagation, working directory,
  array commands, missing executables, unknown service/command, path security)
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import yaml
from megalith.main import app
from typer.testing import CliRunner


class TestMegalithCLI(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp(prefix="megalith_cli_test_")
        self.repo_root = Path(self.temp_dir)

        # Copy tooling/schemas to temp repo
        repo_actual = Path(__file__).resolve().parent.parent.parent.parent
        src_schemas = repo_actual / "tooling" / "schemas"
        dst_schemas = self.repo_root / "tooling" / "schemas"
        dst_schemas.mkdir(parents=True, exist_ok=True)
        for s in src_schemas.glob("*.json"):
            shutil.copy2(s, dst_schemas / s.name)

        # Copy tooling/validate.py to temp repo
        dst_tooling = self.repo_root / "tooling"
        dst_tooling.mkdir(parents=True, exist_ok=True)
        shutil.copy2(repo_actual / "tooling" / "validate.py", dst_tooling / "validate.py")
        (dst_tooling / "__init__.py").touch()

        # Copy platform/templates to temp repo for scaffolding
        src_templates = repo_actual / "platform" / "templates"
        if src_templates.exists():
            shutil.copytree(src_templates, self.repo_root / "platform" / "templates", dirs_exist_ok=True)

        # Add canonical Megalith repo markers
        self._write_file("AGENTS.md", "# Megalith Guidelines\n")
        self._write_yaml("projects.yaml", {"version": 1, "products": []})

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _write_file(self, rel_path: str, content: str = "") -> Path:
        full_path = self.repo_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return full_path

    def _write_yaml(self, rel_path: str, data: dict) -> Path:
        full_path = self.repo_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)
        return full_path

    def _setup_fixture_products(self) -> None:
        """Sets up a multi-product fixture with fitness and finance products."""
        self._write_yaml(
            "projects.yaml",
            {
                "version": 1,
                "products": [
                    {"id": "fitness", "manifest": "apps/fitness/product.yaml"},
                    {"id": "finance", "manifest": "apps/finance/product.yaml"},
                ],
            },
        )
        # Fitness Product
        self._write_file("apps/fitness/README.md", "# Fitness\n")
        self._write_yaml(
            "apps/fitness/product.yaml",
            {
                "id": "fitness",
                "name": "Fitness Tracker",
                "description": "Health tracking product",
                "docs": "README.md",
                "services": [
                    {"id": "api", "manifest": "api/service.yaml"},
                    {"id": "web", "manifest": "web/service.yaml"},
                ],
            },
        )
        (self.repo_root / "apps" / "fitness" / "api").mkdir(parents=True, exist_ok=True)
        (self.repo_root / "apps" / "fitness" / "web").mkdir(parents=True, exist_ok=True)

        self._write_yaml(
            "apps/fitness/api/service.yaml",
            {
                "id": "api",
                "product": "fitness",
                "type": "api",
                "runtime": {"language": "python", "version": "3.12", "framework": "FastAPI"},
                "path": "apps/fitness/api",
                "commands": {
                    "test": f"{sys.executable} -c \"print('api tests passing')\"",
                    "exit_err": f"{sys.executable} -c \"import sys; sys.exit(42)\"",
                    "print_cwd": f"{sys.executable} -c \"import os; print('CWD:' + os.getcwd())\"",
                    "array_cmd": [sys.executable, "-c", "print('array command ok')"],
                },
                "artifact": {"type": "docker", "image_name": "fitness-api"},
                "deployment": {"deployable": True, "target": "oci-vm"},
                "dependencies": {"services": [], "external": ["postgresql"]},
            },
        )

        self._write_yaml(
            "apps/fitness/web/service.yaml",
            {
                "id": "web",
                "product": "fitness",
                "type": "web",
                "runtime": {"language": "typescript", "framework": "Next.js"},
                "path": "apps/fitness/web",
                "commands": {
                    "build": f"{sys.executable} -c \"print('web build ok')\"",
                },
                "artifact": {"type": "static"},
                "deployment": {"deployable": True, "target": "static"},
                "dependencies": {"services": ["fitness/api"]},
            },
        )

        # Finance Product
        self._write_file("apps/finance/README.md", "# Finance\n")
        self._write_yaml(
            "apps/finance/product.yaml",
            {
                "id": "finance",
                "name": "Personal Finance",
                "description": "Money management tool",
                "docs": "README.md",
                "services": [
                    {"id": "worker", "manifest": "worker/service.yaml"},
                ],
            },
        )
        (self.repo_root / "apps" / "finance" / "worker").mkdir(parents=True, exist_ok=True)
        self._write_yaml(
            "apps/finance/worker/service.yaml",
            {
                "id": "worker",
                "product": "finance",
                "type": "worker",
                "runtime": {"language": "go", "version": "1.22"},
                "path": "apps/finance/worker",
                "commands": {
                    "check": f"{sys.executable} -c \"print('worker check ok')\"",
                },
                "artifact": {"type": "binary"},
                "deployment": {"deployable": True, "target": "oci-vm"},
            },
        )

    # 1. Help Command
    def test_help_command(self) -> None:
        result = self.runner.invoke(app, ["--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Megalith Monorepo Developer Platform CLI", result.output)
        self.assertIn("list", result.output)
        self.assertIn("info", result.output)
        self.assertIn("validate", result.output)
        self.assertIn("run", result.output)

    # 2. Repository Discovery
    def test_discovery_from_root(self) -> None:
        orig_cwd = os.getcwd()
        try:
            os.chdir(self.repo_root)
            result = self.runner.invoke(app, ["list"])
            self.assertEqual(result.exit_code, 0)
        finally:
            os.chdir(orig_cwd)

    def test_discovery_from_nested_directory(self) -> None:
        self._setup_fixture_products()
        nested_dir = self.repo_root / "apps" / "fitness" / "api"
        orig_cwd = os.getcwd()
        try:
            os.chdir(nested_dir)
            result = self.runner.invoke(app, ["list"])
            self.assertEqual(result.exit_code, 0)
            self.assertIn("fitness", result.output)
            self.assertIn("fitness/api", result.output)
        finally:
            os.chdir(orig_cwd)

    def test_discovery_outside_repository(self) -> None:
        empty_temp = tempfile.mkdtemp(prefix="non_repo_")
        orig_cwd = os.getcwd()
        try:
            os.chdir(empty_temp)
            result = self.runner.invoke(app, ["list"])
            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("Not inside a Megalith repository", result.output)
        finally:
            os.chdir(orig_cwd)
            shutil.rmtree(empty_temp, ignore_errors=True)

    def test_discovery_explicit_root_override(self) -> None:
        result = self.runner.invoke(app, ["list", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)

    def test_discovery_invalid_explicit_root(self) -> None:
        fake_path = self.repo_root / "nonexistent_dir"
        result = self.runner.invoke(app, ["list", "--repo-root", str(fake_path)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertTrue("not a" in result.output and "valid Megalith repository" in result.output)

    # 3. Command: megalith list
    def test_list_empty_catalog(self) -> None:
        result = self.runner.invoke(app, ["list", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("No products registered", result.output)

    def test_list_populated_catalog(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["list", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("fitness", result.output)
        self.assertIn("fitness/api", result.output)
        self.assertIn("fitness/web", result.output)
        self.assertIn("finance", result.output)
        self.assertIn("finance/worker", result.output)

    def test_list_deterministic_ordering(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["list", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        finance_pos = result.output.find("finance")
        fitness_pos = result.output.find("fitness")
        self.assertTrue(finance_pos < fitness_pos, "Expected finance to be listed before fitness alphabetically")

    def test_list_invalid_catalog(self) -> None:
        self._write_file("projects.yaml", "version: invalid")
        result = self.runner.invoke(app, ["list", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("is invalid", result.output)

    # 4. Command: megalith info
    def test_info_existing_service(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["info", "fitness/api", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("fitness/api", result.output)
        self.assertIn("Fitness Tracker", result.output)
        self.assertIn("FastAPI", result.output)
        self.assertIn("apps/fitness/api", result.output)
        self.assertIn("postgresql", result.output)
        self.assertIn("oci-vm", result.output)

    def test_info_unknown_service(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["info", "fitness/unknown", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Unknown service 'fitness/unknown'", result.output)

    def test_info_optional_fields_handling(self) -> None:
        self._setup_fixture_products()
        # finance/worker has no external dependencies and no framework
        result = self.runner.invoke(app, ["info", "finance/worker", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("finance/worker", result.output)
        self.assertIn("go", result.output)

    # 5. Command: megalith validate
    def test_validate_clean_repository(self) -> None:
        result = self.runner.invoke(app, ["validate", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("STATUS: SUCCESS", result.output)

    def test_validate_populated_repository(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["validate", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("STATUS: SUCCESS", result.output)
        self.assertIn("Products Found  : 2", result.output)
        self.assertIn("Services Found  : 3", result.output)

    def test_validate_invalid_repository(self) -> None:
        self._write_file("projects.yaml", "malformed: yaml: :")
        result = self.runner.invoke(app, ["validate", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("STATUS: FAILED", result.output)

    # 6. Command: megalith run
    def test_run_successful_command(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "fitness/api", "test", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("api tests passing", result.output)

    def test_run_array_command(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "fitness/api", "array_cmd", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("array command ok", result.output)

    def test_run_failed_command_exit_code_propagation(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "fitness/api", "exit_err", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 42)

    def test_run_working_directory_isolation(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "fitness/api", "print_cwd", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 0)
        expected_cwd = str((self.repo_root / "apps" / "fitness" / "api").resolve())
        self.assertIn(f"CWD:{expected_cwd}", result.output)

    def test_run_unknown_service(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "nonexistent/service", "test", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Unknown service 'nonexistent/service'", result.output)

    def test_run_unknown_command(self) -> None:
        self._setup_fixture_products()
        result = self.runner.invoke(app, ["run", "fitness/api", "nonexistent_cmd", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertTrue("does not declare lifecycle command" in result.output and "nonexistent_cmd" in result.output)

    def test_run_missing_executable(self) -> None:
        self._setup_fixture_products()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["commands"]["missing"] = "nonexistent_executable_12345 --flag"
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        result = self.runner.invoke(app, ["run", "fitness/api", "missing", "--repo-root", str(self.repo_root)])
        self.assertEqual(result.exit_code, 127)
        self.assertIn("was not found on PATH", result.output)

    def test_run_escaping_working_directory_rejected(self) -> None:
        self._setup_fixture_products()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["path"] = "../../outside_repo"
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        result = self.runner.invoke(app, ["run", "fitness/api", "test", "--repo-root", str(self.repo_root)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("validation failed", result.output)

    def test_staging_help(self) -> None:
        result = self.runner.invoke(app, ["staging", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("preflight", result.output)
        self.assertIn("dry-run", result.output)

    def test_staging_preflight_local(self) -> None:
        repo_actual = Path(__file__).resolve().parent.parent.parent.parent
        result = self.runner.invoke(app, ["staging", "preflight", "--mode", "local", "--repo-root", str(repo_actual)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("PREFLIGHT RESULT: PASSED", result.output)

    def test_staging_preflight_json(self) -> None:
        repo_actual = Path(__file__).resolve().parent.parent.parent.parent
        result = self.runner.invoke(app, ["staging", "preflight", "--mode", "local", "--json", "--repo-root", str(repo_actual)])
        self.assertEqual(result.exit_code, 0)
        data = json.loads(result.output)
        self.assertTrue(data.get("all_passed"))
        self.assertEqual(data.get("mode"), "local")

    def test_staging_dry_run_local(self) -> None:
        repo_actual = Path(__file__).resolve().parent.parent.parent.parent
        result = self.runner.invoke(app, ["staging", "dry-run", "--mode", "local", "--repo-root", str(repo_actual)])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Dry-Run Summary", result.output)
        self.assertIn("Resource Inventory", result.output)
        self.assertIn("Cleanup Plan", result.output)
        self.assertIn("OFFLINE_VALIDATED", result.output)

    def test_staging_invalid_mode(self) -> None:
        repo_actual = Path(__file__).resolve().parent.parent.parent.parent
        result = self.runner.invoke(app, ["staging", "preflight", "--mode", "invalid-mode", "--repo-root", str(repo_actual)])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Invalid mode 'invalid-mode'", result.output)

    # 10. Product and Service Scaffolding CLI Commands
    def test_product_help(self) -> None:
        result = self.runner.invoke(app, ["product", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("create", result.output)
        self.assertIn("validate", result.output)
        self.assertIn("list", result.output)

    def test_product_create_dry_run(self) -> None:
        result = self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--description", "A test", "--dry-run", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Dry-run mode", result.output)
        self.assertFalse((self.repo_root / "apps" / "testprod").exists())

    def test_product_create_and_validate(self) -> None:
        result = self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--description", "A test", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(result.exit_code, 0)
        self.assertTrue((self.repo_root / "apps" / "testprod" / "product.yaml").exists())

        # Validate product
        val_result = self.runner.invoke(
            app,
            ["product", "validate", "testprod", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(val_result.exit_code, 0)
        self.assertIn("valid", val_result.output.lower())

    def test_service_help(self) -> None:
        result = self.runner.invoke(app, ["service", "--help"])
        self.assertEqual(result.exit_code, 0)
        self.assertIn("add", result.output)

    def test_service_add_dry_run(self) -> None:
        self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--repo-root", str(self.repo_root)],
        )
        result = self.runner.invoke(
            app,
            ["service", "add", "testprod", "api", "--template", "fastapi", "--port", "8001", "--dry-run", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(result.exit_code, 0)
        self.assertIn("Dry-run mode", result.output)
        self.assertFalse((self.repo_root / "apps" / "testprod" / "api").exists())

    def test_service_add_and_validate(self) -> None:
        self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--repo-root", str(self.repo_root)],
        )
        result = self.runner.invoke(
            app,
            ["service", "add", "testprod", "api", "--template", "fastapi", "--port", "8001", "--database", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(result.exit_code, 0)
        self.assertTrue((self.repo_root / "apps" / "testprod" / "api" / "service.yaml").exists())
        init_scripts = list((self.repo_root / "platform" / "deploy" / "postgres" / "init").glob("*-init-testprod-db.sh"))
        self.assertTrue(len(init_scripts) > 0)

        val_result = self.runner.invoke(
            app,
            ["product", "validate", "testprod", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(val_result.exit_code, 0)
        self.assertIn("valid", val_result.output.lower())

    def test_service_add_port_conflict(self) -> None:
        self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--repo-root", str(self.repo_root)],
        )
        self.runner.invoke(
            app,
            ["service", "add", "testprod", "api", "--template", "fastapi", "--port", "8001", "--repo-root", str(self.repo_root)],
        )
        # Attempt to add another service with same port -> produces warning
        result = self.runner.invoke(
            app,
            ["service", "add", "testprod", "web", "--template", "react", "--port", "8001", "--repo-root", str(self.repo_root)],
        )
        self.assertEqual(result.exit_code, 0)
        self.assertIn("already assigned", result.output)

    def test_service_add_duplicate_id_rejected(self) -> None:
        self.runner.invoke(
            app,
            ["product", "create", "testprod", "--name", "Test Product", "--repo-root", str(self.repo_root)],
        )
        self.runner.invoke(
            app,
            ["service", "add", "testprod", "api", "--template", "fastapi", "--port", "8001", "--repo-root", str(self.repo_root)],
        )
        result = self.runner.invoke(
            app,
            ["service", "add", "testprod", "api", "--template", "fastapi", "--port", "8002", "--repo-root", str(self.repo_root)],
        )
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("already registered", result.output)


if __name__ == "__main__":
    unittest.main()
