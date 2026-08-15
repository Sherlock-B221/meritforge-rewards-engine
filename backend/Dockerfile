# meritforge backend — Python 3.12 + uv.
# Venv is placed at /opt/venv (OUTSIDE /app) so a dev bind-mount of ./backend:/app
# in docker-compose does not shadow the installed dependencies.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Pinned uv for fast, reproducible installs (no floating versions).
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv

WORKDIR /app

# Dependency layer — cached unless pyproject/lock change. `--no-install-project`
# installs deps only (the app itself is not a distributable package; see
# `[tool.uv] package = false` in pyproject.toml).
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-install-project

# Application source (overlaid by the bind-mount in dev; baked in for prod).
COPY . .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
