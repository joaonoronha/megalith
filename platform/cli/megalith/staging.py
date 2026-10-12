"""
Megalith CLI staging commands (Task 018).

Provides:
- megalith staging preflight: Configuration, architecture, ingress, database, and cost validation.
- megalith staging dry-run: Offline rendered compose, terraform validation, command preview, and cleanup plan.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

import typer

from megalith.discovery import (
    InvalidRepositoryError,
    RepositoryNotFoundError,
    find_repo_root,
)
from megalith.ui import print_error

# Add platform/deploy/scripts to sys.path to import staging workflow engine
_CLI_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _CLI_DIR.parent.parent.parent
_DEPLOY_SCRIPTS = _REPO_ROOT / "platform" / "deploy" / "scripts"
if str(_DEPLOY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_DEPLOY_SCRIPTS))

try:
    from staging import StagingMode, StagingWorkflow  # type: ignore
except ImportError:
    StagingMode = None  # type: ignore
    StagingWorkflow = None  # type: ignore

staging_app = typer.Typer(
    name="staging",
    help="Megalith reproducible staging deployment workflows.",
    no_args_is_help=True,
)


def _resolve_root(repo_root: Path | None) -> Path:
    try:
        return find_repo_root(explicit_root=repo_root)
    except (RepositoryNotFoundError, InvalidRepositoryError) as e:
        print_error(str(e))
        raise typer.Exit(code=1)


@staging_app.command(name="preflight")
def staging_preflight(
    mode: str = typer.Option(
        "local", "--mode", "-m", help="Staging deployment mode (local, gcp-micro, external-db, oci)"
    ),
    target_arch: str | None = typer.Option(
        None, "--target-arch", help="Target CPU architecture (e.g. amd64, arm64)"
    ),
    database_url: str | None = typer.Option(
        None, "--database-url", help="External database runtime URL (DATABASE_URL)"
    ),
    database_migrate_url: str | None = typer.Option(
        None, "--database-migrate-url", help="External database migration URL (DATABASE_MIGRATE_URL)"
    ),
    host_mode: bool = typer.Option(
        False, "--host-mode", help="Enforce live host network and port checks"
    ),
    output_json: bool = typer.Option(
        False, "--json", help="Output machine-readable JSON results"
    ),
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
) -> None:
    """Run read-only preflight checks before staging deployment."""
    root = _resolve_root(repo_root)

    # Ensure scripts directory of target repo is on sys.path
    target_scripts = root / "platform" / "deploy" / "scripts"
    if str(target_scripts) not in sys.path:
        sys.path.insert(0, str(target_scripts))
    from staging import StagingMode, StagingWorkflow  # type: ignore

    try:
        staging_mode = StagingMode(mode)
    except ValueError:
        valid_modes = ", ".join(f"'{m.value}'" for m in StagingMode)
        print_error(f"Invalid mode '{mode}'. Supported modes: {valid_modes}.")
        raise typer.Exit(code=1)

    workflow = StagingWorkflow(
        repo_root=root,
        mode=staging_mode,
        target_arch=target_arch,
        database_url=database_url,
        database_migrate_url=database_migrate_url,
        is_host_mode=host_mode,
    )

    report = workflow.run_preflight()

    if output_json:
        typer.echo(json.dumps(asdict(report), indent=2))
        if not report.all_passed:
            raise typer.Exit(code=1)
        return

    typer.echo("=" * 70)
    typer.echo(" Megalith Staging Deployment Preflight Check")
    typer.echo("=" * 70)
    typer.echo(f"Deployment Mode : {report.mode}")
    typer.echo(f"Target Arch     : {report.target_arch}")
    typer.echo(f"Classification  : {report.operation_classification} (Read-Only)")
    typer.echo("-" * 70)

    for c in report.checks:
        badge = {
            "PASS": "[ PASS ]",
            "WARN": "[ WARN ]",
            "FAIL": "[ FAIL ]",
            "INFO": "[ INFO ]",
        }.get(c.status, f"[{c.status}]")
        typer.echo(f"{badge} {c.name}: {c.message}")
        if c.details:
            for line in c.details.splitlines():
                typer.echo(f"         {line}")

    typer.echo("-" * 70)
    if report.all_passed:
        typer.echo("PREFLIGHT RESULT: PASSED - Staging deployment configuration is valid.")
        typer.echo("=" * 70)
    else:
        typer.echo("PREFLIGHT RESULT: FAILED - Preflight detected blocking errors above.")
        typer.echo("=" * 70)
        raise typer.Exit(code=1)


@staging_app.command(name="dry-run")
def staging_dry_run(
    mode: str = typer.Option(
        "local", "--mode", "-m", help="Staging deployment mode (local, gcp-micro, external-db, oci)"
    ),
    target_arch: str | None = typer.Option(
        None, "--target-arch", help="Target CPU architecture (e.g. amd64, arm64)"
    ),
    database_url: str | None = typer.Option(
        None, "--database-url", help="External database runtime URL (DATABASE_URL)"
    ),
    database_migrate_url: str | None = typer.Option(
        None, "--database-migrate-url", help="External database migration URL (DATABASE_MIGRATE_URL)"
    ),
    output_json: bool = typer.Option(
        False, "--json", help="Output machine-readable JSON results"
    ),
    repo_root: Path | None = typer.Option(
        None, "--repo-root", help="Explicit path to repository root"
    ),
) -> None:
    """Run offline dry-run staging workflow without modifying resources."""
    root = _resolve_root(repo_root)

    target_scripts = root / "platform" / "deploy" / "scripts"
    if str(target_scripts) not in sys.path:
        sys.path.insert(0, str(target_scripts))
    from staging import StagingMode, StagingWorkflow  # type: ignore

    try:
        staging_mode = StagingMode(mode)
    except ValueError:
        valid_modes = ", ".join(f"'{m.value}'" for m in StagingMode)
        print_error(f"Invalid mode '{mode}'. Supported modes: {valid_modes}.")
        raise typer.Exit(code=1)

    workflow = StagingWorkflow(
        repo_root=root,
        mode=staging_mode,
        target_arch=target_arch,
        database_url=database_url,
        database_migrate_url=database_migrate_url,
    )

    dry_run = workflow.run_dry_run()

    if output_json:
        typer.echo(json.dumps(asdict(dry_run), indent=2))
        if not (dry_run.syntax_valid and dry_run.terraform_valid):
            raise typer.Exit(code=1)
        return

    typer.echo("=" * 70)
    typer.echo(" Megalith Staging Deployment Dry-Run Summary")
    typer.echo("=" * 70)
    typer.echo(f"Deployment Mode : {dry_run.mode}")
    typer.echo(f"Target Arch     : {dry_run.target_arch}")
    typer.echo(f"Classification  : {dry_run.operation_classification} (Read-Only)")
    typer.echo(f"Compose Syntax  : {'VALID' if dry_run.syntax_valid else 'INVALID'}")
    typer.echo(f"Terraform State : {'VALID' if dry_run.terraform_valid else 'INVALID'}")
    typer.echo("-" * 70)
    typer.echo("Command Preview (All secrets masked):")
    for cmd in dry_run.command_preview:
        typer.echo(f"  {cmd}")
    typer.echo("-" * 70)
    typer.echo("Resource Inventory:")
    for category, items in dry_run.resource_inventory.items():
        typer.echo(f"  {category.upper()}:")
        for item in items:
            typer.echo(f"    - {item}")
    typer.echo("-" * 70)
    typer.echo("Cleanup Plan:")
    for step in dry_run.cleanup_plan:
        typer.echo(f"  {step}")
    typer.echo("=" * 70)

    if not (dry_run.syntax_valid and dry_run.terraform_valid):
        raise typer.Exit(code=1)
