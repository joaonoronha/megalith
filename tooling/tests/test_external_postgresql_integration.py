"""
Local Integration and Verification Tests for External PostgreSQL Mode (Tasks 015 & 015.1).

Verifies:
1. External database Compose overlay strictly omits local PostgreSQL service and dependencies.
2. Missing external URLs cause Docker Compose and Deployer to fail before starting services.
3. Explicit external URLs propagate cleanly without falling back to local postgres:5432.
4. Internal Compose hostname ('postgres') and local loopbacks ('localhost') are rejected.
5. Distinct runtime (DML) and migration (DDL) roles are enforced.
6. Target database environments must match between runtime and migration URLs.
7. Production TLS policy: strictly requires sslmode=verify-full; rejects disable, allow, prefer, require, verify-ca.
8. Real TLS verification: trusted CA succeeds, untrusted CA fails, hostname mismatch fails.
9. Runtime application, migration runner, and DR tools follow the same TLS policy.
10. Secret passwords are redacted as *** across all diagnostic outputs and error messages.
11. Non-superuser migrations, least-privilege role boundaries (DML allowed, DDL denied).
12. Cross-application access denial across separate logical databases.
13. Connection-pool driver compatibility (prepare_threshold=None).
14. Encrypted backup and clean restore using direct PostgreSQL connection URLs.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

pytest.importorskip("sqlalchemy")
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.pool import NullPool

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPOSE_BASE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
COMPOSE_PROD = REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
COMPOSE_EXTERNAL = REPO_ROOT / "platform" / "deploy" / "compose.external-db.yaml"
DEPLOY_SCRIPT = REPO_ROOT / "platform" / "deploy" / "scripts" / "deploy.py"

SYNTHETIC_APP_URL = "postgresql+psycopg://synth_app_user:synth_app_pw_123@synthetic-db.example.com:5432/synthetic_db?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
SYNTHETIC_MIG_URL = "postgresql+psycopg://synth_mig_user:synth_mig_pw_456@synthetic-db.example.com:5432/synthetic_db?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"

SYNTHETIC_ENV = {
    **os.environ,
    "DATABASE_URL": SYNTHETIC_APP_URL,
    "DATABASE_MIGRATE_URL": SYNTHETIC_MIG_URL,
}


# ---------------------------------------------------------------------------
# 1. Compose Configuration and Interpolation Tests
# ---------------------------------------------------------------------------


def test_external_compose_fails_when_urls_missing():
    """Verify Docker Compose fails immediately when DATABASE_URL or DATABASE_MIGRATE_URL is missing."""
    clean_env = {k: v for k, v in os.environ.items() if k not in ("DATABASE_URL", "DATABASE_MIGRATE_URL")}
    cmd = [
        "docker", "compose",
        "-f", str(COMPOSE_BASE),
        "-f", str(COMPOSE_EXTERNAL),
        "config",
    ]
    res = subprocess.run(cmd, env=clean_env, capture_output=True, text=True)
    assert res.returncode != 0
    err_str = res.stderr
    assert (
        "DATABASE_URL must be explicitly provided in external database mode" in err_str
        or "DATABASE_MIGRATE_URL must be explicitly provided in external database mode" in err_str
        or "DATABASE_URL" in err_str
        or "DATABASE_MIGRATE_URL" in err_str
    )


def test_external_compose_explicit_url_propagation():
    """Verify that supplied external URLs propagate into containers and never default to postgres:5432."""
    cmd = [
        "docker", "compose",
        "-f", str(COMPOSE_BASE),
        "-f", str(COMPOSE_EXTERNAL),
        "config",
    ]
    res = subprocess.run(cmd, env=SYNTHETIC_ENV, capture_output=True, text=True, check=True)
    cfg = yaml.safe_load(res.stdout)

    # 1. postgres service and volume are completely absent
    assert "postgres" not in cfg["services"], "Local postgres service must not exist in external mode"
    assert "volumes" not in cfg or "postgres-data" not in cfg.get("volumes", {}), "Local postgres-data volume must not exist"

    # 2. demo-api has the explicit external URL
    demo_api = cfg["services"]["demo-api"]
    assert demo_api["environment"]["DATABASE_URL"] == SYNTHETIC_APP_URL
    assert "postgres:5432" not in demo_api["environment"]["DATABASE_URL"]

    # 3. demo-migrate has the explicit migration URL
    demo_migrate = cfg["services"]["demo-migrate"]
    assert demo_migrate["environment"]["DATABASE_MIGRATE_URL"] == SYNTHETIC_MIG_URL
    assert "postgres:5432" not in demo_migrate["environment"]["DATABASE_MIGRATE_URL"]

    # 4. Dependency on local postgres is wiped
    assert "postgres" not in demo_migrate.get("depends_on", {})
    assert "postgres" not in demo_api.get("depends_on", {})
    assert "demo-migrate" in demo_api.get("depends_on", {})


def test_external_compose_overlay_with_prod_strictly_omits_local_postgres():
    """Verify that external overlay with production Caddy ingress also excludes local postgres."""
    cmd = [
        "docker", "compose",
        "-f", str(COMPOSE_BASE),
        "-f", str(COMPOSE_PROD),
        "-f", str(COMPOSE_EXTERNAL),
        "config", "--services",
    ]
    res = subprocess.run(cmd, env=SYNTHETIC_ENV, capture_output=True, text=True, check=True)
    services = [s.strip() for s in res.stdout.strip().splitlines() if s.strip()]

    assert "postgres" not in services
    assert "caddy" in services
    assert "demo-api" in services
    assert "demo-web" in services


# ---------------------------------------------------------------------------
# 2. Deployer Configuration, Safety, and Policy Enforcement
# ---------------------------------------------------------------------------


def test_deployer_rejects_missing_external_urls(monkeypatch, tmp_path):
    """Verify Deployer raises error if DATABASE_URL or DATABASE_MIGRATE_URL is missing in external mode."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_MIGRATE_URL", raising=False)

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            state_dir=tmp_path,
        )

    assert "requires both DATABASE_URL and DATABASE_MIGRATE_URL" in str(exc_info.value)


