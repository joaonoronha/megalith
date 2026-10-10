"""
Repository discovery and manifest catalog loading for Megalith CLI.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional


class RepositoryNotFoundError(Exception):
    """Raised when repository markers cannot be found in parent directories."""
    pass


class InvalidRepositoryError(Exception):
    """Raised when the specified repository root is invalid."""
    pass


def find_repo_root(
    explicit_root: Optional[Path] = None,
    start_dir: Optional[Path] = None,
) -> Path:
    """
    Discovers the Megalith repository root.

    Precedence:
    1. Explicit path passed as argument.
    2. MEGALITH_ROOT environment variable.
    3. Upward walk from start_dir (or current working directory) looking for markers:
       - projects.yaml
       - tooling/schemas/projects.schema.json
       - AGENTS.md
    """
    if explicit_root is not None:
        cand = Path(explicit_root).resolve()
        if _is_megalith_repo(cand):
            return cand
        raise InvalidRepositoryError(
            f"Specified path '{explicit_root}' is not a valid Megalith repository. "
            "Missing repository markers (projects.yaml, tooling/schemas/, AGENTS.md)."
        )

    env_root = os.environ.get("MEGALITH_ROOT")
    if env_root:
        cand = Path(env_root).resolve()
        if _is_megalith_repo(cand):
            return cand
        raise InvalidRepositoryError(
            f"MEGALITH_ROOT environment variable '{env_root}' is not a valid Megalith repository."
        )

    cur = (start_dir or Path.cwd()).resolve()
    while True:
        if _is_megalith_repo(cur):
            return cur
        parent = cur.parent
        if parent == cur:  # reached filesystem root
            break
        cur = parent

    raise RepositoryNotFoundError(
        "Not inside a Megalith repository. "
        "Could not locate repository markers (projects.yaml, tooling/schemas/projects.schema.json, AGENTS.md). "
        "Use --repo-root to specify an explicit path."
    )


def _is_megalith_repo(directory: Path) -> bool:
    """Verifies that a directory possesses all canonical Megalith repository markers."""
    if not directory.is_dir():
        return False
    has_projects = (directory / "projects.yaml").is_file()
    has_schemas = (directory / "tooling" / "schemas" / "projects.schema.json").is_file()
    has_agents = (directory / "AGENTS.md").is_file()
    return has_projects and has_schemas and has_agents


def get_validator(repo_root: Path):
    """
    Imports and instantiates ManifestValidator from the repository's tooling package.
    Ensures the repository root is on sys.path.
    """
    repo_root_str = str(repo_root.resolve())
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)

    try:
        from tooling.validate import ManifestValidator  # type: ignore
        return ManifestValidator(repo_root=repo_root)
    except ImportError as e:
        raise ImportError(
            f"Failed to import ManifestValidator from {repo_root / 'tooling' / 'validate.py'}: {e}"
        ) from e
