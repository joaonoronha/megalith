#!/bin/bash
set -e

# Idempotent PostgreSQL initialization script for Megalith product databases
# Runs automatically on first container startup when the data volume is empty.

DEMO_DB_NAME="${DEMO_DB_NAME:-db_demo}"
DEMO_DB_MIGRATE_USER="${DEMO_DB_MIGRATE_USER:-role_demo_migrate}"
DEMO_DB_MIGRATE_PASSWORD="${DEMO_DB_MIGRATE_PASSWORD:-demo_migrate_dev_password}"
DEMO_DB_APP_USER="${DEMO_DB_APP_USER:-role_demo_app}"
DEMO_DB_APP_PASSWORD="${DEMO_DB_APP_PASSWORD:-demo_app_dev_password}"

echo "==> [PostgreSQL Init] Initializing Megalith product databases and roles..."

# 1. Provision Roles
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Migration Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DEMO_DB_MIGRATE_USER}') THEN
            CREATE ROLE ${DEMO_DB_MIGRATE_USER} WITH LOGIN PASSWORD '${DEMO_DB_MIGRATE_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE ${DEMO_DB_MIGRATE_USER} WITH PASSWORD '${DEMO_DB_MIGRATE_PASSWORD}';
        END IF;
    END
    \$\$;

    -- Create Application Runtime Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DEMO_DB_APP_USER}') THEN
            CREATE ROLE ${DEMO_DB_APP_USER} WITH LOGIN PASSWORD '${DEMO_DB_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE ${DEMO_DB_APP_USER} WITH PASSWORD '${DEMO_DB_APP_PASSWORD}';
        END IF;
    END
    \$\$;

    -- Create demo product database
    SELECT 'CREATE DATABASE ${DEMO_DB_NAME} OWNER ${DEMO_DB_MIGRATE_USER}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DEMO_DB_NAME}')\gexec

    -- Restrict default connection rights
    REVOKE CONNECT ON DATABASE ${DEMO_DB_NAME} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${DEMO_DB_NAME} TO ${DEMO_DB_MIGRATE_USER};
    GRANT CONNECT ON DATABASE ${DEMO_DB_NAME} TO ${DEMO_DB_APP_USER};

    -- Create a secondary test database to verify cross-product isolation (ADR-007)
    SELECT 'CREATE DATABASE db_isolation_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'db_isolation_test')\gexec
    REVOKE CONNECT ON DATABASE db_isolation_test FROM PUBLIC;
EOSQL

# 2. Configure Product Database Schemas and Granular Privileges
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DEMO_DB_NAME}" <<-EOSQL
    -- Ensure schema public is owned by migration role
    ALTER SCHEMA public OWNER TO ${DEMO_DB_MIGRATE_USER};
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO ${DEMO_DB_MIGRATE_USER};

    -- Grant usage to application role
    GRANT USAGE ON SCHEMA public TO ${DEMO_DB_APP_USER};

    -- Set default privileges for tables created by the migration role
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DEMO_DB_MIGRATE_USER} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DEMO_DB_APP_USER};

    -- Set default privileges for sequences
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DEMO_DB_MIGRATE_USER} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${DEMO_DB_APP_USER};
EOSQL

echo "==> [PostgreSQL Init] Database ${DEMO_DB_NAME} and isolated roles successfully provisioned."
