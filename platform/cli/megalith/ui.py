"""
Rich UI and terminal presentation helpers for Megalith CLI.
"""

from __future__ import annotations

import sys
from typing import Any, Dict, List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()
err_console = Console(stderr=True)


def print_error(message: str) -> None:
    """Prints a styled error message to stderr."""
    err_console.print(f"[bold red]Error:[/bold red] {message}")


def print_warning(message: str) -> None:
    """Prints a styled warning message to stderr."""
    err_console.print(f"[bold yellow]Warning:[/bold yellow] {message}")


def print_success(message: str) -> None:
    """Prints a styled success message to stdout."""
    console.print(f"[bold green]Success:[/bold green] {message}")


def render_project_list(
    products: Dict[str, Any],
    services: Dict[str, Any],
) -> None:
    """Renders the projects and services table in deterministic order."""
    if not products:
        console.print("[yellow]No products registered.[/yellow]")
        return

    table = Table(
        title="Megalith Projects & Services",
        header_style="bold cyan",
        show_header=True,
    )
    table.add_column("PRODUCT", style="bold green")
    table.add_column("SERVICE", style="cyan")
    table.add_column("TYPE", style="magenta")
    table.add_column("LANGUAGE", style="blue")

    # Sort products deterministically
    for prod_id in sorted(products.keys()):
        prod = products[prod_id]
        prod_services = [s for s in services.values() if s.product == prod_id]
        if not prod_services:
            table.add_row(prod_id, "[dim](no services)[/dim]", "-", "-")
        else:
            # Sort services deterministically
            for svc in sorted(prod_services, key=lambda s: s.id):
                runtime_lang = svc.runtime.get("language", "-") if isinstance(svc.runtime, dict) else "-"
                table.add_row(
                    prod_id,
                    svc.qualified_id,
                    svc.type,
                    runtime_lang,
                )

    console.print(table)


def render_service_info(service: Any, product: Optional[Any] = None) -> None:
    """Renders detailed service metadata using Rich."""
    info_table = Table(show_header=False, box=None, padding=(0, 2))
    info_table.add_column("Field", style="bold cyan")
    info_table.add_column("Value")

    info_table.add_row("Service", f"[bold green]{service.qualified_id}[/bold green]")
    prod_name = product.name if product else service.product
    info_table.add_row("Product", f"{prod_name} ({service.product})")
    info_table.add_row("Type", service.type)

    # Runtime
    if isinstance(service.runtime, dict):
        rt_parts = [service.runtime.get("language", "unknown")]
        if service.runtime.get("version"):
            rt_parts.append(f"v{service.runtime.get('version')}")
        if service.runtime.get("framework"):
            rt_parts.append(f"({service.runtime.get('framework')})")
        info_table.add_row("Runtime", " ".join(rt_parts))
    else:
        info_table.add_row("Runtime", str(service.runtime))

    info_table.add_row("Working Directory", service.path)

    # Lifecycle Commands
    if isinstance(service.commands, dict) and service.commands:
        cmd_lines = []
        for cmd_name, cmd_val in sorted(service.commands.items()):
            if isinstance(cmd_val, list):
                cmd_str = " ".join(str(x) for x in cmd_val)
            else:
                cmd_str = str(cmd_val)
            cmd_lines.append(f"[bold]{cmd_name}[/bold]: {cmd_str}")
        info_table.add_row("Lifecycle Commands", "\n".join(cmd_lines))
    else:
        info_table.add_row("Lifecycle Commands", "[dim]None declared[/dim]")

    # Dependencies
    if isinstance(service.dependencies, dict):
        svc_deps = service.dependencies.get("services", [])
        ext_deps = service.dependencies.get("external", [])
        dep_parts = []
        if svc_deps:
            dep_parts.append("Services: " + ", ".join(svc_deps))
        if ext_deps:
            dep_parts.append("External: " + ", ".join(ext_deps))
        info_table.add_row("Dependencies", "\n".join(dep_parts) if dep_parts else "[dim]None[/dim]")
    else:
        info_table.add_row("Dependencies", "[dim]None[/dim]")

    # Build Artifact
    if isinstance(service.artifact, dict):
        art_type = service.artifact.get("type", "none")
        img_name = service.artifact.get("image_name")
        art_str = f"{art_type} (image: {img_name})" if img_name else art_type
        info_table.add_row("Build Artifact", art_str)
    else:
        info_table.add_row("Build Artifact", str(service.artifact))

    # Deployment
    if isinstance(service.deployment, dict):
        deployable = service.deployment.get("deployable", False)
        target = service.deployment.get("target", "none")
        dep_str = f"Eligible: {deployable} (target: {target})"
        info_table.add_row("Deployment", dep_str)
    else:
        info_table.add_row("Deployment", "[dim]Not configured[/dim]")

    panel = Panel(
        info_table,
        title=f"Service Info: [bold green]{service.qualified_id}[/bold green]",
        border_style="cyan",
        expand=False,
    )
    console.print(panel)


def render_validation_result(result: Any, catalog_path: str, repo_root: str) -> None:
    """Renders manifest validation results."""
    console.print(f"[bold cyan]Megalith Manifest Validation[/bold cyan]")
    console.print(f"Repository Root : {repo_root}")
    console.print(f"Catalog Path    : {catalog_path}")
    console.print(f"Products Found  : {result.product_count}")
    console.print(f"Services Found  : {result.service_count}")
    console.print("-" * 60)

    if result.is_valid:
        console.print("[bold green]STATUS: SUCCESS[/bold green]")
        console.print("All manifests and contracts are valid.")
    else:
        err_console.print(
            f"[bold red]STATUS: FAILED ({len(result.errors)} error(s) found):[/bold red]"
        )
        for idx, err in enumerate(result.errors, 1):
            err_console.print(f"  [{idx}] {err}")
