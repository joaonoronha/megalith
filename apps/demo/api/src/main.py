"""
FastAPI application for Megalith Demo API service.

Provides health, readiness, and persistent counter endpoints.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from src import db

logger = logging.getLogger("demo_api")


class HealthResponse(BaseModel):
    """Liveness probe response model."""

    status: str = Field(default="ok", description="Process liveness status")
    service: str = Field(default="demo/api", description="Service identifier")


class ReadyResponse(BaseModel):
    """Readiness probe response model."""

    status: str = Field(default="ready", description="Application readiness status")
    service: str = Field(default="demo/api", description="Service identifier")
    database: str = Field(default="connected", description="Database connectivity status")


class MessageResponse(BaseModel):
    """Structured message response model."""

    message: str = Field(..., description="Message payload")
    service: str = Field(default="demo/api", description="Service identifier")


class CounterResponse(BaseModel):
    """Persistent counter response model."""

    value: int = Field(..., description="Current persisted counter value")


app = FastAPI(
    title="Megalith Demo API",
    description="Minimal FastAPI backend service with persistent PostgreSQL integration",
    version="0.2.0",
)

# Enable CORS for local development across Vite dev server ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """
    Liveness probe: verifies process responsiveness.
    Does NOT query PostgreSQL, ensuring container survives temporary database outages.
    """
    return HealthResponse(status="ok", service="demo/api")


@app.get("/ready", response_model=ReadyResponse)
def get_ready():
    """
    Readiness probe: verifies database connectivity and schema readiness.
    Returns HTTP 200 when ready, HTTP 503 when database or schema is unavailable.
    """
    is_ready, message = db.check_readiness()
    if not is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "service": "demo/api",
                "error": message,
            },
        )
    return ReadyResponse(status="ready", service="demo/api", database="connected")


@app.get("/api/message", response_model=MessageResponse)
def get_message() -> MessageResponse:
    """Returns a structured message proving frontend-to-backend communication."""
    return MessageResponse(
        message="Hello from Megalith API",
        service="demo/api",
    )


@app.get("/api/counter", response_model=CounterResponse)
def get_counter():
    """Returns the current persistent counter value from PostgreSQL."""
    try:
        val = db.get_counter_value()
        if val is None:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"error": "Database unavailable", "service": "demo/api"},
            )
        return CounterResponse(value=val)
    except (SQLAlchemyError, OSError) as exc:
        logger.error("Failed to read counter: %s", type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "Database unavailable", "service": "demo/api"},
        )


@app.post("/api/counter/increment", response_model=CounterResponse)
def increment_counter():
    """Atomically increments the counter value in PostgreSQL and returns the new value."""
    try:
        new_val = db.increment_counter_atomic()
        return CounterResponse(value=new_val)
    except (SQLAlchemyError, OSError) as exc:
        logger.error("Failed to increment counter: %s", type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "Database unavailable", "service": "demo/api"},
        )