def test_deployer_rejects_internal_compose_hostname_in_external_mode(monkeypatch, tmp_path):
    """Verify Deployer rejects attempts to point external database mode to the disabled 'postgres' container."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:app_pw@postgres:5432/db")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", "postgresql+psycopg://mig:mig_pw@postgres:5432/db")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            state_dir=tmp_path,
        )

    assert "cannot target internal Docker Compose service 'postgres'" in str(exc_info.value)


@pytest.mark.parametrize("loopback_host", ["localhost", "127.0.0.1", "::1", "0.0.0.0"])
def test_deployer_rejects_loopback_in_production(monkeypatch, tmp_path, loopback_host):
    """Verify Deployer rejects local loopback endpoints in external production mode."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    host_fmt = f"[{loopback_host}]" if ":" in loopback_host else loopback_host
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://app:app_pw@{host_fmt}:5432/db?sslmode=verify-full")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", f"postgresql+psycopg://mig:mig_pw@{host_fmt}:5432/db?sslmode=verify-full")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            environment="production",
            state_dir=tmp_path,
        )

    assert "cannot target local loopback host" in str(exc_info.value)


@pytest.mark.parametrize("weak_sslmode", ["disable", "allow", "prefer", "require", "verify-ca", ""])
def test_deployer_rejects_weak_sslmodes_in_production(monkeypatch, tmp_path, weak_sslmode):
    """Verify Deployer strictly requires sslmode=verify-full in production and rejects weak modes."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    ssl_param = f"?sslmode={weak_sslmode}" if weak_sslmode else ""
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://app_usr:super_secret_pw_1@db.example.com:5432/db{ssl_param}")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", f"postgresql+psycopg://mig_usr:super_secret_pw_2@db.example.com:5432/db{ssl_param}")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            environment="production",
            state_dir=tmp_path,
        )

    err_str = str(exc_info.value)
    assert "strictly requires sslmode=verify-full" in err_str
    # Verify passwords are redacted
    assert "super_secret_pw_1" not in err_str
    assert "super_secret_pw_2" not in err_str
    assert "***" in err_str


def test_deployer_rejects_missing_sslrootcert_file_in_production(monkeypatch, tmp_path):
    """Verify Deployer rejects connection if specified sslrootcert file does not exist on disk."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    nonexistent_ca = str(tmp_path / "nonexistent_ca.crt")
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://app_usr:pw1@db.example.com:5432/db?sslmode=verify-full&sslrootcert={nonexistent_ca}")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", f"postgresql+psycopg://mig_usr:pw2@db.example.com:5432/db?sslmode=verify-full&sslrootcert={nonexistent_ca}")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            environment="production",
            state_dir=tmp_path,
        )

    assert "which does not exist on disk" in str(exc_info.value)


