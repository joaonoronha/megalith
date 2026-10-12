#!/bin/bash
set -e

# Idempotent PostgreSQL initialization script for {{PRODUCT_ID}} product database (ADR-007)
# Runs automatically on first container startup when the data volume is empty,
# or manually via 'megalith product db-init {{PRODUCT_ID}}'.

DB_NAME="${{{PRODUCT_ID_UPPER}}_DB_NAME:-{{DB_NAME}}}"
DB_MIGRATE_USER="${{{PRODUCT_ID_UPPER}}_DB_MIGRATE_USER:-{{DB_MIGRATE_USER}}}"
DB_MIGRATE_PASSWORD="${{{PRODUCT_ID_UPPER}}_DB_MIGRATE_PASSWORD:-{{DB_MIGRATE_PASSWORD}}}"
DB_APP_USER="${{{PRODUCT_ID_UPPER}}_DB_APP_USER:-{{DB_APP_USER}}}"
DB_APP_PASSWORD="${{{PRODUCT_ID_UPPER}}_DB_APP_PASSWORD:-{{DB_APP_PASSWORD}}}"

echo "==> [PostgreSQL Init] Initializing {{PRODUCT_ID}} product database and roles..."

# 1. Provision Roles and Product Database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Migration Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_MIGRATE_USER}') THEN
            EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', '${DB_MIGRATE_USER}', '${DB_MIGRATE_PASSWORD}');
        ELSE
            EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${DB_MIGRATE_USER}', '${DB_MIGRATE_PASSWORD}');
        END IF;
    END
    \$\$;

    -- Create Application Runtime Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_APP_USER}') THEN
            EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', '${DB_APP_USER}', '${DB_APP_PASSWORD}');
        ELSE
            EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${DB_APP_USER}', '${DB_APP_PASSWORD}');
        END IF;
    END
    \$\$;

    -- Create product database if not exists
    SELECT format('CREATE DATABASE %I OWNER %I', '${DB_NAME}', '${DB_MIGRATE_USER}')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

    -- Restrict default connection rights
    DO \$\$
    BEGIN
        EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', '${DB_NAME}');
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I, %I', '${DB_NAME}', '${DB_MIGRATE_USER}', '${DB_APP_USER}');
    END
    \$\$;
EOSQL

# 2. Configure Product Database Schemas and Granular Privileges
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" <<-EOSQL
    DO \$\$
    BEGIN
        -- Ensure schema public is owned by migration role
        EXECUTE format('ALTER SCHEMA public OWNER TO %I', '${DB_MIGRATE_USER}');
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
        EXECUTE format('GRANT ALL ON SCHEMA public TO %I', '${DB_MIGRATE_USER}');

        -- Grant usage to application role
        EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', '${DB_APP_USER}');

        -- Set default privileges for tables created by the migration role
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', '${DB_MIGRATE_USER}', '${DB_APP_USER}');

        -- Set default privileges for sequences
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', '${DB_MIGRATE_USER}', '${DB_APP_USER}');
    END
    \$\$;
EOSQL

echo "==> [PostgreSQL Init] Database ${DB_NAME} and isolated roles successfully provisioned."
