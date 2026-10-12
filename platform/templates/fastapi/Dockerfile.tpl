FROM python:3.12-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5.24 /uv /bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml README.md ./
COPY src ./src
RUN uv pip install --system --no-cache .

FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/false -d /app appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=appuser:appgroup src /app/src
{{ALEMBIC_DOCKER_COPY}}

USER appuser

EXPOSE {{PORT}}

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:{{PORT}}/health').read()"]

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "{{PORT}}"]
