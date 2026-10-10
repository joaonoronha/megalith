#!/usr/bin/env python3
"""
Manifest Validator for Polyglot Monorepo.

Validates projects.yaml, product.yaml, and service.yaml against their
JSON schemas and domain contracts:
- Validates YAML syntax and schema conformity.
- Enforces ID formatting (lowercase-kebab-case) and uniqueness.
- Prevents path traversal and rejects paths outside the repository.
- Verifies that services match their parent product.
- Checks service dependency references.
- Validates empty catalogs without error.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import jsonschema
import yaml

ID_REGEX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
QUALIFIED_SERVICE_ID_REGEX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$")


@dataclass
class ServiceMetadata:
    id: str
    product: str
    qualified_id: str
    type: str
    runtime: Dict[str, Any]
    path: str
    absolute_path: Path
    commands: Dict[str, Any]
    artifact: Dict[str, Any]
    deployment: Dict[str, Any]
    dependencies: Dict[str, Any]
    manifest_path: Path


@dataclass
class ProductMetadata:
    id: str
    name: str
    description: str
    docs: str
    manifest_path: Path
    services: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    product_count: int = 0
    service_count: int = 0
    products: Dict[str, ProductMetadata] = field(default_factory=dict)
    services: Dict[str, ServiceMetadata] = field(default_factory=dict)

    def add_error(self, message: str) -> None:
        self.is_valid = False
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)


class ManifestValidator:
    def __init__(self, repo_root: Optional[Path] = None, schemas_dir: Optional[Path] = None) -> None:
        if repo_root is None:
            # Default to repo root (parent of tooling/)
            self.repo_root = Path(__file__).resolve().parent.parent
        else:
            self.repo_root = Path(repo_root).resolve()

        if schemas_dir is None:
            self.schemas_dir = self.repo_root / "tooling" / "schemas"
        else:
            self.schemas_dir = Path(schemas_dir).resolve()

        self._load_schemas()

    def _load_schemas(self) -> None:
        self.schemas: Dict[str, Any] = {}
        schema_files = {
            "projects": self.schemas_dir / "projects.schema.json",
            "product": self.schemas_dir / "product.schema.json",
            "service": self.schemas_dir / "service.schema.json",
        }
        for name, path in schema_files.items():
            if not path.is_file():
                raise FileNotFoundError(f"Required schema file not found: {path}")
            try:
                with open(path, "r", encoding="utf-8") as f:
                    self.schemas[name] = json.load(f)
            except Exception as e:
                raise ValueError(f"Failed to parse JSON Schema at {path}: {e}") from e

    def _safe_resolve_path(
        self,
        base_dir: Path,
        rel_path: str,
        result: ValidationResult,
        context_desc: str,
        must_exist: bool = True,
    ) -> Optional[Path]:
        """
        Safely resolves a relative path against base_dir.
        Enforces that the path is relative and does not escape repo_root.
        """
        # Reject absolute paths (POSIX and Windows)
        if os.path.isabs(rel_path) or (len(rel_path) > 1 and rel_path[1] == ":"):
            result.add_error(f"{context_desc}: absolute path '{rel_path}' is forbidden; paths must be relative.")
            return None

        # Check path string for traversal tokens
        normalized = os.path.normpath(rel_path)
        if normalized.startswith("..") or "/../" in rel_path or "\\..\\" in rel_path:
            # Check resolved path
            resolved = (base_dir / rel_path).resolve()
            if not self._is_within_repo(resolved):
                result.add_error(
                    f"{context_desc}: path '{rel_path}' escapes repository root ({self.repo_root})."
                )
                return None

        resolved = (base_dir / rel_path).resolve()
        if not self._is_within_repo(resolved):
            result.add_error(
                f"{context_desc}: path '{rel_path}' resolves outside repository root ({self.repo_root})."
            )
            return None

        if must_exist and not resolved.exists():
            result.add_error(f"{context_desc}: referenced target does not exist: '{rel_path}' (resolved: {resolved})")
            return None

        return resolved

    def _is_within_repo(self, path: Path) -> bool:
        try:
            path.relative_to(self.repo_root)
            return True
        except ValueError:
            return False

    def _load_yaml(self, file_path: Path, result: ValidationResult, context_desc: str) -> Optional[Dict[str, Any]]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f)
            if content is None:
                return {}
            if not isinstance(content, dict):
                result.add_error(f"{context_desc} at '{file_path}': YAML root must be a mapping/object.")
                return None
            return content
        except yaml.YAMLError as e:
            result.add_error(f"{context_desc} at '{file_path}': malformed YAML - {e}")
            return None
        except Exception as e:
            result.add_error(f"{context_desc} at '{file_path}': failed to read file - {e}")
            return None

    def _validate_schema(
        self,
        data: Dict[str, Any],
        schema_name: str,
        file_path: Path,
        result: ValidationResult,
    ) -> bool:
        schema = self.schemas.get(schema_name)
        if not schema:
            result.add_error(f"Internal error: schema '{schema_name}' is not loaded.")
            return False

        validator = jsonschema.Draft7Validator(schema)
        errors = list(validator.iter_errors(data))
        if not errors:
            return True

        for err in errors:
            loc = "root"
            if err.path:
                loc = " -> ".join(str(p) for p in err.path)
            result.add_error(f"{file_path} ({schema_name} schema): error at '{loc}': {err.message}")
        return False

    def validate(self, catalog_rel_path: str = "projects.yaml") -> ValidationResult:
        result = ValidationResult()

        catalog_path = self._safe_resolve_path(
            self.repo_root, catalog_rel_path, result, "Catalog registry", must_exist=True
        )
        if catalog_path is None:
            return result

        catalog_data = self._load_yaml(catalog_path, result, "Catalog manifest")
        if catalog_data is None:
            return result

        if not self._validate_schema(catalog_data, "projects", catalog_path, result):
            return result

        products = catalog_data.get("products", [])
        result.product_count = len(products)

        # Empty catalog is completely valid
        if not products:
            return result

        seen_product_ids: Set[str] = set()
        product_manifests: Dict[str, Dict[str, Any]] = {}
        all_qualified_services: Set[str] = set()
        declared_dependencies: List[tuple[str, str]] = []  # (service_qualified_id, dependency_qualified_id)

        # 1. Validate each product entry in projects.yaml
        for idx, entry in enumerate(products):
            prod_id = entry.get("id")
            manifest_rel = entry.get("manifest")

            if not prod_id or not ID_REGEX.match(prod_id):
                result.add_error(
                    f"Catalog entry #{idx}: product ID '{prod_id}' is invalid. Must match lowercase-kebab-case."
                )
                continue

            if prod_id in seen_product_ids:
                result.add_error(f"Catalog contains duplicate product ID '{prod_id}'.")
                continue
            seen_product_ids.add(prod_id)

            prod_manifest_path = self._safe_resolve_path(
                self.repo_root,
                manifest_rel,
                result,
                f"Product '{prod_id}' manifest",
                must_exist=True,
            )
            if prod_manifest_path is None:
                continue

            prod_data = self._load_yaml(prod_manifest_path, result, f"Product manifest '{prod_id}'")
            if prod_data is None:
                continue

            if not self._validate_schema(prod_data, "product", prod_manifest_path, result):
                continue

            # Verify declared product ID matches catalog
            if prod_data.get("id") != prod_id:
                result.add_error(
                    f"Product manifest '{prod_manifest_path}': declared ID '{prod_data.get('id')}' "
                    f"does not match catalog entry ID '{prod_id}'."
                )

            # Check docs reference
            docs_ref = prod_data.get("docs")
            if docs_ref:
                self._safe_resolve_path(
                    prod_manifest_path.parent,
                    docs_ref,
                    result,
                    f"Product '{prod_id}' docs",
                    must_exist=True,
                )

            product_manifests[prod_id] = {
                "path": prod_manifest_path,
                "data": prod_data,
            }
            result.products[prod_id] = ProductMetadata(
                id=prod_id,
                name=prod_data.get("name", prod_id),
                description=prod_data.get("description", ""),
                docs=prod_data.get("docs", ""),
                manifest_path=prod_manifest_path,
                services=[],
            )

        # 2. Validate services declared within each product
        for prod_id, p_info in product_manifests.items():
            prod_manifest_path = p_info["path"]
            prod_data = p_info["data"]
            declared_services = prod_data.get("services", [])
            seen_local_service_ids: Set[str] = set()

            for s_idx, s_decl in enumerate(declared_services):
                s_id = s_decl.get("id")
                s_manifest_rel = s_decl.get("manifest")

                if not s_id or not ID_REGEX.match(s_id):
                    result.add_error(
                        f"Product '{prod_id}' service declaration #{s_idx}: service ID '{s_id}' is invalid."
                    )
                    continue

                if s_id in seen_local_service_ids:
                    result.add_error(f"Product '{prod_id}' declares duplicate service ID '{s_id}'.")
                    continue
                seen_local_service_ids.add(s_id)

                qualified_id = f"{prod_id}/{s_id}"
                if qualified_id in all_qualified_services:
                    result.add_error(f"Duplicate qualified service ID detected: '{qualified_id}'.")
                    continue
                all_qualified_services.add(qualified_id)
                result.service_count += 1

                # Resolve service.yaml relative to product directory
                service_manifest_path = self._safe_resolve_path(
                    prod_manifest_path.parent,
                    s_manifest_rel,
                    result,
                    f"Service '{qualified_id}' manifest",
                    must_exist=True,
                )
                if service_manifest_path is None:
                    continue

                service_data = self._load_yaml(
                    service_manifest_path, result, f"Service manifest '{qualified_id}'"
                )
                if service_data is None:
                    continue

                if not self._validate_schema(service_data, "service", service_manifest_path, result):
                    continue

                # Verify service ID matches declaration
                if service_data.get("id") != s_id:
                    result.add_error(
                        f"Service manifest '{service_manifest_path}': declared ID '{service_data.get('id')}' "
                        f"does not match product manifest service ID '{s_id}'."
                    )

                # Verify parent product ID matches
                if service_data.get("product") != prod_id:
                    result.add_error(
                        f"Service manifest '{service_manifest_path}': declared product '{service_data.get('product')}' "
                        f"does not match parent product '{prod_id}'."
                    )

                # Verify working directory path
                svc_path = service_data.get("path", "")
                resolved_svc_path = None
                if svc_path:
                    resolved_svc_path = self._safe_resolve_path(
                        self.repo_root,
                        svc_path,
                        result,
                        f"Service '{qualified_id}' working directory",
                        must_exist=True,
                    )

                result.products[prod_id].services.append(qualified_id)
                result.services[qualified_id] = ServiceMetadata(
                    id=s_id,
                    product=prod_id,
                    qualified_id=qualified_id,
                    type=service_data.get("type", "other"),
                    runtime=service_data.get("runtime", {}),
                    path=svc_path,
                    absolute_path=resolved_svc_path or (self.repo_root / svc_path),
                    commands=service_data.get("commands", {}),
                    artifact=service_data.get("artifact", {}),
                    deployment=service_data.get("deployment", {}),
                    dependencies=service_data.get("dependencies", {}),
                    manifest_path=service_manifest_path,
                )

                # Record service dependencies for cross-service resolution
                dependencies = service_data.get("dependencies", {})
                svc_deps = dependencies.get("services", [])
                for dep in svc_deps:
                    declared_dependencies.append((qualified_id, dep))

        # 3. Validate cross-service dependencies
        dep_graph: Dict[str, List[str]] = {}
        for source_service, target_service in declared_dependencies:
            if not QUALIFIED_SERVICE_ID_REGEX.match(target_service):
                result.add_error(
                    f"Service '{source_service}' declares invalid dependency ID '{target_service}'. "
                    f"Dependencies must be fully qualified '<product>/<service>'."
                )
                continue

            if source_service == target_service:
                result.add_error(
                    f"Service '{source_service}' cannot declare a dependency on itself."
                )
                continue

            if target_service not in all_qualified_services:
                result.add_error(
                    f"Service '{source_service}' depends on unknown service '{target_service}'. "
                    f"Target service does not exist in any registered product."
                )
                continue

            dep_graph.setdefault(source_service, []).append(target_service)

        # Detect circular dependencies involving two or more services
        visited: Dict[str, int] = {}  # 0: unvisited, 1: visiting (in stack), 2: visited
        current_path: List[str] = []
        detected_cycles: Set[tuple[str, ...]] = set()

        def dfs_detect_cycle(node: str) -> None:
            visited[node] = 1
            current_path.append(node)

            for neighbor in dep_graph.get(node, []):
                if visited.get(neighbor, 0) == 1:
                    cycle_start = current_path.index(neighbor)
                    cycle_nodes = tuple(current_path[cycle_start:])
                    min_idx = cycle_nodes.index(min(cycle_nodes))
                    normalized_cycle = cycle_nodes[min_idx:] + cycle_nodes[:min_idx]
                    if normalized_cycle not in detected_cycles:
                        detected_cycles.add(normalized_cycle)
                        cycle_display = " -> ".join(current_path[cycle_start:] + [neighbor])
                        result.add_error(
                            f"Circular service dependency detected: {cycle_display}."
                        )
                elif visited.get(neighbor, 0) == 0:
                    dfs_detect_cycle(neighbor)

            current_path.pop()
            visited[node] = 2

        for service_id in sorted(all_qualified_services):
            if visited.get(service_id, 0) == 0:
                dfs_detect_cycle(service_id)

        return result

    def load_catalog(self, catalog_rel_path: str = "projects.yaml") -> ValidationResult:
        """Alias for validate(), returning typed catalog metadata in ValidationResult."""
        return self.validate(catalog_rel_path=catalog_rel_path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate megalith monorepo project and service manifests."
    )
    parser.add_argument(
        "--catalog",
        default="projects.yaml",
        help="Path to root projects catalog YAML (relative to repo root, default: projects.yaml)",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Path to repository root (defaults to detected repo root)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress non-error output",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve() if args.repo_root else None
    validator = ManifestValidator(repo_root=repo_root)
    result = validator.validate(args.catalog)

    if not args.quiet:
        print("=" * 60)
        print(" Monorepo Manifest Validation")
        print("=" * 60)
        print(f"Repository Root : {validator.repo_root}")
        print(f"Catalog Path    : {args.catalog}")
        print(f"Products Found  : {result.product_count}")
        print(f"Services Found  : {result.service_count}")
        print("-" * 60)

    if result.is_valid:
        if not args.quiet:
            print("STATUS: SUCCESS")
            print("All manifests and contracts are valid.")
            print("=" * 60)
        return 0
    else:
        print(f"STATUS: FAILED ({len(result.errors)} error(s) found):", file=sys.stderr)
        for idx, err in enumerate(result.errors, 1):
            print(f"  [{idx}] {err}", file=sys.stderr)
        if not args.quiet:
            print("=" * 60, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
