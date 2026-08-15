import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from app.core.errors import AppError, register_error_handlers
from app.core.exceptions import NotFoundError


@pytest.mark.asyncio
async def test_app_error_renders_envelope():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    async def boom():
        raise NotFoundError("post", "abc")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        resp = await c.get("/boom")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "POST_NOT_FOUND"
    assert body["error"]["details"] == {"id": "abc"}
