#!/usr/bin/env python3
"""
Megalith PostgreSQL Product Database Backup Utility.

Executes a PostgreSQL-native logical backup using pg_dump.
Generates timestamped archives in custom format (-Fc) suitable for pg_restore.
"""

from __future__ import annotations

import argparse
import datetime
import os
import subprocess
import sys
from pathlib import Path


def create_backup(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    output_dir: Path,
) -> Path:
    """Creates a consistent logical database backup using pg_dump."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = output_dir / f"{database}_{timestamp}.dump"

    if backup_file.exists():
        raise FileExistsError(f"Backup destination file '{backup_file}' already exists.")

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    cmd = [
        "pg_dump",
        "-h", host,
        "-p", str(port),
        "-U", user,
        "-F", "c",          # Custom binary archive format (pg_restore compatible)
        "-b",               # Include large objects
        "-v",               # Verbose
        "-f", str(backup_file),
        database,
    ]

    print(f"==> Initiating backup for database '{database}' to '{backup_file.name}'...")
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)

    if res.returncode != 0:
        if backup_file.exists():
            backup_file.unlink(missing_ok=True)
        print(f"ERROR: pg_dump failed with exit code {res.returncode}:\n{res.stderr}", file=sys.stderr)
        sys.exit(res.returncode)

    if not backup_file.exists() or backup_file.stat().st_size == 0:
        if backup_file.exists():
            backup_file.unlink(missing_ok=True)
        print("ERROR: Backup file was created empty or missing.", file=sys.stderr)
        sys.exit(1)

    print(f"SUCCESS: Backup complete. File size: {backup_file.stat().st_size} bytes.")
    return backup_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Megalith product database backup utility.")
    parser.add_argument("--host", default=os.environ.get("POSTGRES_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("POSTGRES_PORT", "5432")))
    parser.add_argument("--user", default=os.environ.get("POSTGRES_USER", "postgres"))
    parser.add_argument("--password", default=os.environ.get("POSTGRES_PASSWORD", "postgres_dev_password"))
    parser.add_argument("--database", default=os.environ.get("DEMO_DB_NAME", "db_demo"))
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "backups",
    )

    args = parser.parse_args()

    try:
        create_backup(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.database,
            output_dir=args.output_dir,
        )
        return 0
    except Exception as exc:
        print(f"ERROR: Backup failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
