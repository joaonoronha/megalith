"""
Comprehensive tests for ManifestValidator.

Covers:
- Empty catalog validity
- Valid single- and multi-product configurations
- Schema validation errors across all manifest types
- Malformed YAML handling
- Identifier format errors (uppercase, symbols)
- Duplicate product and service IDs
- Catalog-to-manifest ID mismatches
- Parent product mismatches
- Missing files (manifests, docs, working dirs)
- Path traversal and absolute path rejections
- Inter-service dependency validation (valid, missing, self-referencing)
- CLI entry point exit codes
"""

from __future__ import annotations

import os
import shutil
import tempfile
import unittest
from pathlib import Path

import yaml

from tooling.validate import ManifestValidator, ValidationResult, main


class TestManifestValidator(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.mkdtemp(prefix="megalith_test_")
        self.repo_root = Path(self.temp_dir)

        # Copy tooling/schemas to temp repo
        src_schemas = Path(__file__).resolve().parent.parent / "schemas"
        dst_schemas = self.repo_root / "tooling" / "schemas"
        dst_schemas.mkdir(parents=True, exist_ok=True)
        for s in src_schemas.glob("*.json"):
            shutil.copy2(s, dst_schemas / s.name)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _write_yaml(self, rel_path: str, data: dict) -> Path:
        full_path = self.repo_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)
        return full_path

    def _write_file(self, rel_path: str, content: str = "") -> Path:
        full_path = self.repo_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return full_path

    def _setup_valid_product(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {
                "version": 1,
                "products": [
                    {"id": "fitness", "manifest": "apps/fitness/product.yaml"}
                ],
            },
        )
        self._write_file("apps/fitness/README.md", "# Fitness Documentation")
        self._write_yaml(
            "apps/fitness/product.yaml",
            {
                "id": "fitness",
                "name": "Fitness Tracker",
                "description": "Personal health and fitness tracking",
                "docs": "README.md",
                "services": [
                    {"id": "api", "manifest": "api/service.yaml"},
                    {"id": "web", "manifest": "web/service.yaml"},
                ],
            },
        )
        # Working dirs
        (self.repo_root / "apps" / "fitness" / "api").mkdir(parents=True, exist_ok=True)
        (self.repo_root / "apps" / "fitness" / "web").mkdir(parents=True, exist_ok=True)

        self._write_yaml(
            "apps/fitness/api/service.yaml",
            {
                "id": "api",
                "product": "fitness",
                "type": "api",
                "runtime": {"language": "python", "version": "3.12"},
                "path": "apps/fitness/api",
                "commands": {
                    "dev": "uvicorn main:app",
                    "test": "pytest",
                    "lint": "ruff check",
                    "build": "docker build .",
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
                    "dev": "npm run dev",
                    "test": "npm test",
                    "lint": "npm run lint",
                    "build": "npm run build",
                },
                "artifact": {"type": "docker", "image_name": "fitness-web"},
                "deployment": {"deployable": True, "target": "oci-vm"},
                "dependencies": {"services": ["fitness/api"], "external": []},
            },
        )

    # 1. Empty catalog
    def test_empty_catalog_is_valid(self) -> None:
        self._write_yaml("projects.yaml", {"version": 1, "products": []})
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Expected valid result, got errors: {result.errors}")
        self.assertEqual(result.product_count, 0)
        self.assertEqual(result.service_count, 0)

    # 2. Valid multi-service setup
    def test_valid_manifests(self) -> None:
        self._setup_valid_product()
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Validation failed unexpectedly: {result.errors}")
        self.assertEqual(result.product_count, 1)
        self.assertEqual(result.service_count, 2)

    # 3. Malformed YAML
    def test_malformed_yaml_in_catalog(self) -> None:
        self._write_file("projects.yaml", "version: 1\nproducts: [unclosed")
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("malformed YAML" in err for err in result.errors))

    def test_malformed_yaml_in_product(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {"version": 1, "products": [{"id": "p1", "manifest": "apps/p1/product.yaml"}]},
        )
        self._write_file("apps/p1/product.yaml", ": invalid: : yaml")
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("malformed YAML" in err for err in result.errors))

    def test_malformed_yaml_in_service(self) -> None:
        self._setup_valid_product()
        self._write_file("apps/fitness/api/service.yaml", "{{{{ bad yaml")
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("malformed YAML" in err for err in result.errors))

    # 4. Schema errors
    def test_invalid_schema_in_catalog_missing_version(self) -> None:
        self._write_yaml("projects.yaml", {"products": []})
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("projects schema" in err for err in result.errors))

    def test_invalid_schema_in_product_missing_description(self) -> None:
        self._setup_valid_product()
        self._write_yaml(
            "apps/fitness/product.yaml",
            {
                "id": "fitness",
                "name": "Fitness",
                # missing description
                "docs": "README.md",
                "services": [],
            },
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("product schema" in err for err in result.errors))

    def test_invalid_schema_in_service_missing_runtime(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        del data["runtime"]
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("service schema" in err for err in result.errors))

    # 5. Identifier validation
    def test_invalid_product_id_syntax(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {"version": 1, "products": [{"id": "FitnessApp_123", "manifest": "apps/p.yaml"}]},
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("projects schema" in err or "lowercase-kebab-case" in err for err in result.errors))

    def test_duplicate_product_id(self) -> None:
        self._setup_valid_product()
        self._write_yaml(
            "projects.yaml",
            {
                "version": 1,
                "products": [
                    {"id": "fitness", "manifest": "apps/fitness/product.yaml"},
                    {"id": "fitness", "manifest": "apps/fitness/product.yaml"},
                ],
            },
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("duplicate product ID 'fitness'" in err for err in result.errors))

    def test_duplicate_service_id_in_product(self) -> None:
        self._setup_valid_product()
        self._write_yaml(
            "apps/fitness/product.yaml",
            {
                "id": "fitness",
                "name": "Fitness",
                "description": "Fitness app",
                "docs": "README.md",
                "services": [
                    {"id": "api", "manifest": "api/service.yaml"},
                    {"id": "api", "manifest": "api/service.yaml"},
                ],
            },
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("duplicate service ID 'api'" in err for err in result.errors))

    # 6. ID and Product Mismatches
    def test_product_id_mismatch_with_catalog(self) -> None:
        self._setup_valid_product()
        self._write_yaml(
            "apps/fitness/product.yaml",
            {
                "id": "different-id",
                "name": "Fitness",
                "description": "Fitness app",
                "docs": "README.md",
                "services": [],
            },
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("does not match catalog entry ID" in err for err in result.errors))

    def test_service_product_mismatch(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["product"] = "other-product"
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("does not match parent product 'fitness'" in err for err in result.errors))

    def test_service_id_mismatch_with_declaration(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["id"] = "different-service-id"
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("does not match product manifest service ID 'api'" in err for err in result.errors))

    # 7. Missing files
    def test_missing_product_manifest_file(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {"version": 1, "products": [{"id": "fitness", "manifest": "apps/fitness/nonexistent.yaml"}]},
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("does not exist" in err for err in result.errors))

    def test_missing_service_manifest_file(self) -> None:
        self._setup_valid_product()
        (self.repo_root / "apps" / "fitness" / "api" / "service.yaml").unlink()
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("does not exist" in err for err in result.errors))

    def test_missing_docs_file(self) -> None:
        self._setup_valid_product()
        (self.repo_root / "apps" / "fitness" / "README.md").unlink()
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("docs: referenced target does not exist" in err for err in result.errors))

    def test_missing_service_working_dir(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["path"] = "apps/fitness/api/nonexistent_folder"
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("working directory: referenced target does not exist" in err for err in result.errors))

    # 8. Path traversal & absolute paths
    def test_path_traversal_escaping_repo_root(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {"version": 1, "products": [{"id": "escape", "manifest": "../../outside.yaml"}]},
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("escapes repository root" in err for err in result.errors))

    def test_absolute_path_rejected(self) -> None:
        self._write_yaml(
            "projects.yaml",
            {"version": 1, "products": [{"id": "abs", "manifest": "/etc/passwd.yaml"}]},
        )
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("absolute path" in err for err in result.errors))

    # 9. Inter-service dependencies
    def test_missing_service_dependency(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "web" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["dependencies"]["services"] = ["fitness/nonexistent-service"]
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("depends on unknown service 'fitness/nonexistent-service'" in err for err in result.errors))

    def test_self_referencing_dependency(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["dependencies"]["services"] = ["fitness/api"]
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("cannot declare a dependency on itself" in err for err in result.errors))

    def test_invalid_dependency_format(self) -> None:
        self._setup_valid_product()
        svc_path = self.repo_root / "apps" / "fitness" / "web" / "service.yaml"
        with open(svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        # Not qualified (<product>/<service>)
        data["dependencies"]["services"] = ["api"]
        with open(svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("Dependencies must be fully qualified" in err or "service schema" in err for err in result.errors))

    # 10. Circular dependency detection (2+ services)
    def test_two_service_circular_dependency(self) -> None:
        self._setup_valid_product()
        # In valid product, web already depends on api.
        # Now make api depend on web -> creates A -> B -> A cycle.
        api_svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(api_svc_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["dependencies"]["services"] = ["fitness/web"]
        with open(api_svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("Circular service dependency detected" in err for err in result.errors))
        self.assertTrue(any("fitness/api" in err and "fitness/web" in err for err in result.errors))

    def test_three_service_circular_dependency(self) -> None:
        self._setup_valid_product()
        # Add a third service "worker" to fitness product
        prod_path = self.repo_root / "apps" / "fitness" / "product.yaml"
        with open(prod_path, "r", encoding="utf-8") as f:
            prod_data = yaml.safe_load(f)
        prod_data["services"].append({"id": "worker", "manifest": "worker/service.yaml"})
        with open(prod_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(prod_data, f)

        (self.repo_root / "apps" / "fitness" / "worker").mkdir(parents=True, exist_ok=True)
        # Setup 3-cycle: web -> api -> worker -> web
        self._write_yaml(
            "apps/fitness/worker/service.yaml",
            {
                "id": "worker",
                "product": "fitness",
                "type": "worker",
                "runtime": {"language": "python", "version": "3.12"},
                "path": "apps/fitness/worker",
                "commands": {"dev": "python worker.py", "build": "docker build .", "test": "pytest", "lint": "ruff"},
                "artifact": {"type": "docker"},
                "deployment": {"deployable": True, "target": "oci-vm"},
                "dependencies": {"services": ["fitness/web"]},
            },
        )
        api_svc_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(api_svc_path, "r", encoding="utf-8") as f:
            api_data = yaml.safe_load(f)
        api_data["dependencies"]["services"] = ["fitness/worker"]
        with open(api_svc_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(api_data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertFalse(result.is_valid)
        self.assertTrue(any("Circular service dependency detected" in err for err in result.errors))

    # 11. Symlink escape prevention
    def test_symlink_escaping_repo_root_rejected(self) -> None:
        # Create external directory outside repo root
        external_dir = tempfile.mkdtemp(prefix="megalith_external_")
        try:
            external_manifest = Path(external_dir) / "external_product.yaml"
            with open(external_manifest, "w", encoding="utf-8") as f:
                yaml.safe_dump(
                    {
                        "id": "escaped",
                        "name": "Escaped",
                        "description": "Escaped product",
                        "docs": "README.md",
                        "services": [],
                    },
                    f,
                )

            # Create symlink inside repo pointing to external file
            symlink_path = self.repo_root / "apps" / "symlink_product.yaml"
            symlink_path.parent.mkdir(parents=True, exist_ok=True)
            symlink_path.symlink_to(external_manifest)

            self._write_yaml(
                "projects.yaml",
                {"version": 1, "products": [{"id": "escaped", "manifest": "apps/symlink_product.yaml"}]},
            )

            validator = ManifestValidator(repo_root=self.repo_root)
            result = validator.validate()
            self.assertFalse(result.is_valid)
            self.assertTrue(
                any("resolves outside repository root" in err or "escapes repository root" in err for err in result.errors)
            )
        finally:
            shutil.rmtree(external_dir, ignore_errors=True)

    def test_symlink_inside_repo_allowed(self) -> None:
        self._setup_valid_product()
        # Create an internal symlink pointing to valid README inside repo
        internal_docs = self.repo_root / "apps" / "fitness" / "README.md"
        symlink_docs = self.repo_root / "apps" / "fitness" / "SYMLINK_README.md"
        symlink_docs.symlink_to(internal_docs)

        prod_path = self.repo_root / "apps" / "fitness" / "product.yaml"
        with open(prod_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["docs"] = "SYMLINK_README.md"
        with open(prod_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Expected internal symlink to be valid, got: {result.errors}")

    # 12. Polyglot and optional dependencies flexibility
    def test_service_optional_dependencies(self) -> None:
        self._setup_valid_product()
        # Remove dependencies key from api service.yaml
        api_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(api_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        del data["dependencies"]
        with open(api_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Expected optional dependencies to be valid, got: {result.errors}")

    def test_polyglot_languages_allowed(self) -> None:
        self._setup_valid_product()
        # Test Go and Swift runtimes
        api_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(api_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["runtime"]["language"] = "go"
        with open(api_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        web_path = self.repo_root / "apps" / "fitness" / "web" / "service.yaml"
        with open(web_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["runtime"]["language"] = "swift"
        data["type"] = "mobile"
        data["artifact"]["type"] = "bundle"
        data["deployment"]["target"] = "mobile-store"
        with open(web_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Expected polyglot runtimes to be valid, got: {result.errors}")

    def test_array_commands_allowed(self) -> None:
        self._setup_valid_product()
        api_path = self.repo_root / "apps" / "fitness" / "api" / "service.yaml"
        with open(api_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["commands"]["test"] = ["python", "-m", "pytest", "-v"]
        with open(api_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)

        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid, f"Expected array commands to be valid, got: {result.errors}")
        svc_meta = result.services["fitness/api"]
        self.assertEqual(svc_meta.commands["test"], ["python", "-m", "pytest", "-v"])

    def test_metadata_population(self) -> None:
        self._setup_valid_product()
        validator = ManifestValidator(repo_root=self.repo_root)
        result = validator.validate()
        self.assertTrue(result.is_valid)
        self.assertIn("fitness", result.products)
        self.assertEqual(result.products["fitness"].name, "Fitness Tracker")
        self.assertIn("fitness/api", result.services)
        self.assertEqual(result.services["fitness/api"].type, "api")
        self.assertEqual(result.services["fitness/api"].runtime["language"], "python")
        self.assertIn("fitness/web", result.services)
        self.assertEqual(result.services["fitness/web"].dependencies["services"], ["fitness/api"])


if __name__ == "__main__":
    unittest.main()

