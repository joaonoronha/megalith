import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from src.db import Base

# Alembic Config object (available when invoked via Alembic runner)
try:
    config = context.config
except (NameError, AttributeError):
    config = None

if config is not None and config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate support
target_metadata = Base.metadata


def get_url() -> str:
    """
    Retrieves migration database connection URL with migration role credentials.
    Strictly requires DATABASE_MIGRATE_URL. Implicit fallback to application runtime
    credentials (DATABASE_URL) is prohibited to prevent running DDL with runtime roles.
    """
    migrate_url = os.environ.get("DATABASE_MIGRATE_URL")
    if not migrate_url:
        raise RuntimeError(
            "DATABASE_MIGRATE_URL environment variable is required to execute Alembic migrations. "
            "Implicit fallback to application runtime credentials (DATABASE_URL) is prohibited."
        )
    return migrate_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    target_url = get_url()
    env_name = os.environ.get("ENVIRONMENT", os.environ.get("MEGALITH_ENV", "development")).lower()
    if env_name == "production":
        from pathlib import Path

        from sqlalchemy.engine import make_url

        u = make_url(target_url)
        if u.host in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "postgres"):
            raise ValueError(f"Production migration connection cannot target local/internal host '{u.host}'.")
        sslmode = u.query.get("sslmode")
        if sslmode != "verify-full":
            safe_str = u.render_as_string(hide_password=True)
            raise ValueError(
                f"External production migration connection strictly requires sslmode=verify-full (got '{sslmode or 'missing'}'): {safe_str}"
            )
        sslrootcert = u.query.get("sslrootcert")
        if sslrootcert and not Path(sslrootcert).exists():
            raise ValueError(f"DATABASE_MIGRATE_URL specifies sslrootcert='{sslrootcert}' which does not exist on disk.")

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = target_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={
            "connect_timeout": int(os.environ.get("DB_CONNECT_TIMEOUT", "10")),
            "prepare_threshold": None,
        },
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if config is not None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