def test_deployer_rejects_identical_runtime_and_migration_roles(monkeypatch, tmp_path):
    """Verify Deployer enforces distinct roles for runtime DML and migration DDL."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    # Shared role violates least privilege
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://shared_user:pw1@db.example.com:5432/db?sslmode=require")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", "postgresql+psycopg://shared_user:pw2@db.example.com:5432/db?sslmode=require")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            environment="staging",
            state_dir=tmp_path,
        )

    assert "requires distinct roles for runtime DML (DATABASE_URL) and migration DDL (DATABASE_MIGRATE_URL)" in str(exc_info.value)


def test_deployer_rejects_mismatched_target_environments(monkeypatch, tmp_path):
    """Verify Deployer rejects configuration when DATABASE_URL and DATABASE_MIGRATE_URL target different databases."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app_user:pw1@db-prod.example.com:5432/db_prod?sslmode=require")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", "postgresql+psycopg://mig_user:pw2@db-staging.example.com:5432/db_staging?sslmode=require")

    with pytest.raises(DeploymentExecutionError) as exc_info:
        Deployer(
            compose_files=[COMPOSE_BASE],
            database_mode="external",
            environment="staging",
            state_dir=tmp_path,
        )

    assert "DATABASE_URL and DATABASE_MIGRATE_URL must target the same database environment" in str(exc_info.value)


def test_deployer_reachability_fails_safely_without_fallback(monkeypatch, tmp_path):
    """Verify reachability failure raises clean error and never silently falls back to local database."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    # Point to an unreachable port with distinct roles
    unreachable_app = "postgresql+psycopg://app_usr:secret_password_999@127.0.0.1:54399/db_unreachable?sslmode=require"
    unreachable_mig = "postgresql+psycopg://mig_usr:secret_password_999@127.0.0.1:54399/db_unreachable?sslmode=require"
    monkeypatch.setenv("DATABASE_URL", unreachable_app)
    monkeypatch.setenv("DATABASE_MIGRATE_URL", unreachable_mig)

    deployer = Deployer(
        compose_files=[COMPOSE_BASE],
        database_mode="external",
        environment="staging",
        state_dir=tmp_path,
    )

    with pytest.raises(DeploymentExecutionError) as exc_info:
        deployer.verify_database_reachability(timeout_sec=2)

    err_str = str(exc_info.value)
    assert "Failed to reach external database" in err_str
    assert "secret_password_999" not in err_str
    assert "***" in err_str


# ---------------------------------------------------------------------------
# 3. Component-Level Production TLS Enforcement
# ---------------------------------------------------------------------------


def test_runtime_app_rejects_insecure_connection_in_production(monkeypatch):
    """Verify demo-api db.py enforces production TLS policy."""
    sys_path_added = str(REPO_ROOT / "apps" / "demo" / "api")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from src.db import validate_production_connection

    monkeypatch.setenv("ENVIRONMENT", "production")

    # Insecure sslmode=require in production -> must raise ValueError
    with pytest.raises(ValueError) as exc1:
        validate_production_connection("postgresql+psycopg://app:pw@db.example.com:5432/db?sslmode=require")
    assert "strictly requires sslmode=verify-full" in str(exc1.value)

    # Local host in production -> must raise ValueError
    with pytest.raises(ValueError) as exc2:
        validate_production_connection("postgresql+psycopg://app:pw@localhost:5432/db?sslmode=verify-full")
    assert "cannot target local/internal host" in str(exc2.value)


def test_backup_and_restore_enforces_production_tls():
    """Verify backup.py and restore.py reject weak TLS modes in production."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "postgres")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from backup import validate_external_url_security as backup_val
    from restore import validate_external_url_security as restore_val

    # Test backup
    with pytest.raises(ValueError) as exc_b:
        backup_val("postgresql://mig:pw@db.example.com:5432/db?sslmode=prefer", environment="production")
    assert "strictly requires sslmode=verify-full" in str(exc_b.value)

    # Test restore
    with pytest.raises(ValueError) as exc_r:
        restore_val("postgresql://mig:pw@db.example.com:5432/db?sslmode=verify-ca", environment="production")
    assert "strictly requires sslmode=verify-full" in str(exc_r.value)


