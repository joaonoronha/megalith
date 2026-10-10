#!/usr/bin/env python3
"""
Megalith PostgreSQL Product Database Restore Utility.

Restores a PostgreSQL custom archive format (-Fc) backup using pg_restore.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def restore_backup(
    host: str,
    port: int,
    user: str,
    password: str,
    target_database: str,
    backup_file: Path,
) -> bool:
    """Restores a logical database backup archive into the specified target database."""
    if not backup_file.is_file():
        print(f"ERROR: Backup file '{backup_file}' does not exist.", file=sys.stderr)
        return False

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    cmd = [
        "pg_restore",
        "-h", host,
        "-p", str(port),
        "-U", user,
        "-d", target_database,
        "--no-owner",
        "--no-privileges",
        "-v",
        str(backup_file),
    ]

    print(f"==> Restoring backup '{backup_file.name}' into database '{target_database}'...")
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)

    # Note: pg_restore returns 0 on clean exit, or 1 if warnings (e.g. non-fatal table drops) occur.
    # Check stderr for fatal errors
    if res.returncode != 0 and "FATAL" in res.stderr:
        print(f"ERROR: pg_restore fatal error:\n{res.stderr}", file=sys.stderr)
        return False

    print(f"SUCCESS: Database '{target_database}' restored from '{backup_file.name}'.")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Megalith product database restore utility.")
    parser.add_argument("--host", default=os.environ.get("POSTGRES_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("POSTGRES_PORT", "5432")))
    parser.add_argument("--user", default=os.environ.get("POSTGRES_USER", "postgres"))
    parser.add_argument("--password", default=os.environ.get("POSTGRES_PASSWORD", "postgres_dev_password"))
    parser.add_argument("--target-database", required=True, help="Database to restore into")
    parser.add_argument("--backup-file", type=Path, required=True, help="Path to .dump archive")

    args = parser.parse_args()

    success = restore_backup(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        target_database=args.target_database,
        backup_file=args.backup_file,
    )

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
