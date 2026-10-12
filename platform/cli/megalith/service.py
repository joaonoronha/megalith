"""
Megalith CLI service management commands (Task 019).

Provides:
- megalith service add: Scaffolds a new service into an existing product.
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
)
from megalith.scaffold import (
    ConflictError,
    InvalidIdentifierError,
    PathTraversalError,
    ScaffoldEngine,
    ScaffoldError,
    TemplateNotFoundError,
)
from megalith.ui import print_error, print_success, print_warning

service_app = typer.Typer(
    name="service",
    help="Manage and scaffold Megalith services.",
    no_args_is_help=True,
)
console = Console()


def _resolve_root(repo_root: Path | None) -> Path:
    try:
        return find_repo_root(explicit_root=repo_root)
    except (RepositoryNotFoundError, InvalidRepositoryError) as e:
        print_error(str(e))
        raise typer.Exit(code=1)


@service_app.command(name="add")
def service_add(
    product_id: str = typer.Argument(
        ..., help="Parent product identifier (e.g. 'demo', 'fitness')."
    ),
    service_id: str = typer.Argument(
        ..., help="Service identifier in lowercase-kebab-case (e.g. 'api', 'web', 'worker')."
    ),
    template: str = typer.Option(
        ...,
        "--template",
        "-t",
        help="Template to scaffold from: 'fastapi' (Python), 'react' (TypeScript), or 'go' (Go).",
    ),
    service_type: str = typer.Option(
        "api",
        "--type",
        help="Architectural role enum: 'api', 'web', 'worker', 'library', 'cli', 'other'.",
    ),
    port: int = typer.Option(
        8000,
        "--port",
        "-p",
        help="Default development/container port.",
    ),
    database: bool = typer.Option(
        False,
        "--database/--no-database",
        help="Whether to configure PostgreSQL 16 database and isolated roles (ADR-007).",
    ),
    deployable: bool = typer.Option(
        True,
        "--deployable/--no-deployable",
        help="Whether service is eligible for standalone deployment.",
    ),
    target: str = typer.Option(
        "oci-vm",
        "--target",
        help="Target deployment platform: 'oci-vm', 'static', 'none'.",
    ),
    repo_root: Optional[Path] = typer.Option(
        None, "--repo-root", help="Explicit path to monorepo root."
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Preview generated files without writing to disk."
    ),
    force: bool = typer.Option(
        False, "--force", help="Overwrite existing files if they exist."
    ),
) -> None:
    """Scaffold a new service into an existing product."""
    root = _resolve_root(repo_root)
    engine = ScaffoldEngine(root)

    # Smart default for web template port if user didn't explicitly override from default 8000
    effective_port = port
    if template == "react" and port == 8000:
        effective_port = 8080

    try:
        result = engine.add_service(
            product_id=product_id,
            service_id=service_id,
            template=template,
            service_type=service_type,
            port=effective_port,
            with_database=database,
            deployable=deployable,
            target=target,
            dry_run=dry_run,
            force=force,
        )
    except (
        InvalidIdentifierError,
        PathTraversalError,
        ConflictError,
        TemplateNotFoundError,
        ScaffoldError,
    ) as e:
        print_error(str(e))
        raise typer.Exit(code=1)

    prefix = "[PREVIEW] " if dry_run else ""
    console.print(
        f"\n{prefix}[bold green]Service '{product_id}/{service_id}' ({template}) scaffolded successfully![/bold green]\n"
    )

    table = Table(
        title=f"{prefix}Generated Files for Service '{product_id}/{service_id}'", show_header=True
    )
    table.add_column("Action", style="cyan")
    table.add_column("Path", style="magenta")

    for f in result.files_to_create:
        table.add_row("CREATE", f.relative_path)
    for f in result.files_to_modify:
        table.add_row("MODIFY", f.relative_path)

    console.print(table)

    for w in result.warnings:
        print_warning(f"Notice: {w}")

    if dry_run:
        console.print("\n[yellow]Dry-run mode: No files were written to disk.[/yellow]")
    else:
        print_success(
            f"Service '{product_id}/{service_id}' is ready. Test it with 'megalith run {product_id}/{service_id} test'."
        )
        console.print(f"\n[cyan]Deployment Snippets Generated:[/cyan]")
        console.print(f"  • Compose: apps/{product_id}/{service_id}/compose.snippet.yaml")
        if service_type in ("api", "web"):
            console.print(f"  • Caddy Ingress: apps/{product_id}/{service_id}/caddy.snippet.txt")
        console.print(
            "[dim]Note: Standalone snippets generated. To integrate into local staging, "
            "include in platform/deploy/compose.yaml and platform/deploy/caddy/Caddyfile.[/dim]"
        )
        if database:
            console.print(
                f"[dim]Note: PostgreSQL script generated. If your local container is already running, "
                f"apply with 'megalith product db-init {product_id}'.[/dim]"
            )
