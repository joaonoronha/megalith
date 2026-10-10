"""
FastAPI application for Megalith Demo API service.
Service scope: demo/api
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(default="ok", description="Service health status")
    service: str = Field(default="demo/api", description="Service identifier")


class MessageResponse(BaseModel):
    """Structured message response model."""

    message: str = Field(..., description="Message payload")
    service: str = Field(default="demo/api", description="Service identifier")


app = FastAPI(
    title="Megalith Demo API",
    description="Minimal FastAPI backend service demonstrating polyglot monorepo communication",
    version="0.1.0",
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
    """Returns the operational health status and service identifier."""
    return HealthResponse(status="ok", service="demo/api")


@app.get("/api/message", response_model=MessageResponse)
def get_message() -> MessageResponse:
    """Returns a structured message proving frontend-to-backend communication."""
    return MessageResponse(
        message="Hello from Megalith API",
        service="demo/api",
    )
