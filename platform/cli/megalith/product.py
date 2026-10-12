"""
Megalith CLI product management commands (Task 019).

Provides:
- megalith product create: Scaffolds a new product and registers it in projects.yaml.
- megalith product list: Lists registered products and services.
- megalith product validate: Validates specified product manifests against schemas.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from megalith.discovery import (
    InvalidRepositoryError,
    RepositoryNotFoundError,
    find_repo_root,
    get_validator,
)
from megalith.scaffold import (
    ConflictError,
    InvalidIdentifierError,
    PathTraversalError,
    ScaffoldEngine,
    ScaffoldError,
)
from megalith.ui import print_error, print_success, print_warning, render_project_list

product_app = typer.Typer(
    name="product",
    help="Manage and scaffold Megalith products.",
    no_args_is_help=True,
)
console = Console()


def _resolve_root(repo_root: Path | None) -> Path:
    try:
        return find_repo_root(explicit_root=repo_root)
    except (RepositoryNotFoundError, InvalidRepositoryError) as e:
        print_error(str(e))
        raise typer.Exit(code=1)


@product_app.command(name="create")
def product_create(
    product_id: str = typer.Argument(
        ..., help="Unique product identifier in lowercase-kebab-case (e.g. 'fitness', 'billing')."
    ),
    name: Optional[str] = typer.Option(
        None, "--name", "-n", help="Human-readable product display name."
    ),
    description: Optional[str] = typer.Option(
        None, "--description", "-d", help="Brief description of the product purpose."
    ),
    docs: str = typer.Option(
        "README.md", "--docs", help="Product documentation file name."
    ),
    repo_root: Optional[Path] = typer.Option(
        None, "--repo-root", help="Explicit path to monorepo root."
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Preview generated files without writing to disk."
    ),
    force: bool = typer.Option(
        False, "--force", help="Overwrite existing files or registrations if they exist."
    ),
) -> None:
    """Scaffold a new product and register it in the project catalog."""
    root = _resolve_root(repo_root)
    engine = ScaffoldEngine(root)

    try:
        result = engine.create_product(
            product_id=product_id,
            name=name,
            description=description,
            docs=docs,
            dry_run=dry_run,
            force=force,
        )
    except (InvalidIdentifierError, PathTraversalError, ConflictError, ScaffoldError) as e:
        print_error(str(e))
        raise typer.Exit(code=1)

    prefix = "[PREVIEW] " if dry_run else ""
    console.print(f"\n{prefix}[bold green]Product '{product_id}' scaffolded successfully![/bold green]\n")

    table = Table(title=f"{prefix}Generated Files for Product '{product_id}'", show_header=True)
    table.add_column("Action", style="cyan")
    table.add_column("Path", style="magenta")

    for f in result.files_to_create:
        table.add_row("CREATE", f.relative_path)
    for f in result.files_to_modify:
        table.add_row("MODIFY", f.relative_path)

    console.print(table)
    if dry_run:
        console.print("\n[yellow]Dry-run mode: No files were written to disk.[/yellow]")
    else:
        print_success(f"Product '{product_id}' is ready. Next: run 'megalith service add {product_id} <service-id>' to add services.")


@product_app.command(name="list")
def product_list(
    repo_root: Optional[Path] = typer.Option(
        None, "--repo-root", help="Explicit path to monorepo root."
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog."
    ),
) -> None:
    """List all registered products and services."""
    root = _resolve_root(repo_root)
    validator = get_validator(root)
    result = validator.load_catalog(catalog_rel_path=catalog)

    if not result.is_valid:
        print_error(f"Catalog at '{catalog}' is invalid:")
        for err in result.errors:
            print_error(f"  - {err}")
        raise typer.Exit(code=1)

    render_project_list(result.products, result.services)


@product_app.command(name="validate")
def product_validate(
    product_id: Optional[str] = typer.Argument(
        None, help="Specific product ID to validate, or all if omitted."
    ),
    repo_root: Optional[Path] = typer.Option(
        None, "--repo-root", help="Explicit path to monorepo root."
    ),
    catalog: str = typer.Option(
        "projects.yaml", "--catalog", help="Relative path to project catalog."
    ),
) -> None:
    """Validate product and service manifests against JSON schemas."""
    root = _resolve_root(repo_root)
    validator = get_validator(root)
    result = validator.validate(catalog_rel_path=catalog)

    if product_id:
        if product_id not in result.products:
            print_error(f"Product '{product_id}' not found in catalog '{catalog}'.")
            raise typer.Exit(code=1)
        # Filter errors to this product
        prod_errors = [e for e in result.errors if product_id in e]
        if prod_errors:
            print_error(f"Validation failed for product '{product_id}':")
            for err in prod_errors:
                print_error(f"  - {err}")
            raise typer.Exit(code=1)
        print_success(f"Product '{product_id}' and all its services are valid!")
        return

    if not result.is_valid:
        print_error("Manifest validation failed:")
        for err in result.errors:
            print_error(f"  - {err}")
        raise typer.Exit(code=1)

    print_success("All registered products and services validated cleanly!")


@product_app.command(name="db-init")
def product_db_init(
    product_id: str = typer.Argument(
        ..., help="Product identifier whose database initialization script should be applied."
    ),
    repo_root: Optional[Path] = typer.Option(
        None, "--repo-root", help="Explicit path to monorepo root."
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Preview SQL and execution steps without applying changes."
    ),
) -> None:
    """
    Safely initialize or onboard a product's isolated database and roles
    against an already running local PostgreSQL cluster (ADR-007).
    """
    root = _resolve_root(repo_root)
    init_dir = root / "platform" / "deploy" / "postgres" / "init"

    scripts = list(init_dir.glob(f"*-init-{product_id}-db.sh"))
    if not scripts:
        print_error(f"No PostgreSQL initialization script found for product '{product_id}' in '{init_dir}'.")
        console.print("[dim]Stateful services generate initialization scripts when created with '--database'.[/dim]")
        raise typer.Exit(code=1)

    script_path = scripts[0]
    script_content = script_path.read_text(encoding="utf-8")

    if dry_run:
        console.print(f"\n[bold yellow][PREVIEW] PostgreSQL Database Onboarding for '{product_id}'[/bold yellow]\n")
        try:
            rel_display = script_path.relative_to(root)
        except ValueError:
            rel_display = script_path
        console.print(f"Target script: [cyan]{rel_display}[/cyan]\n")
        console.print("[dim]--- Script Preview ---[/dim]")
        console.print(script_content)
        console.print("[dim]------------------------[/dim]\n")
        console.print("[yellow]Dry-run mode: No database changes were applied.[/yellow]")
        return

    # Check for running PostgreSQL container
    import subprocess
    container_candidates = ["megalith-postgres", "postgres"]
    target_container = None
    try:
        ps_out = subprocess.check_output(
            ["docker", "ps", "--format", "{{.Names}}"], text=True
        ).splitlines()
        for cand in container_candidates:
            if cand in ps_out:
                target_container = cand
                break
        if not target_container:
            for name in ps_out:
                if "postgres" in name:
                    target_container = name
                    break
    except Exception:
        pass

    if target_container:
        console.print(f"Applying database initialization script via container '[cyan]{target_container}[/cyan]'...")
        res = subprocess.run(
            ["docker", "exec", "-i", "-e", "POSTGRES_USER=postgres", "-e", "POSTGRES_DB=postgres", target_container, "bash"],
            input=script_content.encode("utf-8"),
            capture_output=True,
        )
        if res.returncode != 0:
            print_error(f"Failed to execute init script: {res.stderr.decode(errors='replace')}")
            raise typer.Exit(code=1)
        print_success(f"PostgreSQL database and isolated roles for '{product_id}' initialized successfully in container '{target_container}'.")
        return

    # Check direct psql connection
    try:
        res = subprocess.run(
            ["psql", "-U", "postgres", "-h", "localhost", "-p", "5432", "-f", str(script_path)],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            print_success(f"PostgreSQL database and isolated roles for '{product_id}' initialized successfully via local psql.")
            return
    except Exception:
        pass

    try:
        rel_display = script_path.relative_to(root)
    except ValueError:
        rel_display = script_path
    print_error("No running local PostgreSQL server detected.")
    console.print("\nTo apply this initialization script:")
    console.print("  1. Start the local database stack: [cyan]docker compose -f platform/deploy/compose.yaml up -d postgres[/cyan]")
    console.print(f"  2. Re-run: [cyan]megalith product db-init {product_id}[/cyan]")
    console.print(f"  Or execute manually: [cyan]psql -U postgres -f {rel_display}[/cyan]\n")
    raise typer.Exit(code=1)
