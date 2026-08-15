import pytest
from app.schemas.auth import RegisterRequest, LoginRequest
from app.services.auth import auth_service
from app.core.exceptions import ConflictError, UnauthorizedError

@pytest.mark.asyncio
async def test_register_then_login(db_session):
    reg = await auth_service.register(db_session, RegisterRequest(username="ria", email="r@e.com", password="pw123456"))
    assert reg.token and reg.user.username == "ria" and reg.user.role.value == "user"
    login = await auth_service.authenticate(db_session, LoginRequest(username="ria", password="pw123456"))
    assert login.token

@pytest.mark.asyncio
async def test_duplicate_username_conflicts(db_session):
    await auth_service.register(db_session, RegisterRequest(username="ria", email="r@e.com", password="pw123456"))
    with pytest.raises(ConflictError):
        await auth_service.register(db_session, RegisterRequest(username="ria", email="other@e.com", password="pw123456"))

@pytest.mark.asyncio
async def test_wrong_password_unauthorized(db_session):
    await auth_service.register(db_session, RegisterRequest(username="ria", email="r@e.com", password="pw123456"))
    with pytest.raises(UnauthorizedError):
        await auth_service.authenticate(db_session, LoginRequest(username="ria", password="nope"))
