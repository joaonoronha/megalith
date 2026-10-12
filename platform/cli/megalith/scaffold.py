"""
Megalith Scaffolding Engine (Task 019).

Provides reproducible, manifest-driven generation for products and services:
- Identifier validation (lowercase-kebab-case).
- Path traversal prevention.
- File overwrite safeguards.
- Deterministic template rendering.
- Database isolation generation (PostgreSQL 16 baseline, ADR-007).
- Ingress and port conflict detection.
- Preview / dry-run mode without filesystem writes.
"""

from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml

ID_REGEX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# Reserved / system names that cannot be used as product or service IDs
RESERVED_IDS = {
    "admin",
    "api",  # as product id
    "core",
    "global",
    "infra",
    "internal",
    "null",
    "platform",
    "postgres",
    "root",
    "system",
    "tooling",
}


class ScaffoldError(Exception):
    """Base error for scaffolding operations."""


class InvalidIdentifierError(ScaffoldError):
    """Raised when an identifier does not conform to lowercase-kebab-case."""


class PathTraversalError(ScaffoldError):
    """Raised when an unsafe path or path traversal attempt is detected."""


class ConflictError(ScaffoldError):
    """Raised when a product, service, port, or file already exists."""


class TemplateNotFoundError(ScaffoldError):
    """Raised when a requested template is unknown."""


@dataclass
class ScaffoldingFile:
    relative_path: str
    content: str
    executable: bool = False


@dataclass
class ScaffoldingResult:
    product_id: str
    service_id: Optional[str] = None
    files_to_create: List[ScaffoldingFile] = field(default_factory=list)
    files_to_modify: List[ScaffoldingFile] = field(default_factory=list)
    dry_run: bool = False
    warnings: List[str] = field(default_factory=list)

    @property
    def total_files(self) -> int:
        return len(self.files_to_create) + len(self.files_to_modify)


def validate_identifier(name: str, kind: str = "identifier") -> str:
    """Validates that name is non-empty lowercase-kebab-case."""
    if not name or not isinstance(name, str):
        raise InvalidIdentifierError(f"{kind.capitalize()} cannot be empty.")
    if not ID_REGEX.match(name):
        raise InvalidIdentifierError(
            f"Invalid {kind} '{name}'. Must be lowercase alphanumeric characters and single hyphens "
            f"(e.g. 'analytics', 'user-auth', 'my-service')."
        )
    if kind == "product" and name in RESERVED_IDS:
        raise InvalidIdentifierError(f"Product ID '{name}' is reserved by the platform.")
    return name


def safe_resolve_repo_path(repo_root: Path, target_relative: str | Path) -> Path:
    """Ensures target path stays strictly inside repo_root and avoids traversal."""
    repo_root = repo_root.resolve()
    target_str = str(target_relative)
    if ".." in target_str or target_str.startswith("/") or target_str.startswith("\\"):
        raise PathTraversalError(f"Unsafe path detected: '{target_relative}'")
    target_path = (repo_root / target_relative).resolve()
    try:
        target_path.relative_to(repo_root)
    except ValueError:
        raise PathTraversalError(f"Path '{target_relative}' escapes repository root {repo_root}")
    return target_path


def render_template(content: str, variables: Dict[str, str]) -> str:
    """Deterministic variable replacement using {{KEY}} syntax."""
    rendered = content
    for key, value in variables.items():
        placeholder = f"{{{{{key}}}}}"
        rendered = rendered.replace(placeholder, str(value))
    return rendered


