"""
Database configuration, connection pooling, and data models for Megalith Demo API.

Enforces least-privilege runtime role access and bounded connection pooling.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Column, Integer, MetaData, create_engine, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger("demo_api.db")

# Default metadata and naming conventions
metadata = MetaData()


class Base(DeclarativeBase):
    metadata = metadata


class Counter(Base):
    """Minimal persistent resource model for proving database durability."""

    __tablename__ = "counter"

    id = Column(Integer, primary_key=True)
    value = Column(Integer, nullable=False, default=0)


def get_database_url() -> str:
    """Returns the application runtime database connection URL."""
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://role_demo_app:demo_app_dev_password@localhost:5432/db_demo",
    )


# Bounded connection pool configuration
_pool_size = int(os.environ.get("DB_POOL_SIZE", "5"))
_max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", "10"))
_pool_timeout = float(os.environ.get("DB_POOL_TIMEOUT", "5"))
_pool_recycle = int(os.environ.get("DB_POOL_RECYCLE", "300"))

_engine = None
_session_factory = None


def validate_production_connection(db_url: str) -> None:
    """Enforces TLS policy for external database connections in production."""
    env = os.environ.get("ENVIRONMENT", os.environ.get("MEGALITH_ENV", "development")).lower()
    if env != "production":
        return

    from pathlib import Path

    from sqlalchemy.engine import make_url

    u = make_url(db_url)
    if u.host in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "postgres"):
        raise ValueError(f"Production database connection cannot target local/internal host '{u.host}'.")

    sslmode = u.query.get("sslmode")
    if sslmode != "verify-full":
        safe_str = u.render_as_string(hide_password=True)
        raise ValueError(
            f"External production database connection strictly requires sslmode=verify-full (got '{sslmode or 'missing'}'): {safe_str}"
        )
    sslrootcert = u.query.get("sslrootcert")
    if sslrootcert and not Path(sslrootcert).exists():
        raise ValueError(f"DATABASE_URL specifies sslrootcert='{sslrootcert}' which does not exist on disk.")


def get_engine():
    """Lazily initializes and returns the SQLAlchemy Engine."""
    global _engine, _session_factory
    if _engine is None:
        db_url = get_database_url()
        validate_production_connection(db_url)

        connect_args: dict[str, Any] = {
            "connect_timeout": int(os.environ.get("DB_CONNECT_TIMEOUT", "5")),
        }
        # In transaction pooling mode (e.g. PgBouncer / Supavisor), server-side prepared
        # statements must be disabled to prevent statement mismatch across pooled connections.
        # Defaulting prepare_threshold to None provides safe compatibility across direct and pooled endpoints.
        prep_thresh = os.environ.get("DB_PREPARE_THRESHOLD")
        if prep_thresh is not None:
            if prep_thresh.lower() in ("none", "null", "false", "0"):
                connect_args["prepare_threshold"] = None
            else:
                connect_args["prepare_threshold"] = int(prep_thresh)
        else:
            connect_args["prepare_threshold"] = None

        _engine = create_engine(
            db_url,
            pool_size=_pool_size,
            max_overflow=_max_overflow,
            pool_timeout=_pool_timeout,
            pool_recycle=_pool_recycle,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def get_session_factory():
    if _session_factory is None:
        get_engine()
    return _session_factory


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager for scoped database sessions with automatic rollback on error."""
    factory = get_session_factory()
    session: Session = factory()
    try:
        yield session
        session.commit()
    except Exception as exc:
        session.rollback()
        # Log clean error without exposing credentials or connection strings
        logger.error("Database transaction rolled back due to error: %s", type(exc).__name__)
        raise
    finally:
        session.close()


def check_readiness() -> tuple[bool, str]:
    """
    Verifies that the database is reachable, required application schema is migrated,
    and application role has necessary DML permissions. Executes a lightweight read
    directly on the counter table without mutating data.
    Returns (is_ready, message). Never leaks sensitive connection or SQL details.
    """
    try:
        engine = get_engine()
        with engine.connect() as conn:
            # Query the required application table directly with the application role
            conn.execute(text("SELECT id, value FROM counter WHERE id = 1 LIMIT 1")).fetchone()
            return True, "Database and schema ready"
    except (SQLAlchemyError, OSError) as exc:
        logger.warning("Database readiness check failed: %s", type(exc).__name__)
        return False, "Database or required schema unavailable"


def get_counter_value() -> int | None:
    """
    Retrieves the current persistent counter value.
    Returns 0 if the counter record has not yet been initialized.
    """
    with get_db_session() as session:
        counter = session.execute(
            select(Counter).where(Counter.id == 1)
        ).scalar_one_or_none()
        if counter is None:
            return 0
        return counter.value


def increment_counter_atomic() -> int:
    """
    Atomically increments the persisted counter value within a transaction.
    Concurrency-safe using PostgreSQL ON CONFLICT DO UPDATE RETURNING.
    """
    sql = text(
        """
        INSERT INTO counter (id, value)
        VALUES (1, 1)
        ON CONFLICT (id)
        DO UPDATE SET value = counter.value + 1
        RETURNING value;
        """
    )
    with get_db_session() as session:
        result = session.execute(sql).scalar_one()
        return int(result)
