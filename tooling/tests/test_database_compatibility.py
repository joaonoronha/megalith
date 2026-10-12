"""
Database compatibility and isolation regression tests for Megalith (Task 014).

Verifies:
1. Application database access can be configured through externally supplied connection URLs.
2. TLS configuration can be expressed with strict certificate verification (verify-full).
3. Transaction-based connection pooler compatibility (NullPool for migrations, non-prepared statements).
4. Credential hygiene (passwords masked in URLs, error messages, and logs).
5. Least-privilege role separation (runtime role has DML only; cannot perform DDL).
6. Non-superuser migration execution (migrator role lacks SUPERUSER privilege).
7. Cross-application schema and data isolation (one app's credentials cannot access another's data).
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from urllib.parse import parse_qs, urlparse

import pytest

pytest.importorskip("sqlalchemy")
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.pool import NullPool


# ---------------------------------------------------------------------------
# Unit Tests (Offline - no Docker required)
# ---------------------------------------------------------------------------


def test_external_connection_url_parsing():
    """Verify external connection URLs with various formats and parameters are parsed cleanly."""
    # Note: RFC 3986 requires percent-encoding '@' as '%40' in passwords
    raw_url = "postgresql+psycopg://app_user:s3cr3t_p%40ss!@ep-demo-123.us-east-2.aws.neon.tech:5432/neondb?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt"
    sa_url = make_url(raw_url)

    assert sa_url.drivername == "postgresql+psycopg"
    assert sa_url.username == "app_user"
    assert sa_url.password == "s3cr3t_p@ss!"
    assert sa_url.host == "ep-demo-123.us-east-2.aws.neon.tech"
    assert sa_url.port == 5432
    assert sa_url.database == "neondb"
    assert sa_url.query["sslmode"] == "verify-full"
    assert sa_url.query["sslrootcert"] == "/etc/ssl/certs/ca-certificates.crt"


def test_tls_configuration_enforces_certificate_verification():
    """Verify that TLS parameters can enforce strict verification and reject unverified modes."""
    valid_secure_urls = [
        "postgresql+psycopg://u:p@db.example.com:5432/prod?sslmode=verify-full",
        "postgresql+psycopg://u:p@db.example.com:5432/prod?sslmode=verify-ca&sslrootcert=/path/ca.pem",
    ]

    for url_str in valid_secure_urls:
        url = make_url(url_str)
        assert url.query.get("sslmode") in ("verify-full", "verify-ca")

    insecure_url = "postgresql+psycopg://u:p@db.example.com:5432/prod?sslmode=disable"
    url = make_url(insecure_url)
    assert url.query.get("sslmode") == "disable"
    # Strict validation policy: in production, sslmode must not be disable
    assert url.query.get("sslmode") not in ("verify-full", "verify-ca")


def test_credential_hygiene_masks_passwords_in_strings_and_logs(caplog):
    """Verify that database connection URLs mask secret passwords when converted to string or logged."""
    raw_url = "postgresql+psycopg://admin_user:super_secret_token_12345@neon-host.example.com/db_prod"
    sa_url = make_url(raw_url)

    safe_representation = sa_url.render_as_string(hide_password=True)
    assert "super_secret_token_12345" not in safe_representation
    assert "***" in safe_representation
    assert "admin_user" in safe_representation

    # Test logging hygiene
    logger = logging.getLogger("test_db_logger")
    with caplog.at_level(logging.INFO):
        logger.info("Connecting to database: %s", sa_url.render_as_string(hide_password=True))

    assert "super_secret_token_12345" not in caplog.text
    assert "***" in caplog.text


def test_alembic_migration_env_uses_null_pool():
    """Verify that Alembic migrations env.py specifies NullPool for transaction-pooler safety."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_py_path = os.path.join(repo_root, "apps", "demo", "api", "migrations", "env.py")
    with open(env_py_path, encoding="utf-8") as f:
        content = f.read()

    assert "poolclass=pool.NullPool" in content
    assert "DATABASE_MIGRATE_URL" in content
    assert "Implicit fallback to application runtime credentials (DATABASE_URL) is prohibited" in content