class ScaffoldEngine:
    def __init__(self, repo_root: Path, templates_dir: Optional[Path] = None) -> None:
        self.repo_root = repo_root.resolve()
        self.templates_dir = (
            templates_dir.resolve()
            if templates_dir
            else (self.repo_root / "platform" / "templates").resolve()
        )
        if not self.templates_dir.is_dir():
            raise ScaffoldError(f"Templates directory not found at {self.templates_dir}")

    def get_existing_ports(self) -> Dict[int, str]:
        """Scans registered services to map allocated ports to qualified service IDs."""
        ports: Dict[int, str] = {8000: "demo/api", 8080: "demo/web"}
        projects_file = self.repo_root / "projects.yaml"
        if not projects_file.is_file():
            return ports

        try:
            with open(projects_file, "r", encoding="utf-8") as f:
                catalog = yaml.safe_load(f) or {}
            for p in catalog.get("products", []):
                p_id = p.get("id")
                p_manifest = self.repo_root / p.get("manifest", "")
                if not p_manifest.is_file():
                    continue
                with open(p_manifest, "r", encoding="utf-8") as pf:
                    p_data = yaml.safe_load(pf) or {}
                for s in p_data.get("services", []):
                    s_id = s.get("id")
                    s_manifest = p_manifest.parent / s.get("manifest", "")
                    if not s_manifest.is_file():
                        continue
                    with open(s_manifest, "r", encoding="utf-8") as sf:
                        s_data = yaml.safe_load(sf) or {}
                    commands = s_data.get("commands", {})
                    dev_cmd = commands.get("dev", [])
                    if isinstance(dev_cmd, list):
                        for i, arg in enumerate(dev_cmd):
                            if arg in ("--port", "-p") and i + 1 < len(dev_cmd):
                                try:
                                    ports[int(dev_cmd[i + 1])] = f"{p_id}/{s_id}"
                                except ValueError:
                                    pass
        except Exception:
            pass
        return ports

    def create_product(
        self,
        product_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        docs: str = "README.md",
        dry_run: bool = False,
        force: bool = False,
    ) -> ScaffoldingResult:
        """Generates a new product manifest and registers it in projects.yaml."""
        validate_identifier(product_id, kind="product")
        display_name = name or product_id.replace("-", " ").title()
        desc = description or f"{display_name} application."

        projects_path = safe_resolve_repo_path(self.repo_root, "projects.yaml")
        product_dir_rel = Path("apps") / product_id
        product_dir = safe_resolve_repo_path(self.repo_root, product_dir_rel)
        manifest_rel = product_dir_rel / "product.yaml"
        readme_rel = product_dir_rel / docs

        # 1. Check projects.yaml for duplicate product id
        projects_content = projects_path.read_text(encoding="utf-8")
        projects_data = yaml.safe_load(projects_content) or {}
        existing_products = [p.get("id") for p in projects_data.get("products", [])]
        if product_id in existing_products and not force:
            raise ConflictError(f"Product '{product_id}' is already registered in projects.yaml.")

        # 2. Check existing directory
        if product_dir.exists() and not force:
            raise ConflictError(
                f"Product directory '{product_dir_rel}' already exists. Use force=True to overwrite."
            )

        # 3. Read and render templates
        prod_tpl = (self.templates_dir / "product" / "product.yaml.tpl").read_text(encoding="utf-8")
        readme_tpl = (self.templates_dir / "product" / "README.md.tpl").read_text(encoding="utf-8")

        vars_map = {
            "PRODUCT_ID": product_id,
            "PRODUCT_NAME": display_name,
            "PRODUCT_DESCRIPTION": desc,
            "PRODUCT_DOCS": docs,
        }

        rendered_manifest = render_template(prod_tpl, vars_map)
        rendered_readme = render_template(readme_tpl, vars_map)

        # 4. Prepare updated projects.yaml
        if product_id not in existing_products:
            updated_projects_data = dict(projects_data)
            prods = list(updated_projects_data.get("products") or [])
            prods.append({"id": product_id, "manifest": f"apps/{product_id}/product.yaml"})
            updated_projects_data["products"] = prods
            updated_projects = yaml.dump(
                updated_projects_data, sort_keys=False, default_flow_style=False
            )
        else:
            updated_projects = projects_content

        result = ScaffoldingResult(product_id=product_id, dry_run=dry_run)
        result.files_to_create.append(ScaffoldingFile(str(manifest_rel), rendered_manifest))
        result.files_to_create.append(ScaffoldingFile(str(readme_rel), rendered_readme))
        result.files_to_modify.append(ScaffoldingFile(str(Path("projects.yaml")), updated_projects))

        if not dry_run:
            self._apply_scaffolding(result)

        return result

    def add_service(
        self,
        product_id: str,
        service_id: str,
        template: str,
        service_type: str = "api",
        port: int = 8000,
        with_database: bool = False,
        deployable: bool = True,
        target: str = "oci-vm",
        dry_run: bool = False,
        force: bool = False,
    ) -> ScaffoldingResult:
        """Scaffolds a new service within an existing product."""
        validate_identifier(product_id, kind="product")
        validate_identifier(service_id, kind="service")

        allowed_templates = ("fastapi", "react", "go")
        if template not in allowed_templates:
            raise TemplateNotFoundError(
                f"Unknown template '{template}'. Supported templates: {', '.join(allowed_templates)}"
            )

        # Validate parent product exists
        product_dir_rel = Path("apps") / product_id
        product_dir = safe_resolve_repo_path(self.repo_root, product_dir_rel)
        product_manifest_rel = product_dir_rel / "product.yaml"
        product_manifest_path = safe_resolve_repo_path(self.repo_root, product_manifest_rel)

        if not product_manifest_path.is_file():
            raise ScaffoldError(
                f"Parent product manifest '{product_manifest_rel}' not found. "
                f"Create product first using 'megalith product create {product_id}'."
            )

        # Load product manifest
        product_data = yaml.safe_load(product_manifest_path.read_text(encoding="utf-8")) or {}
        existing_service_ids = [s.get("id") for s in product_data.get("services", [])]
        if service_id in existing_service_ids and not force:
            raise ConflictError(
                f"Service '{service_id}' already registered in product '{product_id}'."
            )

        service_dir_rel = product_dir_rel / service_id
        service_dir = safe_resolve_repo_path(self.repo_root, service_dir_rel)
        if service_dir.exists() and not force:
            raise ConflictError(
                f"Service directory '{service_dir_rel}' already exists. Use force=True to overwrite."
            )

        # Port conflict detection
        existing_ports = self.get_existing_ports()
        warnings = []
        if port in existing_ports and existing_ports[port] != f"{product_id}/{service_id}":
            warnings.append(
                f"Port {port} is already assigned to service '{existing_ports[port]}'. "
                f"Consider using a different port to avoid runtime conflicts."
            )

        product_name = product_data.get("name", product_id.replace("-", " ").title())
        product_upper = product_id.upper().replace("-", "_")
        product_norm = product_id.replace("-", "_")

        vars_map = {
            "PRODUCT_ID": product_id,
            "PRODUCT_ID_UPPER": product_upper,
            "PRODUCT_ID_NORM": product_norm,
            "PRODUCT_NAME": product_name,
            "SERVICE_ID": service_id,
            "SERVICE_TYPE": service_type,
            "PORT": str(port),
            "DEPLOYABLE": "true" if deployable else "false",
            "TARGET": target,
            "DB_NAME": f"db_{product_norm}",
            "DB_MIGRATE_USER": f"role_{product_norm}_migrate",
            "DB_MIGRATE_PASSWORD": f"{product_norm}_migrate_dev_password",
            "DB_APP_USER": f"role_{product_norm}_app",
            "DB_APP_PASSWORD": f"{product_norm}_app_dev_password",
        }

        # Template-specific rendering
        files_to_create: List[ScaffoldingFile] = []

        if template == "fastapi":
            files_to_create.extend(self._render_fastapi_template(service_dir_rel, vars_map, with_database))
        elif template == "react":
            files_to_create.extend(self._render_react_template(service_dir_rel, vars_map))
        elif template == "go":
            files_to_create.extend(self._render_go_template(service_dir_rel, vars_map))

        # Generate standalone deployment snippets in the service directory
        compose_snippet = self.generate_compose_snippet(
            product_id=product_id,
            service_id=service_id,
            template=template,
            port=port,
            with_database=with_database,
            service_type=service_type,
        )
        files_to_create.append(
            ScaffoldingFile(
                str(service_dir_rel / "compose.snippet.yaml"),
                compose_snippet,
            )
        )

        if service_type in ("api", "web"):
            caddy_snippet = self.generate_caddy_route_snippet(
                product_id=product_id,
                service_id=service_id,
                port=port,
            )
            files_to_create.append(
                ScaffoldingFile(
                    str(service_dir_rel / "caddy.snippet.txt"),
                    caddy_snippet,
                )
            )

        # If PostgreSQL requested, generate database init script
        files_to_modify: List[ScaffoldingFile] = []
        if with_database:
            db_script_file = self._render_postgres_init_script(product_id, vars_map)
            files_to_create.append(db_script_file)

        # Update product.yaml services list
        updated_product_data = dict(product_data)
        services_list = list(updated_product_data.get("services", []))
        if service_id not in [s.get("id") for s in services_list]:
            services_list.append({"id": service_id, "manifest": f"{service_id}/service.yaml"})
            updated_product_data["services"] = services_list
            updated_product_content = yaml.dump(
                updated_product_data, sort_keys=False, default_flow_style=False
            )
            files_to_modify.append(
                ScaffoldingFile(str(product_manifest_rel), updated_product_content)
            )

        result = ScaffoldingResult(
            product_id=product_id,
            service_id=service_id,
            files_to_create=files_to_create,
            files_to_modify=files_to_modify,
            dry_run=dry_run,
            warnings=warnings,
        )

        if not dry_run:
            self._apply_scaffolding(result)

        return result

    def _render_fastapi_template(
        self, service_dir_rel: Path, vars_map: Dict[str, str], with_database: bool
    ) -> List[ScaffoldingFile]:
        tpl_dir = self.templates_dir / "fastapi"
        files: List[ScaffoldingFile] = []

        # Service manifest
        svc_tpl = (tpl_dir / "service.yaml.tpl").read_text(encoding="utf-8")
        if with_database:
            migrate_cmd = "\n  migrate:\n    - alembic\n    - upgrade\n    - head"
            deps_block = "\ndependencies:\n  external:\n    - postgresql"
            extra_deps = '    "sqlalchemy>=2.0.0",\n    "psycopg[binary]>=3.1.0",\n    "alembic>=1.13.0",\n'
            alembic_copy = "COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini\nCOPY --chown=appuser:appgroup migrations /app/migrations\n"
        else:
            migrate_cmd = ""
            deps_block = ""
            extra_deps = ""
            alembic_copy = ""

        fastapi_vars = dict(vars_map)
        fastapi_vars["MIGRATE_COMMAND"] = migrate_cmd
        fastapi_vars["DEPENDENCIES_BLOCK"] = deps_block
        fastapi_vars["EXTRA_DEPENDENCIES"] = extra_deps
        fastapi_vars["ALEMBIC_DOCKER_COPY"] = alembic_copy

        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "service.yaml"),
                render_template(svc_tpl, fastapi_vars),
            )
        )

        # pyproject.toml
        pyproj_tpl = (tpl_dir / "pyproject.toml.tpl").read_text(encoding="utf-8")
        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "pyproject.toml"),
                render_template(pyproj_tpl, fastapi_vars),
            )
        )

        # Dockerfile
        docker_tpl = (tpl_dir / "Dockerfile.tpl").read_text(encoding="utf-8")
        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "Dockerfile"),
                render_template(docker_tpl, fastapi_vars),
            )
        )

        # src/main.py & src/__init__.py
        main_tpl = (tpl_dir / "src" / "main.py.tpl").read_text(encoding="utf-8")
        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "src" / "main.py"),
                render_template(main_tpl, fastapi_vars),
            )
        )
        files.append(ScaffoldingFile(str(service_dir_rel / "src" / "__init__.py"), ""))

        # tests/test_main.py & tests/__init__.py
        test_tpl = (tpl_dir / "tests" / "test_main.py.tpl").read_text(encoding="utf-8")
        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "tests" / "test_main.py"),
                render_template(test_tpl, fastapi_vars),
            )
        )
        files.append(ScaffoldingFile(str(service_dir_rel / "tests" / "__init__.py"), ""))

        # README.md
        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "README.md"),
                f"# {fastapi_vars['PRODUCT_NAME']} {fastapi_vars['SERVICE_ID']}\n\nFastAPI service for {fastapi_vars['PRODUCT_ID']}.\n",
            )
        )

        # Database migrations scaffold if requested
        if with_database:
            db_tpl_dir = self.templates_dir / "fastapi-db"
            alembic_ini_tpl = (db_tpl_dir / "alembic.ini.tpl").read_text(encoding="utf-8")
            env_tpl = (db_tpl_dir / "migrations" / "env.py.tpl").read_text(encoding="utf-8")
            script_tpl = (db_tpl_dir / "migrations" / "script.py.mako.tpl").read_text(encoding="utf-8")

            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / "alembic.ini"),
                    render_template(alembic_ini_tpl, fastapi_vars),
                )
            )
            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / "migrations" / "env.py"),
                    render_template(env_tpl, fastapi_vars),
                )
            )
            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / "migrations" / "script.py.mako"),
                    render_template(script_tpl, fastapi_vars),
                )
            )
            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / "migrations" / "versions" / ".gitkeep"),
                    "# Keep versions directory in git\n",
                )
            )

        return files

    def _render_react_template(
        self, service_dir_rel: Path, vars_map: Dict[str, str]
    ) -> List[ScaffoldingFile]:
        tpl_dir = self.templates_dir / "react"
        files: List[ScaffoldingFile] = []

        mappings = [
            ("service.yaml.tpl", "service.yaml"),
            ("package.json.tpl", "package.json"),
            ("pnpm-workspace.yaml.tpl", "pnpm-workspace.yaml"),
            ("tsconfig.json.tpl", "tsconfig.json"),
            ("vite.config.ts.tpl", "vite.config.ts"),
            ("index.html.tpl", "index.html"),
            ("Dockerfile.tpl", "Dockerfile"),
            ("nginx.conf.tpl", "nginx.conf"),
            ("src/App.tsx.tpl", "src/App.tsx"),
            ("src/main.tsx.tpl", "src/main.tsx"),
            ("src/App.test.tsx.tpl", "src/App.test.tsx"),
        ]

        for tpl_rel, out_rel in mappings:
            content = (tpl_dir / tpl_rel).read_text(encoding="utf-8")
            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / out_rel),
                    render_template(content, vars_map),
                )
            )

        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "README.md"),
                f"# {vars_map['PRODUCT_NAME']} {vars_map['SERVICE_ID']}\n\nReact web service for {vars_map['PRODUCT_ID']}.\n",
            )
        )
        return files

    def _render_go_template(
        self, service_dir_rel: Path, vars_map: Dict[str, str]
    ) -> List[ScaffoldingFile]:
        tpl_dir = self.templates_dir / "go"
        files: List[ScaffoldingFile] = []

        mappings = [
            ("service.yaml.tpl", "service.yaml"),
            ("go.mod.tpl", "go.mod"),
            ("main.go.tpl", "main.go"),
            ("main_test.go.tpl", "main_test.go"),
            ("Dockerfile.tpl", "Dockerfile"),
        ]

        for tpl_rel, out_rel in mappings:
            content = (tpl_dir / tpl_rel).read_text(encoding="utf-8")
            files.append(
                ScaffoldingFile(
                    str(service_dir_rel / out_rel),
                    render_template(content, vars_map),
                )
            )

        files.append(
            ScaffoldingFile(
                str(service_dir_rel / "README.md"),
                f"# {vars_map['PRODUCT_NAME']} {vars_map['SERVICE_ID']}\n\nGo {vars_map['SERVICE_TYPE']} service for {vars_map['PRODUCT_ID']}.\n",
            )
        )
        return files

    def _render_postgres_init_script(
        self, product_id: str, vars_map: Dict[str, str]
    ) -> ScaffoldingFile:
        """Generates idempotent initialization script for the product database."""
        init_dir = Path("platform") / "deploy" / "postgres" / "init"
        existing_for_prod = list((self.repo_root / init_dir).glob(f"*-init-{product_id}-db.sh")) if (self.repo_root / init_dir).is_dir() else []
        if existing_for_prod:
            script_rel = init_dir / existing_for_prod[0].name
        else:
            existing_scripts = list((self.repo_root / init_dir).glob("*.sh")) if (self.repo_root / init_dir).is_dir() else []
            next_num = len(existing_scripts) + 1
            script_name = f"{next_num:02d}-init-{product_id}-db.sh"
            script_rel = init_dir / script_name

        tpl_content = (self.templates_dir / "postgres" / "init-db.sh.tpl").read_text(encoding="utf-8")
        rendered = render_template(tpl_content, vars_map)
        return ScaffoldingFile(str(script_rel), rendered, executable=True)

    def _apply_scaffolding(self, result: ScaffoldingResult) -> None:
        """Transactionally writes scaffolded files to disk with automatic rollback on failure."""
        created_paths: List[Path] = []
        modified_backups: Dict[Path, str] = {}

        try:
            # 1. Back up any files to be modified
            for sf in result.files_to_modify:
                dest = safe_resolve_repo_path(self.repo_root, sf.relative_path)
                if dest.is_file():
                    modified_backups[dest] = dest.read_text(encoding="utf-8")

            # 2. Write new files
            for sf in result.files_to_create:
                dest = safe_resolve_repo_path(self.repo_root, sf.relative_path)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(sf.content, encoding="utf-8")
                created_paths.append(dest)
                if sf.executable:
                    dest.chmod(dest.stat().st_mode | 0o111)

            # 3. Write modified files
            for sf in result.files_to_modify:
                dest = safe_resolve_repo_path(self.repo_root, sf.relative_path)
                dest.write_text(sf.content, encoding="utf-8")

        except Exception as exc:
            # Rollback: restore modified files to original state
            for dest, original_content in modified_backups.items():
                try:
                    dest.write_text(original_content, encoding="utf-8")
                except Exception:
                    pass
            # Delete any newly created files
            for dest in reversed(created_paths):
                try:
                    if dest.is_file():
                        dest.unlink()
                except Exception:
                    pass
            raise ScaffoldError(f"Scaffolding transaction aborted and rolled back: {exc}") from exc

    def generate_compose_snippet(
        self,
        product_id: str,
        service_id: str,
        template: str,
        port: int,
        with_database: bool = False,
        service_type: str = "api",
    ) -> str:
        """Generates a modular Docker Compose service definition block for the scaffolded service."""
        container_name = f"{product_id}-{service_id}"
        image_var = f"IMAGE_{product_id.upper().replace('-', '_')}_{service_id.upper().replace('-', '_')}"
        context_path = f"../../apps/{product_id}/{service_id}"
        product_norm = product_id.replace("-", "_")

        is_worker = (service_type == "worker")
        networks = ["internal-network"] if is_worker else ["edge-network"]
        if with_database:
            networks.append("data-network")

        networks_yaml = "\n".join(f"      - {net}" for net in networks)

        env_block = ""
        if with_database:
            env_block = f"""    environment:
      DATABASE_URL: ${{DATABASE_URL:-postgresql+psycopg://role_{product_norm}_app:{product_norm}_app_dev_password@postgres:5432/db_{product_norm}}}
"""

        depends_block = ""
        if with_database:
            depends_block = """    depends_on:
      postgres:
        condition: service_healthy
"""

        ports_block = ""
        if not is_worker:
            ports_block = f"""    ports:
      - "${{PORT_{product_id.upper().replace('-', '_')}_{service_id.upper().replace('-', '_')}:-{port}}}:{port}"
"""

        health_cmd = (
            f'["python3", "-c", "import urllib.request; urllib.request.urlopen(\'http://127.0.0.1:{port}/health\').read()"]'
            if template == "fastapi"
            else f'["wget", "-qO-", "http://127.0.0.1:{port}/health"]'
        )

        snippet = f"""  {container_name}:
    build:
      context: {context_path}
      dockerfile: Dockerfile
    image: ${{{image_var}:-megalith-{product_id}-{service_id}:local}}
    restart: unless-stopped
{depends_block}{env_block}    networks:
{networks_yaml}
{ports_block}    healthcheck:
      test: {health_cmd}
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
"""
        return snippet

    def generate_caddy_route_snippet(
        self,
        product_id: str,
        service_id: str,
        port: int,
        path_prefix: Optional[str] = None,
    ) -> str:
        """Generates a Caddy reverse proxy route snippet for the service."""
        container_name = f"{product_id}-{service_id}"
        prefix = path_prefix or f"/{product_id}/{service_id}*"
        return f"""\thandle {prefix} {{
\t\treverse_proxy {container_name}:{port}
\t}}
"""

    def check_ingress_conflicts(
        self, product_id: str, service_id: str, port: int
    ) -> List[str]:
        """Detects potential port collisions or duplicate service names across products."""
        warnings: List[str] = []
        existing_ports = self.get_existing_ports()
        candidate = f"{product_id}/{service_id}"

        if port in existing_ports and existing_ports[port] != candidate:
            warnings.append(
                f"Port conflict: Port {port} is already used by '{existing_ports[port]}'. "
                f"Scaffolding '{candidate}' with port {port} will cause a runtime port collision."
            )

        container_name = f"{product_id}-{service_id}"
        compose_path = self.repo_root / "platform" / "deploy" / "compose.yaml"
        if compose_path.is_file():
            try:
                content = compose_path.read_text(encoding="utf-8")
                compose_data = yaml.safe_load(content) or {}
                if container_name in compose_data.get("services", {}):
                    warnings.append(
                        f"Container name conflict: Service '{container_name}' already declared in platform/deploy/compose.yaml."
                    )
            except Exception:
                pass

        return warnings
