import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from app.main import create_app
from app.config import get_settings
from app.core.db import get_session
from app.models.base import Base
import app.models  # noqa: F401  (import all models so metadata is populated)

@pytest_asyncio.fixture
async def db_engine():
    url = get_settings().test_database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    eng = create_async_engine(url)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()

@pytest_asyncio.fixture
async def db_session(db_engine):
    maker = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as session:
        yield session

@pytest_asyncio.fixture
async def async_client(db_session):
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def user(db_session):
    from app.models import User

    u = User(username="ria", email="ria@example.com", password_hash="x")
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def other_user(db_session):
    from app.models import User

    u = User(username="sam", email="sam@example.com", password_hash="x")
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u
