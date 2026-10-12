[project]
name = "{{PRODUCT_ID}}-{{SERVICE_ID}}"
version = "0.1.0"
description = "FastAPI service for {{PRODUCT_ID}}"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.28.0",
{{EXTRA_DEPENDENCIES}}]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",
    "ruff>=0.3.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]
