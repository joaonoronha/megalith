#!/bin/bash
set -e

# Idempotent PostgreSQL initialization script for {{PRODUCT_ID}} product database
# Runs automatically on first container startup when the data volume is empty.

DB_NAME="${{PRODUCT_ID_UPPER}}_DB_NAME:-db_{{PRODUCT_ID}}}"
DB_MIGRATE_USER="${{PRODUCT_ID_UPPER}}_DB_MIGRATE_USER:-role_{{PRODUCT_ID}}_migrate}"
DB_MIGRATE_PASSWORD="${{PRODUCT_ID_UPPER}}_DB_MIGRATE_PASSWORD:-{{PRODUCT_ID}}_migrate_dev_password}"
DB_APP_USER="${{PRODUCT_ID_UPPER}}_DB_APP_USER:-role_{{PRODUCT_ID}}_app}"
DB_APP_PASSWORD="${{PRODUCT_ID_UPPER}}_DB_APP_PASSWORD:-{{PRODUCT_ID}}_app_dev_password}"

echo "==> [PostgreSQL Init] Initializing {{PRODUCT_ID}} product database and roles..."

# 1. Provision Roles
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Migration Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_MIGRATE_USER}') THEN
            CREATE ROLE ${DB_MIGRATE_USER} WITH LOGIN PASSWORD '${DB_MIGRATE_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE ${DB_MIGRATE_USER} WITH PASSWORD '${DB_MIGRATE_PASSWORD}';
        END IF;
    END
    \$\$;

    -- Create Application Runtime Role if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_APP_USER}') THEN
            CREATE ROLE ${DB_APP_USER} WITH LOGIN PASSWORD '${DB_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        ELSE
            ALTER ROLE ${DB_APP_USER} WITH PASSWORD '${DB_APP_PASSWORD}';
        END IF;
    END
    \$\$;

    -- Create product database
    SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_MIGRATE_USER}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

    -- Restrict default connection rights
    REVOKE CONNECT ON DATABASE ${DB_NAME} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_MIGRATE_USER};
    GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_APP_USER};
EOSQL

# 2. Configure Product Database Schemas and Granular Privileges
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" <<-EOSQL
    -- Ensure schema public is owned by migration role
    ALTER SCHEMA public OWNER TO ${DB_MIGRATE_USER};
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO ${DB_MIGRATE_USER};

    -- Grant usage to application role
    GRANT USAGE ON SCHEMA public TO ${DB_APP_USER};

    -- Set default privileges for tables created by the migration role
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_MIGRATE_USER} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_APP_USER};

    -- Set default privileges for sequences
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_MIGRATE_USER} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${DB_APP_USER};
EOSQL

echo "==> [PostgreSQL Init] Database ${DB_NAME} and isolated roles successfully provisioned."
