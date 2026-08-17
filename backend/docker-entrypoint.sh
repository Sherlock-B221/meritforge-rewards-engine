#!/bin/sh
# Baked into the image as the default CMD so hosts whose deploy-command
# override doesn't reliably parse shell operators (e.g. Render's
# dockerCommand — see render.yaml) never need to express "migrate then
# serve" as a single `&&`-joined string. docker-compose.yml overrides
# `command:` directly and never reaches this file.
set -e

uv run alembic upgrade head
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
