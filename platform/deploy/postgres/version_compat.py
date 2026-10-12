#!/usr/bin/env python3
"""
PostgreSQL Version Compatibility and Disaster Recovery Integrity Engine (Task 017).

Provides:
- Parser for PostgreSQL engine and client versions.
- Strict compatibility validation between pg_dump client and server versions.
- Cross-version restore compatibility analysis.
- Structural data and migration integrity verification for disaster recovery restores
  (ensures restore success is never reported solely based on process returncode 0).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


class VersionCompatibilityError(RuntimeError):
    """Raised when client/server versions are incompatible or restore data integrity check fails."""
    pass


def parse_version_tuple(ver_str: str) -> tuple[int, ...]:
    """
    Extracts major and minor version numbers from version strings.
    Examples:
      'pg_dump (PostgreSQL) 18.6 (Ubuntu ...)' -> (18, 6)
      'PostgreSQL 16.15 on x86_64' -> (16, 15)
      '180006' -> (18, 6)
      '16.15' -> (16, 15)
    """
    if not ver_str or not isinstance(ver_str, str):
        raise ValueError(f"Invalid version string: '{ver_str}'")

    ver_str = ver_str.strip()

    # Raw integer version format (e.g. 180006 = 18.6, 160002 = 16.2)
    if ver_str.isdigit() and len(ver_str) >= 5:
        num = int(ver_str)
        major = num // 10000
        minor = num % 100
        return (major, minor)

    # Standard SemVer / dotted regex
    m = re.search(r"\b(\d+)\.(\d+)(?:\.(\d+))?\b", ver_str)
    if m:
        parts = [int(p) for p in m.groups() if p is not None]
        return tuple(parts)

    # Major only
    m_maj = re.search(r"\b(\d+)\b", ver_str)
    if m_maj:
        return (int(m_maj.group(1)), 0)

    raise ValueError(f"Unable to parse PostgreSQL version from string: '{ver_str}'")


def validate_pg_dump_compatibility(client_version_str: str, server_version_str: str) -> None:
    """
    Validates that pg_dump client version is greater than or equal to the target server version.
    PostgreSQL's pg_dump strictly aborts if client major version < server major version.
    """
    client_ver = parse_version_tuple(client_version_str)
    server_ver = parse_version_tuple(server_version_str)

    client_major = client_ver[0]
    server_major = server_ver[0]

    if client_major < server_major:
        raise VersionCompatibilityError(
            f"PostgreSQL pg_dump client version {client_major} is incompatible with server version {server_major}. "
            f"pg_dump version must be greater than or equal to server version (Client: {client_version_str}, Server: {server_version_str}). "
            f"Install postgresql-client-{server_major} to perform logical backups."
        )


def validate_restore_target_compatibility(
    dump_server_version_str: str,
    target_server_version_str: str,
) -> list[str]:
    """
    Analyzes cross-version restore target compatibility and returns any warnings.
    """
    dump_ver = parse_version_tuple(dump_server_version_str)
    target_ver = parse_version_tuple(target_server_version_str)

    dump_major = dump_ver[0]
    target_major = target_ver[0]

    warnings = []
    if dump_major > target_major:
        warnings.append(
            f"Cross-version downgrade restore detected: dump originated from PG {dump_major}, "
            f"restoring into PG {target_major}. New parameters (e.g. transaction_timeout) may trigger "
            "non-fatal syntax warnings during restore initialization."
        )

    return warnings


def verify_restored_database_integrity(
    cursor: Any,
    expected_tables: list[str],
    min_rows: Optional[dict[str, int]] = None,
    expected_alembic_rev: Optional[str] = None,
) -> dict[str, Any]:
    """
    Structurally validates restored tables, row counts, and Alembic migration state.
    Prevents reporting disaster recovery success solely on subprocess returncode zero.
    """
    cursor.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """
    )
    existing_tables = set(row[0] for row in cursor.fetchall())

    missing_tables = [tbl for tbl in expected_tables if tbl not in existing_tables]
    if missing_tables:
        raise VersionCompatibilityError(
            f"Disaster Recovery Validation Failed: Restored database is missing expected tables: {missing_tables}. "
            f"Existing tables found: {sorted(list(existing_tables))}."
        )

    # Validate row counts
    counts: dict[str, int] = {}
    if min_rows:
        for tbl, min_count in min_rows.items():
            cursor.execute(f"SELECT COUNT(*) FROM public.{tbl};")
            count = cursor.fetchone()[0]
            counts[tbl] = count
            if count < min_count:
                raise VersionCompatibilityError(
                    f"Disaster Recovery Validation Failed: Table '{tbl}' has {count} rows, "
                    f"expected at least {min_count} rows."
                )

    # Validate Alembic revision if specified
    actual_rev = None
    if expected_alembic_rev:
        if "alembic_version" not in existing_tables:
            raise VersionCompatibilityError(
                "Disaster Recovery Validation Failed: alembic_version table missing in restored database."
            )
        cursor.execute("SELECT version_num FROM public.alembic_version LIMIT 1;")
        row = cursor.fetchone()
        if not row:
            raise VersionCompatibilityError(
                "Disaster Recovery Validation Failed: alembic_version table contains no revision records."
            )
        actual_rev = row[0]
        if actual_rev != expected_alembic_rev:
            raise VersionCompatibilityError(
                f"Disaster Recovery Validation Failed: Alembic revision mismatch. "
                f"Expected '{expected_alembic_rev}', got '{actual_rev}'."
            )

    return {
        "verified": True,
        "existing_tables": sorted(list(existing_tables)),
        "row_counts": counts,
        "alembic_revision": actual_rev,
    }
