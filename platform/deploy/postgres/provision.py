#!/usr/bin/env python3
"""
Megalith PostgreSQL Product Database and Role Provisioner.

Provides idempotent provisioning of product databases, migration roles, and
application runtime roles in accordance with ADR-007.

Can be run against a freshly initialized or existing PostgreSQL instance.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys


def provision_product_database(
    host: str,
    port: int,
    admin_user: str,
    admin_password: str,
    db_name: str,
    migrate_user: str,
    migrate_password: str,
    app_user: str,
    app_password: str,
) -> bool:
    """Idempotently provisions a product database and isolated roles."""
    env = os.environ.copy()
    env["PGPASSWORD"] = admin_password

    base_cmd = [
        "psql",
        "-h", host,
        "-p", str(port),
        "-U", admin_user,
        "-v", "ON_ERROR_STOP=1",
    ]

    print(f"==> Provisioning roles for database '{db_name}'...")

    # Step 1: Provision roles and database on default 'postgres' database
    sql_step1 = f"""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{migrate_user}') THEN
            CREATE ROLE {migrate_user} WITH LOGIN PASSWORD '{migrate_password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE {migrate_user} WITH PASSWORD '{migrate_password}';
        END IF;

        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{app_user}') THEN
            CREATE ROLE {app_user} WITH LOGIN PASSWORD '{app_password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE {app_user} WITH PASSWORD '{app_password}';
        END IF;
    END
    $$;

    SELECT 'CREATE DATABASE {db_name} OWNER {migrate_user}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '{db_name}')\\gexec

    REVOKE CONNECT ON DATABASE {db_name} FROM PUBLIC;
    GRANT CONNECT ON DATABASE {db_name} TO {migrate_user};
    GRANT CONNECT ON DATABASE {db_name} TO {app_user};
    """

    res1 = subprocess.run(
        base_cmd + ["-d", "postgres", "-c", sql_step1],
        env=env,
        capture_output=True,
        text=True,
    )
    if res1.returncode != 0:
        print(f"ERROR in Step 1 (Role/Database creation):\n{res1.stderr}", file=sys.stderr)
        return False

    # Step 2: Grant permissions within the product database
    sql_step2 = f"""
    ALTER SCHEMA public OWNER TO {migrate_user};
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO {migrate_user};

    GRANT USAGE ON SCHEMA public TO {app_user};

    ALTER DEFAULT PRIVILEGES FOR ROLE {migrate_user} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {app_user};

    ALTER DEFAULT PRIVILEGES FOR ROLE {migrate_user} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO {app_user};
    """

    res2 = subprocess.run(
        base_cmd + ["-d", db_name, "-c", sql_step2],
        env=env,
        capture_output=True,
        text=True,
    )
    if res2.returncode != 0:
        print(f"ERROR in Step 2 (Schema permission grants):\n{res2.stderr}", file=sys.stderr)
        return False

    print(f"SUCCESS: Database '{db_name}' provisioned with roles '{migrate_user}' and '{app_user}'.")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Provision product database and isolated roles.")
    parser.add_argument("--host", default=os.environ.get("POSTGRES_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("POSTGRES_PORT", "5432")))
    parser.add_argument("--admin-user", default=os.environ.get("POSTGRES_USER", "postgres"))
    parser.add_argument("--admin-password", default=os.environ.get("POSTGRES_PASSWORD", "postgres_dev_password"))
    parser.add_argument("--db-name", default=os.environ.get("DEMO_DB_NAME", "db_demo"))
    parser.add_argument("--migrate-user", default=os.environ.get("DEMO_DB_MIGRATE_USER", "role_demo_migrate"))
    parser.add_argument("--migrate-password", default=os.environ.get("DEMO_DB_MIGRATE_PASSWORD", "demo_migrate_dev_password"))
    parser.add_argument("--app-user", default=os.environ.get("DEMO_DB_APP_USER", "role_demo_app"))
    parser.add_argument("--app-password", default=os.environ.get("DEMO_DB_APP_PASSWORD", "demo_app_dev_password"))

    args = parser.parse_args()

    success = provision_product_database(
        host=args.host,
        port=args.port,
        admin_user=args.admin_user,
        admin_password=args.admin_password,
        db_name=args.db_name,
        migrate_user=args.migrate_user,
        migrate_password=args.migrate_password,
        app_user=args.app_user,
        app_password=args.app_password,
    )

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
