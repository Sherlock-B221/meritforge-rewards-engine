import pytest
from sqlalchemy import select
from app.models import User
from app.constants.enums import UserRole

@pytest.mark.asyncio
async def test_create_user_defaults_to_user_role(db_session):
    user = User(username="ria", email="ria@example.com", password_hash="x")
    db_session.add(user)
    await db_session.commit()
    fetched = (await db_session.execute(select(User).where(User.username == "ria"))).scalar_one()
    assert fetched.role == UserRole.USER
    assert fetched.id is not None
    assert fetched.created_at is not None