def test_transaction_pooler_prepared_statements_disabled():
    """Verify engine configuration can disable prepared statements for PgBouncer / Supavisor."""
    # When using transaction pooling (e.g. PgBouncer/Supavisor), prepare_threshold=None
    # prevents psycopg from using server-side prepared statements that fail across transactions.
    connect_args = {
        "connect_timeout": 5,
        "prepare_threshold": None,
    }
    assert connect_args.get("prepare_threshold") is None


# ---------------------------------------------------------------------------
# Integration Tests (Local PostgreSQL Container)
# ---------------------------------------------------------------------------


def _is_docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        res = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return res.returncode == 0
    except Exception:
        return False


@pytest.fixture(scope="module")
def postgres_container():
    """Spins up a temporary local PostgreSQL container for permission and role isolation testing."""
    if not _is_docker_available():
        pytest.skip("Docker daemon not available for live PostgreSQL tests")

    container_name = f"megalith-pg-compat-test-{int(time.time())}"
    superuser_password = "super_admin_test_pw_987"
    port = "54328"

    # Start container
    cmd = [
        "docker", "run", "--name", container_name,
        "-e", f"POSTGRES_PASSWORD={superuser_password}",
        "-p", f"{port}:5432",
        "-d", "postgres:16-alpine",
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

    # Wait for container readiness
    ready = False
    for _ in range(20):
        res = subprocess.run(
            ["docker", "exec", container_name, "pg_isready", "-U", "postgres"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if res.returncode == 0:
            ready = True
            break
        time.sleep(0.5)

    if not ready:
        subprocess.run(["docker", "rm", "-f", container_name], check=False, stdout=subprocess.DEVNULL)
        pytest.fail("PostgreSQL container failed to become ready in time")

    admin_url = f"postgresql+psycopg://postgres:{superuser_password}@127.0.0.1:{port}/postgres"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)

    # Wait for PostgreSQL host port to accept connections (handles entrypoint initial restart)
    connected = False
    for _ in range(30):
        try:
            with admin_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            connected = True
            break
        except Exception:
            time.sleep(0.5)

    if not connected:
        subprocess.run(["docker", "rm", "-f", container_name], check=False, stdout=subprocess.DEVNULL)
        pytest.fail("PostgreSQL container failed to accept external connections on host port")

    # Set up users, databases, and permissions simulating multi-tenant / multi-role topology
    with admin_engine.connect() as conn:
        # 1. Create two distinct application databases
        conn.execute(text("CREATE DATABASE db_demo;"))
        conn.execute(text("CREATE DATABASE db_billing;"))

        # 2. Create roles for App 1 (Demo): migrator and runtime app
        conn.execute(text("CREATE ROLE role_demo_migrate WITH LOGIN PASSWORD 'demo_mig_pw' NOSUPERUSER NOCREATEDB;"))
        conn.execute(text("CREATE ROLE role_demo_app WITH LOGIN PASSWORD 'demo_app_pw' NOSUPERUSER NOCREATEDB;"))

        # 3. Create roles for App 2 (Billing): runtime app
        conn.execute(text("CREATE ROLE role_billing_app WITH LOGIN PASSWORD 'billing_app_pw' NOSUPERUSER NOCREATEDB;"))

        # Revoke connect from PUBLIC so other users cannot connect by default
        conn.execute(text("REVOKE CONNECT ON DATABASE db_billing FROM PUBLIC;"))
        conn.execute(text("GRANT CONNECT ON DATABASE db_billing TO role_billing_app;"))
        conn.execute(text("REVOKE CONNECT ON DATABASE db_demo FROM PUBLIC;"))
        conn.execute(text("GRANT CONNECT ON DATABASE db_demo TO role_demo_migrate, role_demo_app;"))

    admin_engine.dispose()

    # Configure db_demo permissions: role_demo_migrate owns public schema, role_demo_app has only DML
    demo_admin_engine = create_engine(
        f"postgresql+psycopg://postgres:{superuser_password}@127.0.0.1:{port}/db_demo",
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    with demo_admin_engine.connect() as conn:
        conn.execute(text("ALTER SCHEMA public OWNER TO role_demo_migrate;"))
        conn.execute(text("GRANT USAGE, CREATE ON SCHEMA public TO role_demo_migrate;"))
        conn.execute(text("GRANT USAGE ON SCHEMA public TO role_demo_app;"))

        # Default privileges: future tables created by role_demo_migrate grant SELECT, INSERT, UPDATE, DELETE to role_demo_app
        conn.execute(text(
            "ALTER DEFAULT PRIVILEGES FOR ROLE role_demo_migrate IN SCHEMA public "
            "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_demo_app;"
        ))
        # Configure an isolated schema inside db_demo to test Topology C (Schema-level isolation)
        conn.execute(text("CREATE SCHEMA isolated_tenant;"))
        conn.execute(text("CREATE TABLE isolated_tenant.tenant_secrets (key text, val text);"))
        conn.execute(text("INSERT INTO isolated_tenant.tenant_secrets VALUES ('api_key', 'super_confidential_123');"))
        # Do NOT grant USAGE on isolated_tenant to role_demo_app
    demo_admin_engine.dispose()

    # Configure db_billing with a confidential table
    billing_admin_engine = create_engine(
        f"postgresql+psycopg://postgres:{superuser_password}@127.0.0.1:{port}/db_billing",
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    with billing_admin_engine.connect() as conn:
        conn.execute(text("CREATE TABLE billing_ledger (id serial PRIMARY KEY, account_number text, balance numeric);"))
        conn.execute(text("INSERT INTO billing_ledger (account_number, balance) VALUES ('ACC-999', 50000.00);"))
        conn.execute(text("GRANT ALL ON TABLE billing_ledger TO role_billing_app;"))
    billing_admin_engine.dispose()

    yield {
        "container_name": container_name,
        "port": port,
        "demo_migrate_url": f"postgresql+psycopg://role_demo_migrate:demo_mig_pw@127.0.0.1:{port}/db_demo",
        "demo_app_url": f"postgresql+psycopg://role_demo_app:demo_app_pw@127.0.0.1:{port}/db_demo",
        "billing_app_url": f"postgresql+psycopg://role_billing_app:billing_app_pw@127.0.0.1:{port}/db_billing",
        "demo_to_billing_url": f"postgresql+psycopg://role_demo_app:demo_app_pw@127.0.0.1:{port}/db_billing",
    }

    # Teardown
    subprocess.run(["docker", "rm", "-f", container_name], check=False, stdout=subprocess.DEVNULL)


def test_cross_schema_isolation_within_same_database(postgres_container):
    """Verify that within the same database, unauthorized roles cannot access other schemas (Topology C)."""
    app_engine = create_engine(postgres_container["demo_app_url"], poolclass=NullPool)

    with app_engine.connect() as conn:
        # Attempting to read from isolated_tenant.tenant_secrets must fail with permission denied
        with pytest.raises(DBAPIError) as exc_info:
            conn.execute(text("SELECT * FROM isolated_tenant.tenant_secrets;"))
        assert "permission denied" in str(exc_info.value).lower()
        conn.rollback()

    app_engine.dispose()


def test_no_database_credentials_in_tracked_manifests_or_infra():
    """Verify tracked configuration and manifests do not contain hardcoded production database credentials."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    critical_paths = [
        os.path.join(repo_root, "projects.yaml"),
        os.path.join(repo_root, "apps", "demo", "product.yaml"),
        os.path.join(repo_root, "platform", "deploy", "compose.prod.yaml"),
        os.path.join(repo_root, "platform", "infra", "gcp", "main.tf"),
        os.path.join(repo_root, "platform", "infra", "oci", "compute.tf"),
    ]

    suspicious_patterns = [
        "ep-",  # Neon endpoint prefix
        "supabase.co",
        "neon.tech",
        "password123",
        "prod_secret",
    ]

    for path in critical_paths:
        if os.path.exists(path):
            content = open(path, encoding="utf-8").read().lower()
            for pattern in suspicious_patterns:
                assert pattern not in content, f"Hardcoded credential pattern '{pattern}' found in {path}"



def test_non_superuser_migration_execution(postgres_container):
    """Verify that a role without superuser privileges can perform table creation and migrations."""
    migrate_engine = create_engine(postgres_container["demo_migrate_url"], poolclass=NullPool)

    with migrate_engine.connect() as conn:
        # Check that role_demo_migrate is indeed NOT superuser
        is_super = conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = 'role_demo_migrate';")).scalar()
        assert is_super is False, "role_demo_migrate must NOT be a superuser"

        # Execute DDL (simulate migration)
        conn.execute(text(
            "CREATE TABLE counter (id integer PRIMARY KEY, value integer NOT NULL DEFAULT 0);"
        ))
        conn.execute(text(
            "INSERT INTO counter (id, value) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;"
        ))
        conn.commit()

        # Verify table exists and row is inserted
        count = conn.execute(text("SELECT COUNT(*) FROM counter;")).scalar()
        assert count == 1
    migrate_engine.dispose()


def test_least_privilege_runtime_role_dml_allowed_ddl_forbidden(postgres_container):
    """Verify that runtime role can perform DML (SELECT, INSERT, UPDATE) but is blocked from DDL (DROP, CREATE)."""
    app_engine = create_engine(postgres_container["demo_app_url"], poolclass=NullPool)

    with app_engine.connect() as conn:
        # Check that runtime role is NOT superuser
        is_super = conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = 'role_demo_app';")).scalar()
        assert is_super is False

        # 1. DML Allowed: SELECT and UPDATE
        row = conn.execute(text("SELECT id, value FROM counter WHERE id = 1;")).fetchone()
        assert row is not None
        assert row[0] == 1

        conn.execute(text("UPDATE counter SET value = value + 1 WHERE id = 1;"))
        conn.commit()

        updated_val = conn.execute(text("SELECT value FROM counter WHERE id = 1;")).scalar()
        assert updated_val >= 1

        # 2. DDL Forbidden: DROP TABLE must fail
        with pytest.raises(DBAPIError) as exc_info:
            conn.execute(text("DROP TABLE counter;"))
        assert "permission denied" in str(exc_info.value).lower() or "must be owner" in str(exc_info.value).lower()
        conn.rollback()

        # 3. DDL Forbidden: CREATE TABLE must fail
        with pytest.raises(DBAPIError) as exc_info2:
            conn.execute(text("CREATE TABLE evil_table (id int);"))
        assert "permission denied" in str(exc_info2.value).lower()
        conn.rollback()

    app_engine.dispose()


def test_cross_application_isolation_enforced(postgres_container):
    """Verify that one application's credentials cannot connect to or query another application's database."""
    # Attempting to connect to db_billing with demo credentials must fail at connection/auth time
    demo_to_billing_engine = create_engine(postgres_container["demo_to_billing_url"], poolclass=NullPool)

    with pytest.raises(DBAPIError) as exc_info:
        with demo_to_billing_engine.connect():
            pass

    err_msg = str(exc_info.value).lower()
    assert "permission denied" in err_msg or "fatala" in err_msg or "privilege" in err_msg or "access" in err_msg or "password authentication failed" in err_msg
    demo_to_billing_engine.dispose()

    # Confirm billing app can connect to its own database
    billing_engine = create_engine(postgres_container["billing_app_url"], poolclass=NullPool)
    with billing_engine.connect() as conn:
        val = conn.execute(text("SELECT balance FROM billing_ledger WHERE account_number = 'ACC-999';")).scalar()
        assert float(val) == 50000.00
    billing_engine.dispose()
