"""
Megalith CLI main entry point.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import typer

from megalith.discovery import (
    InvalidRepositoryError,
    RepositoryNotFoundError,
    find_repo_root,
    get_validator,
)
from megalith.product import product_app
from megalith.runner import CommandExecutionError, execute_service_command
from megalith.service import service_app
from megalith.staging import staging_app
from megalith.ui import (
    print_error,
    render_project_list,
    render_service_info,
    render_validation_result,
)

app = typer.Typer(
    name="megalith",
    help="Megalith Monorepo Developer Platform CLI.",
    add_completion=False,
    no_args_is_help=True,
)
app.add_typer(product_app, name="product")
app.add_typer(service_app, name="service")
app.add_typer(staging_app, name="staging")


def _resolve_env(
    repo_root: Path | None = None,
) -> tuple[Path, Any]:
    """Helper to discover repository root and instantiate the validator."""
    try:
        root = find_repo_root(explicit_root=repo_root)
        validator = get_validator(root)
        return root, validator
    except (RepositoryNotFoundError, InvalidRepositoryError) as e:
        print_error(str(e))
        raise typer.Exit(code=1)
    except Exception as e:
        print_error(f"Unexpected initialization error: {e}")
        raise typer.Exit(code=1)


@app.command(name="list")
def list_projects(
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog"
    ),
) -> None:
    """List registered products and services in the monorepo."""
    root, validator = _resolve_env(repo_root)
    result = validator.load_catalog(catalog_rel_path=catalog)

    if not result.is_valid:
        print_error(f"Catalog at '{catalog}' is invalid:")
        for err in result.errors:
            print_error(f"  - {err}")
        raise typer.Exit(code=1)

    render_project_list(result.products, result.services)


@app.command(name="info")
def service_info(
    service: str = typer.Argument(
        ..., help="Qualified service identifier in format <product>/<service>"
    ),
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog"
    ),
) -> None:
    """Display detailed configuration for a declared service."""
    root, validator = _resolve_env(repo_root)
    result = validator.load_catalog(catalog_rel_path=catalog)

    if not result.is_valid:
        print_error(f"Catalog at '{catalog}' is invalid:")
        for err in result.errors:
            print_error(f"  - {err}")
        raise typer.Exit(code=1)

    if service not in result.services:
        available = list(result.services.keys())
        avail_str = ", ".join(f"'{s}'" for s in sorted(available)) if available else "none"
        print_error(
            f"Unknown service '{service}'. Registered services: [{avail_str}]."
        )
        raise typer.Exit(code=1)

    svc_meta = result.services[service]
    prod_meta = result.products.get(svc_meta.product)
    render_service_info(svc_meta, prod_meta)


@app.command(name="validate")
def validate_manifests(
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog"
    ),
) -> None:
    """Validate monorepo manifests against JSON Schemas and domain rules."""
    root, validator = _resolve_env(repo_root)
    result = validator.validate(catalog_rel_path=catalog)
    render_validation_result(result, catalog_path=catalog, repo_root=str(root))

    if not result.is_valid:
        raise typer.Exit(code=1)


@app.command(name="run")
def run_command(
    service: str = typer.Argument(
        ..., help="Qualified service identifier (<product>/<service>)"
    ),
    command: str = typer.Argument(
        ..., help="Declared lifecycle command to execute (e.g. test, dev, build)"
    ),
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog"
    ),
) -> None:
    """Execute a declared lifecycle command for a service."""
    root, validator = _resolve_env(repo_root)
    result = validator.load_catalog(catalog_rel_path=catalog)

    if not result.is_valid:
        print_error(f"Cannot execute '{command}': manifest validation failed:")
        for err in result.errors:
            print_error(f"  - {err}")
        raise typer.Exit(code=1)

    if service not in result.services:
        available = list(result.services.keys())
        avail_str = ", ".join(f"'{s}'" for s in sorted(available)) if available else "none"
        print_error(
            f"Unknown service '{service}'. Registered services: [{avail_str}]."
        )
        raise typer.Exit(code=1)

    svc_meta = result.services[service]

    try:
        exit_code = execute_service_command(svc_meta, command, root)
    except CommandExecutionError as e:
        print_error(str(e))
        raise typer.Exit(code=e.exit_code)

    if exit_code != 0:
        raise typer.Exit(code=exit_code)


def main() -> None:
    """Entry point for python -m megalith.main or console script."""
    app()


if __name__ == "__main__":
    main()