def test_migration_runner_rejects_insecure_connection_in_production(monkeypatch):
    """Verify Alembic migrations env.py rejects insecure connections in production."""
    pytest.importorskip("alembic")
    sys_path_added = str(REPO_ROOT / "apps" / "demo" / "api")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from migrations.env import run_migrations_online

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", "postgresql+psycopg://mig:pw@remote.example.com:5432/db?sslmode=verify-ca")

    with pytest.raises(ValueError) as exc:
        run_migrations_online()
    assert "strictly requires sslmode=verify-full" in str(exc.value)


# ---------------------------------------------------------------------------
# 4. Local Containerized External PostgreSQL Simulator with Real TLS
# ---------------------------------------------------------------------------


def _is_docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        res = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return res.returncode == 0
    except Exception:
        return False


def _find_free_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def external_postgres_simulator():
    """
    Spins up a local PostgreSQL 16 container configured with real TLS certificates,
    multi-tenant databases, non-superuser roles, and least-privilege permissions,
    simulating an external cloud database service locally.
    """
    if not _is_docker_available():
        pytest.skip("Docker daemon not available for external postgres simulation")

    cname = f"megalith-ext-pg-sim-{int(time.time())}"
    port = str(_find_free_port())
    admin_pw = "super_admin_sim_pw_123"

    tmp_dir = tempfile.mkdtemp(prefix="megalith_tls_")
    try:
        ca_key = os.path.join(tmp_dir, "ca.key")
        ca_crt = os.path.join(tmp_dir, "ca.crt")
        wrong_ca_key = os.path.join(tmp_dir, "wrong_ca.key")
        wrong_ca_crt = os.path.join(tmp_dir, "wrong_ca.crt")
        srv_key = os.path.join(tmp_dir, "server.key")
        srv_csr = os.path.join(tmp_dir, "server.csr")
        srv_crt = os.path.join(tmp_dir, "server.crt")
        mismatched_key = os.path.join(tmp_dir, "mismatched.key")
        mismatched_csr = os.path.join(tmp_dir, "mismatched.csr")
        mismatched_crt = os.path.join(tmp_dir, "mismatched.crt")

        # 1. Generate Trusted CA
        subprocess.run(
            ["openssl", "req", "-new", "-x509", "-days", "1", "-nodes",
             "-out", ca_crt, "-keyout", ca_key, "-subj", "/CN=MegalithTestCA"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # 2. Generate Untrusted/Wrong CA for negative TLS testing
        subprocess.run(
            ["openssl", "req", "-new", "-x509", "-days", "1", "-nodes",
             "-out", wrong_ca_crt, "-keyout", wrong_ca_key, "-subj", "/CN=UntrustedRogueCA"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # 3. Generate Valid Server Cert signed by Trusted CA (CN=localhost, SAN=localhost, 127.0.0.1)
        subprocess.run(
            ["openssl", "req", "-new", "-nodes", "-out", srv_csr, "-keyout", srv_key, "-subj", "/CN=localhost"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        extfile = os.path.join(tmp_dir, "ext.cnf")
        with open(extfile, "w", encoding="utf-8") as f:
            f.write("subjectAltName=DNS:localhost,IP:127.0.0.1\n")
        subprocess.run(
            ["openssl", "x509", "-req", "-in", srv_csr, "-CA", ca_crt, "-CAkey", ca_key,
             "-CAcreateserial", "-out", srv_crt, "-days", "1", "-extfile", extfile],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # 4. Generate Mismatched Server Cert signed by Trusted CA (CN=otherhost.megalith.internal)
        subprocess.run(
            ["openssl", "req", "-new", "-nodes", "-out", mismatched_csr, "-keyout", mismatched_key, "-subj", "/CN=otherhost.megalith.internal"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        extfile_mis = os.path.join(tmp_dir, "ext_mis.cnf")
        with open(extfile_mis, "w", encoding="utf-8") as f:
            f.write("subjectAltName=DNS:otherhost.megalith.internal\n")
        subprocess.run(
            ["openssl", "x509", "-req", "-in", mismatched_csr, "-CA", ca_crt, "-CAkey", ca_key,
             "-CAcreateserial", "-out", mismatched_crt, "-days", "1", "-extfile", extfile_mis],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # 5. Start clean PostgreSQL container
        cmd = [
            "docker", "run", "--name", cname,
            "-e", f"POSTGRES_PASSWORD={admin_pw}",
            "-p", f"{port}:5432",
            "-d", "postgres:16-alpine",
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

        # Poll for container readiness
        ready = False
        for _ in range(25):
            res = subprocess.run(
                ["docker", "exec", cname, "pg_isready", "-U", "postgres"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
            if res.returncode == 0:
                ready = True
                break
            time.sleep(0.5)

        if not ready:
            pytest.fail("Simulator container failed to start")

        # Install TLS certs into container
        subprocess.run(["docker", "cp", srv_crt, f"{cname}:/var/lib/postgresql/server.crt"], check=True)
        subprocess.run(["docker", "cp", srv_key, f"{cname}:/var/lib/postgresql/server.key"], check=True)
        subprocess.run(["docker", "cp", mismatched_crt, f"{cname}:/var/lib/postgresql/mismatched.crt"], check=True)
        subprocess.run(["docker", "cp", mismatched_key, f"{cname}:/var/lib/postgresql/mismatched.key"], check=True)
        subprocess.run(["docker", "exec", cname, "chown", "postgres:postgres",
                        "/var/lib/postgresql/server.crt", "/var/lib/postgresql/server.key",
                        "/var/lib/postgresql/mismatched.crt", "/var/lib/postgresql/mismatched.key"], check=True)
        subprocess.run(["docker", "exec", cname, "chmod", "600",
                        "/var/lib/postgresql/server.key", "/var/lib/postgresql/mismatched.key"], check=True)

        # Enable SSL with valid server.crt
        ssl_setup = "\n".join([
            "ALTER SYSTEM SET ssl = 'on';",
            "ALTER SYSTEM SET ssl_cert_file = '/var/lib/postgresql/server.crt';",
            "ALTER SYSTEM SET ssl_key_file = '/var/lib/postgresql/server.key';",
            "SELECT pg_reload_conf();",
        ])
        subprocess.run(["docker", "exec", "-i", cname, "psql", "-U", "postgres"], input=ssl_setup.encode(), check=True, capture_output=True)
        time.sleep(1)

        # Set up simulated multi-tenant databases and roles
        setup_sql = """
        CREATE DATABASE db_external_app1;
        CREATE DATABASE db_external_app2;

        CREATE ROLE role_ext_migrate WITH LOGIN PASSWORD 'mig_pw_456' NOSUPERUSER NOCREATEDB;
        CREATE ROLE role_ext_app WITH LOGIN PASSWORD 'app_pw_789' NOSUPERUSER NOCREATEDB;
        CREATE ROLE role_app2_user WITH LOGIN PASSWORD 'app2_pw_000' NOSUPERUSER NOCREATEDB;

        REVOKE CONNECT ON DATABASE db_external_app1 FROM PUBLIC;
        GRANT CONNECT ON DATABASE db_external_app1 TO role_ext_migrate, role_ext_app;

        REVOKE CONNECT ON DATABASE db_external_app2 FROM PUBLIC;
        GRANT CONNECT ON DATABASE db_external_app2 TO role_app2_user;
        """
        subprocess.run(["docker", "exec", "-i", cname, "psql", "-U", "postgres"], input=setup_sql.encode(), check=True, capture_output=True)

        # Configure permissions on db_external_app1
        app1_sql = """
        ALTER SCHEMA public OWNER TO role_ext_migrate;
        GRANT USAGE, CREATE ON SCHEMA public TO role_ext_migrate;
        GRANT USAGE ON SCHEMA public TO role_ext_app;
        ALTER DEFAULT PRIVILEGES FOR ROLE role_ext_migrate IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO role_ext_app;
        ALTER DEFAULT PRIVILEGES FOR ROLE role_ext_migrate IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO role_ext_app;
        """
        subprocess.run(["docker", "exec", "-i", cname, "psql", "-U", "postgres", "-d", "db_external_app1"], input=app1_sql.encode(), check=True, capture_output=True)

        def switch_cert(cert_file: str, key_file: str):
            q = f"ALTER SYSTEM SET ssl_cert_file = '/var/lib/postgresql/{cert_file}'; ALTER SYSTEM SET ssl_key_file = '/var/lib/postgresql/{key_file}'; SELECT pg_reload_conf();"
            subprocess.run(["docker", "exec", "-i", cname, "psql", "-U", "postgres"], input=q.encode(), check=True, capture_output=True)
            time.sleep(0.5)

        yield {
            "container": cname,
            "port": port,
            "ca_crt": ca_crt,
            "wrong_ca_crt": wrong_ca_crt,
            "tls_migrate_url": f"postgresql+psycopg://role_ext_migrate:mig_pw_456@localhost:{port}/db_external_app1?sslmode=verify-full&sslrootcert={ca_crt}",
            "tls_app_url": f"postgresql+psycopg://role_ext_app:app_pw_789@localhost:{port}/db_external_app1?sslmode=verify-full&sslrootcert={ca_crt}",
            "untrusted_tls_url": f"postgresql+psycopg://role_ext_app:app_pw_789@localhost:{port}/db_external_app1?sslmode=verify-full&sslrootcert={wrong_ca_crt}",
            "verify_ca_url": f"postgresql+psycopg://role_ext_app:app_pw_789@localhost:{port}/db_external_app1?sslmode=verify-ca&sslrootcert={ca_crt}",
            "app2_url_as_app1": f"postgresql+psycopg://role_ext_app:app_pw_789@localhost:{port}/db_external_app2?sslmode=verify-full&sslrootcert={ca_crt}",
            "raw_migrate_url": f"postgresql://role_ext_migrate:mig_pw_456@localhost:{port}/db_external_app1",
            "switch_cert": switch_cert,
        }
    finally:
        subprocess.run(["docker", "rm", "-f", cname], check=False, stdout=subprocess.DEVNULL)
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# 5. Real End-to-End TLS Handshake Verification
# ---------------------------------------------------------------------------


def test_tls_connection_succeeds_with_trusted_ca(external_postgres_simulator):
    """Verify actual TLS connection succeeds when CA certificate matches server certificate."""
    engine = create_engine(
        external_postgres_simulator["tls_app_url"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5},
    )
    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1;")).scalar()
        assert val == 1
    engine.dispose()


def test_tls_connection_fails_with_untrusted_ca(external_postgres_simulator):
    """Verify actual TLS connection is strictly rejected when an untrusted/wrong CA is provided."""
    engine = create_engine(
        external_postgres_simulator["untrusted_tls_url"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5},
    )
    with pytest.raises(DBAPIError) as exc_info:
        with engine.connect():
            pass

    err_str = str(exc_info.value).lower()
    assert "certificate verify failed" in err_str or "ssl" in err_str or "tls" in err_str
    engine.dispose()


def test_tls_connection_fails_on_hostname_mismatch(external_postgres_simulator):
    """
    Verify hostname matching validation:
    When a server presents a cert signed by trusted CA but issued to a different hostname,
    sslmode=verify-full strictly rejects the connection, while sslmode=verify-ca would unsafely accept it.
    """
    # Switch server to certificate issued for otherhost.megalith.internal
    external_postgres_simulator["switch_cert"]("mismatched.crt", "mismatched.key")

    try:
        # 1. sslmode=verify-full connects to localhost -> MUST FAIL hostname matching
        full_engine = create_engine(
            external_postgres_simulator["tls_app_url"],
            poolclass=NullPool,
            connect_args={"connect_timeout": 5},
        )
        with pytest.raises(DBAPIError) as exc_info:
            with full_engine.connect():
                pass

        err_str = str(exc_info.value).lower()
        assert "does not match host name" in err_str or "certificate verify failed" in err_str or "hostname" in err_str
        full_engine.dispose()

        # 2. sslmode=verify-ca connects to localhost -> accepts because CA signature is valid (proves vulnerability of verify-ca)
        ca_engine = create_engine(
            external_postgres_simulator["verify_ca_url"],
            poolclass=NullPool,
            connect_args={"connect_timeout": 5},
        )
        with ca_engine.connect() as conn:
            assert conn.execute(text("SELECT 1;")).scalar() == 1
        ca_engine.dispose()

    finally:
        # Restore valid certificate
        external_postgres_simulator["switch_cert"]("server.crt", "server.key")


# ---------------------------------------------------------------------------
# 6. Least-Privilege Role Isolation & Multi-Tenancy Tests
# ---------------------------------------------------------------------------


def test_non_superuser_migration_and_runtime_ddl_denial(external_postgres_simulator):
    """Verify non-superuser migration role can create tables and runtime role is denied DDL."""
    # 1. Migration role creates application table
    migrate_engine = create_engine(
        external_postgres_simulator["tls_migrate_url"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5, "prepare_threshold": None},
    )
    with migrate_engine.connect() as conn:
        is_super = conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = 'role_ext_migrate';")).scalar()
        assert is_super is False

        conn.execute(text("CREATE TABLE counter (id int PRIMARY KEY, value int NOT NULL DEFAULT 0);"))
        conn.execute(text("INSERT INTO counter (id, value) VALUES (1, 10);"))
        conn.commit()
    migrate_engine.dispose()

    # 2. Runtime role executes DML successfully
    app_engine = create_engine(
        external_postgres_simulator["tls_app_url"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5, "prepare_threshold": None},
    )
    with app_engine.connect() as conn:
        val = conn.execute(text("SELECT value FROM counter WHERE id = 1;")).scalar()
        assert val == 10

        conn.execute(text("UPDATE counter SET value = value + 1 WHERE id = 1;"))
        conn.commit()

        updated = conn.execute(text("SELECT value FROM counter WHERE id = 1;")).scalar()
        assert updated == 11

        # 3. Runtime role is DENIED DDL (DROP TABLE)
        with pytest.raises(DBAPIError) as ddl_err:
            conn.execute(text("DROP TABLE counter;"))
        assert "permission denied" in str(ddl_err.value).lower() or "must be owner" in str(ddl_err.value).lower()
        conn.rollback()

    app_engine.dispose()


def test_cross_application_access_denied(external_postgres_simulator):
    """Verify that credentials from App1 cannot connect to App2's database."""
    app2_engine = create_engine(
        external_postgres_simulator["app2_url_as_app1"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5},
    )
    with pytest.raises(DBAPIError) as exc_info:
        with app2_engine.connect():
            pass

    err_str = str(exc_info.value).lower()
    assert "permission denied" in err_str or "fatala" in err_str or "access" in err_str or "privilege" in err_str
    app2_engine.dispose()


# ---------------------------------------------------------------------------
# 7. Driver Compatibility & Disaster Recovery
# ---------------------------------------------------------------------------


def test_connection_pool_driver_compatibility(external_postgres_simulator):
    """Verify driver executes multiple queries with prepare_threshold=None without caching prepared statements."""
    engine = create_engine(
        external_postgres_simulator["tls_app_url"],
        poolclass=NullPool,
        connect_args={"connect_timeout": 5, "prepare_threshold": None},
    )
    with engine.connect() as conn:
        for i in range(10):
            res = conn.execute(text("SELECT :v AS val;"), {"v": i}).scalar()
            assert res == i
    engine.dispose()


def test_external_encrypted_backup_and_restore(external_postgres_simulator, tmp_path):
    """Verify backup.py and restore.py work directly against external connection URLs."""
    if not shutil.which("age-keygen") or not shutil.which("age"):
        pytest.skip("age and age-keygen are required for this test")
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "postgres")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from backup import create_encrypted_backup, generate_keypair, verify_backup_integrity
    from restore import restore_encrypted_backup

    # Generate test age key
    key_file = tmp_path / "test_identity.txt"
    recipient, _ = generate_keypair(key_file)

    # 1. Take encrypted backup using external connection URL
    cipher_path = create_encrypted_backup(
        recipient=recipient,
        output_dir=tmp_path / "backups",
        connection_url=external_postgres_simulator["raw_migrate_url"],
    )
    assert cipher_path.is_file()
    assert cipher_path.suffix == ".age"

    # 2. Verify backup manifest integrity
    meta = verify_backup_integrity(cipher_path)
    assert meta["database"] == "db_external_app1"
    assert meta["encryption_tool"] == "age"

    # 3. Restore into a fresh clean database
    cname = external_postgres_simulator["container"]
    subprocess.run(["docker", "exec", cname, "psql", "-U", "postgres", "-c", "CREATE DATABASE db_restore_target;"], check=True)
    subprocess.run(["docker", "exec", cname, "psql", "-U", "postgres", "-c", "GRANT ALL ON DATABASE db_restore_target TO role_ext_migrate;"], check=True)
    subprocess.run(["docker", "exec", cname, "psql", "-U", "postgres", "-d", "db_restore_target", "-c", "ALTER SCHEMA public OWNER TO role_ext_migrate; GRANT ALL ON SCHEMA public TO role_ext_migrate;"], check=True)

    restore_url = f"postgresql://role_ext_migrate:mig_pw_456@localhost:{external_postgres_simulator['port']}/db_restore_target"
    ok = restore_encrypted_backup(
        backup_file=cipher_path,
        identity_file=key_file,
        connection_url=restore_url,
    )
    assert ok is True

    # 4. Verify data in restored database
    restore_engine = create_engine(
        f"postgresql+psycopg://role_ext_migrate:mig_pw_456@localhost:{external_postgres_simulator['port']}/db_restore_target",
        poolclass=NullPool,
    )
    with restore_engine.connect() as conn:
        val = conn.execute(text("SELECT value FROM counter WHERE id = 1;")).scalar()
        assert val == 11
    restore_engine.dispose()


# ---------------------------------------------------------------------------
# 8. Secret Redaction Across All Error Paths
# ---------------------------------------------------------------------------


def test_secret_redaction_across_all_failure_modes(monkeypatch, tmp_path):
    """Verify that database passwords are never leaked in error messages, exception strings, or output."""
    sys_path_added = str(REPO_ROOT / "platform" / "deploy" / "scripts")
    import sys
    if sys_path_added not in sys.path:
        sys.path.insert(0, sys_path_added)

    from deploy import Deployer, DeploymentExecutionError

    secret_pw = "TOP_SECRET_PASSWORD_ALPHA_123"

    # 1. Insecure sslmode in production
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://app:{secret_pw}@db.example.com:5432/db?sslmode=disable")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", f"postgresql+psycopg://mig:{secret_pw}@db.example.com:5432/db?sslmode=disable")
    with pytest.raises(DeploymentExecutionError) as exc1:
        Deployer(compose_files=[COMPOSE_BASE], database_mode="external", environment="production", state_dir=tmp_path)
    assert secret_pw not in str(exc1.value)
    assert "***" in str(exc1.value)

    # 2. Hostname loopback in production
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://app:{secret_pw}@localhost:5432/db?sslmode=verify-full")
    monkeypatch.setenv("DATABASE_MIGRATE_URL", f"postgresql+psycopg://mig:{secret_pw}@localhost:5432/db?sslmode=verify-full")
    with pytest.raises(DeploymentExecutionError) as exc2:
        Deployer(compose_files=[COMPOSE_BASE], database_mode="external", environment="production", state_dir=tmp_path)
    assert secret_pw not in str(exc2.value)

    # 3. Reachability probe failure
    unreachable_app = f"postgresql+psycopg://app:{secret_pw}@127.0.0.1:54398/db?sslmode=require"
    unreachable_mig = f"postgresql+psycopg://mig:{secret_pw}@127.0.0.1:54398/db?sslmode=require"
    monkeypatch.setenv("DATABASE_URL", unreachable_app)
    monkeypatch.setenv("DATABASE_MIGRATE_URL", unreachable_mig)
    d = Deployer(compose_files=[COMPOSE_BASE], database_mode="external", environment="staging", state_dir=tmp_path)
    with pytest.raises(DeploymentExecutionError) as exc3:
        d.verify_database_reachability(timeout_sec=1)
    assert secret_pw not in str(exc3.value)
    assert "***" in str(exc3.value)

