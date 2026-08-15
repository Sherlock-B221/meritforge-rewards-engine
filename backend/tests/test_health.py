import pytest

@pytest.mark.asyncio
async def test_health_ok(async_client):
    resp = await async_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
