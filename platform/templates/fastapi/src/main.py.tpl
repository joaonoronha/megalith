"""
{{PRODUCT_NAME}} - {{SERVICE_ID}} service.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI

app = FastAPI(
    title="{{PRODUCT_NAME}} {{SERVICE_ID}}",
    description="Service for {{PRODUCT_ID}}",
    version="0.1.0",
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "{{PRODUCT_ID}}-{{SERVICE_ID}}"}


@app.get("/ready")
def readiness() -> Dict[str, Any]:
    return {"ready": True, "service": "{{PRODUCT_ID}}-{{SERVICE_ID}}"}


@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "message": "Welcome to {{PRODUCT_NAME}} ({{SERVICE_ID}})",
        "service": "{{PRODUCT_ID}}-{{SERVICE_ID}}",
    }
