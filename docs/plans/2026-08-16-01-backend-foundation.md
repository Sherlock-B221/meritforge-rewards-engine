# P1 — Backend Foundation + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the meritforge backend monolith skeleton and a fully working, well-tested auth API (register / login / me, JWT, role-based).

**Architecture:** One FastAPI app, layered **controllers → services → models**, with parallel `schemas/`, `constants/`, `config/`, `core/`. Config is loaded from a committed `config/defaults.toml` overlaid by env vars. Errors flow through one `AppError` hierarchy into a single JSON envelope. Async SQLAlchemy 2.0 + asyncpg + Alembic. Auth is stateless JWT (HS256) with bcrypt password hashing.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2 + pydantic-settings (TOML source), PyJWT, bcrypt, pytest + pytest-asyncio + httpx, ruff. Dependency + venv management via `uv`.

**Spec:** `../../mind-map/` — this plan implements the foundation for `01-backend-requirements.md` §1 (auth/roles), the error envelope in `02-api-contract.md`, and the structure in `08-backend-structure.md`. Read those alongside this plan.

## Global Constraints

- **Stack is fixed** — Python + FastAPI + PostgreSQL. Do not substitute.
- **Pin exact dependency versions** (no `^`/`~`/`>=` floats). Verify the current stable of each at scaffold time and pin it.
- **Layering is mandatory** — controllers stay thin (validate → call service → shape response); ALL business logic lives in `services/`; only `models/` touches the DB. Never leak ORM objects past a controller (convert to a `schemas/` model).
- **Constants & types are never inlined** — enums/strings in `app/constants/`, Pydantic types in `app/schemas/`.
- **Config-driven** — tunables come from `app/config/defaults.toml` + env overrides; secrets (`JWT_SECRET`, `DATABASE_URL`) are env-only and appear in `.env.example`.
- **Error envelope (exact shape):** `{"error": {"code": "STRING", "message": "STRING", "details": {}}}`.
- **All timestamps UTC**, timezone-aware.
- **Commit after every task** (incremental history is graded).
- **Never commit secrets**; `.env` is already gitignored.
- **Docker-only** — Postgres and all backend tooling run in Docker (see below). No host-installed Postgres/Python required.

## Running commands (Docker-only)

Infra + tooling run through Docker. Bring Postgres up once, then run backend tooling in the `backend` container:

| Purpose | Command |
| --- | --- |
| Start Postgres (main + test DBs) | `docker compose up -d db` |
| Full test suite | `docker compose run --rm backend uv run pytest -v` |
| One test | `docker compose run --rm backend uv run pytest tests/test_x.py::test_y -v` |
| Migrations | `docker compose run --rm backend uv run alembic upgrade head` |
| Lint | `docker compose run --rm backend uv run ruff check app tests` |
| Serve API (reload) | `docker compose up backend` → `http://localhost:8000/api/health` |

> The task steps below write `uv run pytest …` for brevity. **Prefix each with
> `docker compose run --rm backend `** to run it Docker-only. (Running host `uv` against the
> Dockerized DB works too and is faster for tight TDD loops — your choice; the graded artifact is
> Dockerized either way.)

---

### Task 0: Local Docker infra (Postgres)

**Files:** (already created alongside this plan — committed pre-P1)
- `docker-compose.yml`, `backend/Dockerfile`, `backend/.dockerignore`, `docker/postgres/initdb/01-create-test-db.sql`

**Interfaces:**
- Produces: a `db` service (`postgres:16-alpine`) exposing the `meritforge` and `meritforge_test` databases on `localhost:5432`; a `backend` service that builds from `backend/Dockerfile` and runs uvicorn with the source bind-mounted (venv at `/opt/venv`, unshadowed). Env: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`.
- Consumes: nothing.

- [ ] **Step 1:** `docker compose up -d db` — wait until healthy (`docker compose ps` shows `healthy`).
- [ ] **Step 2:** Verify both databases exist: `docker compose exec db psql -U meritforge -c "\l"` lists `meritforge` and `meritforge_test`.
- [ ] **Step 3:** (Runs after Task 1 creates `pyproject.toml`.) Build the tooling image on first use: `docker compose run --rm backend uv --version` succeeds. No commit needed — infra was committed pre-P1.

---

### Task 1: Backend scaffold + health check + test harness

**Files:**
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/controllers/__init__.py`, `backend/app/controllers/health_controller.py`, `backend/.env.example`
- Test: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces: `create_app() -> FastAPI` (in `app/main.py`); a mounted `APIRouter(prefix="/api")`; `GET /api/health → 200 {"status": "ok"}`; a pytest fixture `async_client` yielding an `httpx.AsyncClient` bound to the app.
- Consumes: nothing.

- [ ] **Step 1: Write `pyproject.toml`** with pinned deps (verify current stable versions, then pin exact — no floats):

```toml
[project]
name = "meritforge-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi==0.115.6",
  "uvicorn[standard]==0.34.0",
  "sqlalchemy==2.0.36",
  "asyncpg==0.30.0",
  "alembic==1.14.0",
  "pydantic==2.10.4",
  "pydantic-settings==2.7.0",
  "pyjwt==2.10.1",
  "bcrypt==4.2.1",
  "email-validator==2.2.0",
  "structlog==24.4.0",
]

[dependency-groups]
dev = [
  "pytest==8.3.4",
  "pytest-asyncio==0.25.0",
  "httpx==0.28.1",
  "ruff==0.8.4",
]

[tool.uv]
package = false          # the app is not a distributable package; uv installs deps only

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 2: Write the failing health test** in `tests/test_health.py`:

```python
import pytest

@pytest.mark.asyncio
async def test_health_ok(async_client):
    resp = await async_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 3: Write `conftest.py`** with the app-bound client fixture (no DB yet):

```python
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.main import create_app

@pytest_asyncio.fixture
async def async_client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: app.main` / `create_app` undefined.

- [ ] **Step 5: Implement `health_controller.py`**:

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6: Implement `controllers/__init__.py`** (the single aggregated `/api` router):

```python
from fastapi import APIRouter
from app.controllers import health_controller

api_router = APIRouter(prefix="/api")
api_router.include_router(health_controller.router)
```

- [ ] **Step 7: Implement `app/main.py`** (the factory):

```python
from fastapi import FastAPI
from app.controllers import api_router

def create_app() -> FastAPI:
    app = FastAPI(title="meritforge")
    app.include_router(api_router)
    return app

app = create_app()
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 9: Write `.env.example`** (documents every secret/override; no real values):

```bash
DATABASE_URL=postgresql://meritforge:meritforge@localhost:5432/meritforge
TEST_DATABASE_URL=postgresql://meritforge:meritforge@localhost:5432/meritforge_test
JWT_SECRET=dev-secret-change-me
```

- [ ] **Step 10: Commit**

```bash
git add backend/ && git commit -m "feat(backend): scaffold FastAPI app, health check, test harness"
```

---

### Task 2: Config — settings + `defaults.toml`

**Files:**
- Create: `backend/app/config/__init__.py`, `backend/app/config/settings.py`, `backend/app/config/defaults.toml`
- Test: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `get_settings() -> Settings` (lru_cached). `Settings` exposes: `database_url: str`, `test_database_url: str`, `jwt_secret: str`, `jwt_algorithm: str`, `jwt_expires_minutes: int`, `default_page_size: int`, `max_page_size: int`, `frontend_origin: str`, and `async_database_url` property (swaps `postgresql://` → `postgresql+asyncpg://`).
- Consumes: nothing.

- [ ] **Step 1: Write `defaults.toml`** (committed, non-secret tunables):

```toml
jwt_algorithm = "HS256"
jwt_expires_minutes = 1440
default_page_size = 20
max_page_size = 100
frontend_origin = "http://localhost:3000"
```

- [ ] **Step 2: Write the failing test** in `tests/test_config.py`:

```python
from app.config import get_settings

def test_defaults_loaded_from_toml():
    s = get_settings()
    assert s.default_page_size == 20
    assert s.max_page_size == 100
    assert s.jwt_algorithm == "HS256"

def test_async_database_url_uses_asyncpg():
    s = get_settings()
    assert s.async_database_url.startswith("postgresql+asyncpg://")

def test_env_overrides_toml(monkeypatch):
    monkeypatch.setenv("DEFAULT_PAGE_SIZE", "5")
    get_settings.cache_clear()
    assert get_settings().default_page_size == 5
    get_settings.cache_clear()
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_config.py -v`
Expected: FAIL — `app.config` has no `get_settings`.

- [ ] **Step 4: Implement `settings.py`** (env overlays TOML; secrets read from env):

```python
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict, TomlConfigSettingsSource, PydanticBaseSettingsSource

_TOML = Path(__file__).parent / "defaults.toml"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql://meritforge:meritforge@localhost:5432/meritforge"
    test_database_url: str = "postgresql://meritforge:meritforge@localhost:5432/meritforge_test"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 1440
    default_page_size: int = 20
    max_page_size: int = 100
    frontend_origin: str = "http://localhost:3000"

    @property
    def async_database_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings):
        # precedence: env > .env > defaults.toml > field defaults
        return (init_settings, env_settings, dotenv_settings, TomlConfigSettingsSource(settings_cls, _TOML))
```

- [ ] **Step 5: Implement `config/__init__.py`**:

```python
from functools import lru_cache
from app.config.settings import Settings

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/config backend/tests/test_config.py && git commit -m "feat(backend): config from defaults.toml + env overrides"
```

---

### Task 3: DB engine, Base model, session dependency + DB test fixtures

**Files:**
- Create: `backend/app/models/__init__.py`, `backend/app/models/base.py`, `backend/app/core/__init__.py`, `backend/app/core/db.py`
- Modify: `backend/tests/conftest.py` (add DB fixtures)
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Produces: `Base` (DeclarativeBase) + `TimestampMixin` (`created_at` tz-aware, server default now); `get_session() -> AsyncIterator[AsyncSession]` dependency; `engine`, `SessionLocal`. Test fixtures `db_engine` (creates/drops all tables against `TEST_DATABASE_URL`) and `db_session` (a rolled-back session per test), plus an override of `get_session` on the app.
- Consumes: `get_settings()` (Task 2).

- [ ] **Step 1: Write `base.py`**:

```python
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 2: Write `core/db.py`**:

```python
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import get_settings

engine = create_async_engine(get_settings().async_database_url, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 3: Add DB fixtures to `conftest.py`** (append):

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
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
```

Then update the `async_client` fixture to override `get_session` with the test session:

```python
@pytest_asyncio.fixture
async def async_client(db_session):
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

- [ ] **Step 4: Write the failing test** in `tests/test_db.py`:

```python
import pytest
from sqlalchemy import text

@pytest.mark.asyncio
async def test_session_connects(db_session):
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1
```

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run: `cd backend && uv run pytest tests/test_db.py -v`
Expected: FAIL first (missing modules), then PASS after Steps 1–3 are in place. (Requires a running Postgres with a `meritforge_test` database — document this in the README during P7.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/models backend/app/core backend/tests && git commit -m "feat(backend): async DB engine, Base/TimestampMixin, session + test fixtures"
```

---

### Task 4: Enums + User model + Alembic + first migration

**Files:**
- Create: `backend/app/constants/__init__.py`, `backend/app/constants/enums.py`, `backend/app/models/user.py`, `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/versions/0001_initial_users.py`
- Modify: `backend/app/models/__init__.py` (export `User`)
- Test: `backend/tests/test_user_model.py`

**Interfaces:**
- Produces: `UserRole` (str enum: `USER="user"`, `ADMIN="admin"`); `User` model — `id: UUID` (PK, default uuid4), `username: str` (unique), `email: str` (unique), `password_hash: str`, `role: UserRole` (default USER), `created_at`.
- Consumes: `Base`, `TimestampMixin` (Task 3).

- [ ] **Step 1: Write `constants/enums.py`**:

```python
import enum

class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
```

- [ ] **Step 2: Write the failing test** in `tests/test_user_model.py`:

```python
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_user_model.py -v`
Expected: FAIL — `User` not importable.

- [ ] **Step 4: Write `models/user.py`**:

```python
import uuid
from sqlalchemy import Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin
from app.constants.enums import UserRole

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), default=UserRole.USER, nullable=False)
```

- [ ] **Step 5: Export from `models/__init__.py`**:

```python
from app.models.base import Base, TimestampMixin
from app.models.user import User

__all__ = ["Base", "TimestampMixin", "User"]
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_user_model.py -v`
Expected: PASS.

- [ ] **Step 7: Wire Alembic** — `alembic.ini` (standard) + `migrations/env.py` set to async with `target_metadata = Base.metadata` and `import app.models`. Then write the first migration `0001_initial_users.py` creating the `user_role` enum + `users` table (columns exactly as the model). Verify:

Run: `cd backend && uv run alembic upgrade head && uv run alembic downgrade base`
Expected: both succeed against the dev DB (not the test DB).

- [ ] **Step 8: Commit**

```bash
git add backend/app/constants backend/app/models backend/alembic.ini backend/migrations backend/tests/test_user_model.py
git commit -m "feat(backend): UserRole enum, User model, Alembic + initial migration"
```

---

### Task 5: Error codes, `AppError` hierarchy, envelope handlers

**Files:**
- Create: `backend/app/constants/error_codes.py`, `backend/app/core/errors.py`, `backend/app/core/exceptions.py`
- Modify: `backend/app/main.py` (call `register_error_handlers(app)`)
- Test: `backend/tests/test_errors.py`

**Interfaces:**
- Produces: `error_body(code, message, details) -> dict`; `AppError(code, message, status_code=400, details=None, headers=None)`; subclasses `UnauthorizedError`, `ForbiddenError`, `NotFoundError(resource, resource_id)`, `ConflictError(code, message)`, `RateLimitedError(retry_after)`; `register_error_handlers(app)`. Error code constants (`INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`).
- Consumes: nothing.

- [ ] **Step 1: Write `constants/error_codes.py`**:

```python
INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
USERNAME_TAKEN = "USERNAME_TAKEN"
EMAIL_TAKEN = "EMAIL_TAKEN"
UNAUTHORIZED = "UNAUTHORIZED"
FORBIDDEN = "FORBIDDEN"
VALIDATION_ERROR = "VALIDATION_ERROR"
NOT_FOUND = "NOT_FOUND"
RATE_LIMITED = "RATE_LIMITED"
```

- [ ] **Step 2: Write the failing test** in `tests/test_errors.py` (mount a temp route that raises, assert envelope):

```python
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_errors.py -v`
Expected: FAIL — modules missing.

- [ ] **Step 4: Write `core/errors.py`**:

```python
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.constants import error_codes as codes

def error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}

class AppError(Exception):
    def __init__(self, code, message, status_code=400, details=None, headers=None):
        self.code, self.message, self.status_code = code, message, status_code
        self.details, self.headers = details or {}, headers
        super().__init__(message)

_HTTP_CODE = {401: codes.UNAUTHORIZED, 403: codes.FORBIDDEN, 404: codes.NOT_FOUND}

def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app(_: Request, exc: AppError):
        return JSONResponse(exc.status_code, error_body(exc.code, exc.message, exc.details), headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, exc: RequestValidationError):
        return JSONResponse(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            error_body(codes.VALIDATION_ERROR, "Request validation failed", {"errors": exc.errors()}))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODE.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(exc.status_code, error_body(code, str(exc.detail)))
```

> Note: `JSONResponse(status_code, content, ...)` — pass `status_code` first positionally or as keyword; verify signature (`JSONResponse(content=..., status_code=...)`) and adjust.

- [ ] **Step 5: Write `core/exceptions.py`**:

```python
from fastapi import status
from app.core.errors import AppError
from app.constants import error_codes as codes

class UnauthorizedError(AppError):
    def __init__(self, message="Not authenticated", code=codes.UNAUTHORIZED):
        super().__init__(code, message, status.HTTP_401_UNAUTHORIZED)

class ForbiddenError(AppError):
    def __init__(self, message="Forbidden"):
        super().__init__(codes.FORBIDDEN, message, status.HTTP_403_FORBIDDEN)

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id):
        super().__init__(f"{resource.upper()}_NOT_FOUND", f"{resource.capitalize()} not found",
                         status.HTTP_404_NOT_FOUND, {"id": str(resource_id)})

class ConflictError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message, status.HTTP_409_CONFLICT)

class RateLimitedError(AppError):
    def __init__(self, retry_after: int):
        super().__init__(codes.RATE_LIMITED, "Rate limit exceeded",
                         status.HTTP_429_TOO_MANY_REQUESTS, headers={"Retry-After": str(retry_after)})
```

- [ ] **Step 6: Wire into `create_app`** — add `register_error_handlers(app)` before returning.

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_errors.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/core backend/app/constants/error_codes.py backend/app/main.py backend/tests/test_errors.py
git commit -m "feat(backend): AppError hierarchy + single JSON error envelope"
```

---

### Task 6: Security — password hashing, JWT, Principal

**Files:**
- Create: `backend/app/services/__init__.py`, `backend/app/services/auth/__init__.py`, `backend/app/services/auth/security.py`
- Test: `backend/tests/test_security.py`

**Interfaces:**
- Produces: `hash_password(raw) -> str`; `verify_password(raw, hashed) -> bool`; `create_access_token(user_id: UUID, role: UserRole) -> str`; `decode_token(token) -> Principal` (raises `UnauthorizedError` on invalid/expired); `Principal` dataclass (`user_id: UUID`, `role: UserRole`).
- Consumes: `get_settings()`, `UserRole`, `UnauthorizedError`.

- [ ] **Step 1: Write the failing test** in `tests/test_security.py`:

```python
import uuid, pytest
from app.services.auth.security import hash_password, verify_password, create_access_token, decode_token
from app.constants.enums import UserRole
from app.core.exceptions import UnauthorizedError

def test_password_roundtrip():
    h = hash_password("s3cret")
    assert h != "s3cret"
    assert verify_password("s3cret", h) is True
    assert verify_password("wrong", h) is False

def test_token_roundtrip():
    uid = uuid.uuid4()
    principal = decode_token(create_access_token(uid, UserRole.ADMIN))
    assert principal.user_id == uid
    assert principal.role == UserRole.ADMIN

def test_bad_token_raises():
    with pytest.raises(UnauthorizedError):
        decode_token("not.a.jwt")
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_security.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `security.py`**:

```python
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import bcrypt, jwt
from app.config import get_settings
from app.constants.enums import UserRole
from app.core.exceptions import UnauthorizedError
from app.constants import error_codes as codes

@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    role: UserRole

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()

def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode(), hashed.encode())

def create_access_token(user_id: uuid.UUID, role: UserRole) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "role": role.value, "iat": now,
               "exp": now + timedelta(minutes=s.jwt_expires_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)

def decode_token(token: str) -> Principal:
    s = get_settings()
    try:
        data = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token expired", code="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid token", code="INVALID_TOKEN")
    return Principal(user_id=uuid.UUID(data["sub"]), role=UserRole(data["role"]))
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_security.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services backend/tests/test_security.py
git commit -m "feat(backend): bcrypt hashing + JWT encode/decode + Principal"
```

---

### Task 7: Auth schemas + auth service

**Files:**
- Create: `backend/app/schemas/__init__.py`, `backend/app/schemas/auth.py`, `backend/app/services/auth/auth_service.py`
- Test: `backend/tests/test_auth_service.py`

**Interfaces:**
- Produces schemas: `RegisterRequest(username, email, password)`, `LoginRequest(username, password)`, `UserOut(id, username, email, role)` (`from_attributes=True`), `AuthResponse(token, user: UserOut)`. Service fns: `register(session, data: RegisterRequest) -> AuthResponse`; `authenticate(session, data: LoginRequest) -> AuthResponse`; `get_user(session, user_id) -> User`.
- Consumes: `User`, security fns, `ConflictError`/`UnauthorizedError`, `error_codes`.

- [ ] **Step 1: Write the failing test** in `tests/test_auth_service.py`:

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth_service.py -v`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `schemas/auth.py`**:

```python
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.constants.enums import UserRole

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    username: str
    email: str
    role: UserRole

class AuthResponse(BaseModel):
    token: str
    user: UserOut
```

> `EmailStr` needs `email-validator` — already pinned in Task 1's `pyproject.toml`.

- [ ] **Step 4: Write `auth_service.py`**:

```python
import uuid
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserOut
from app.services.auth.security import hash_password, verify_password, create_access_token
from app.core.exceptions import ConflictError, UnauthorizedError, NotFoundError
from app.constants import error_codes as codes

async def register(session: AsyncSession, data: RegisterRequest) -> AuthResponse:
    existing = (await session.execute(
        select(User).where(or_(User.username == data.username, User.email == data.email)))).scalars().first()
    if existing:
        if existing.username == data.username:
            raise ConflictError(codes.USERNAME_TAKEN, "Username already taken")
        raise ConflictError(codes.EMAIL_TAKEN, "Email already registered")
    user = User(username=data.username, email=data.email, password_hash=hash_password(data.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthResponse(token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))

async def authenticate(session: AsyncSession, data: LoginRequest) -> AuthResponse:
    user = (await session.execute(select(User).where(User.username == data.username))).scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise UnauthorizedError("Invalid username or password", code=codes.INVALID_CREDENTIALS)
    return AuthResponse(token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))

async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("user", user_id)
    return user
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_auth_service.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas backend/app/services/auth/auth_service.py backend/tests/test_auth_service.py
git commit -m "feat(backend): auth schemas + register/login/get_user service"
```

---

### Task 8: Auth controllers + auth dependencies + wiring

**Files:**
- Create: `backend/app/controllers/deps.py`, `backend/app/controllers/auth_controller.py`
- Modify: `backend/app/controllers/__init__.py` (mount auth router)
- Test: `backend/tests/test_auth_api.py`

**Interfaces:**
- Produces deps: `get_current_principal(authorization: str = Header(...)) -> Principal` (raises `UnauthorizedError` if missing/malformed); `require_user` (alias of current principal); `require_admin` (raises `ForbiddenError` if role != admin). Routes: `POST /api/auth/register → 201 AuthResponse`, `POST /api/auth/login → 200 AuthResponse`, `GET /api/auth/me → 200 UserOut`.
- Consumes: `auth_service`, `decode_token`/`Principal`, `get_session`, `UserOut`.

- [ ] **Step 1: Write the failing test** in `tests/test_auth_api.py`:

```python
import pytest

@pytest.mark.asyncio
async def test_register_login_me_flow(async_client):
    r = await async_client.post("/api/auth/register",
        json={"username": "ria", "email": "r@e.com", "password": "pw123456"})
    assert r.status_code == 201
    token = r.json()["token"]

    me = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "ria"

@pytest.mark.asyncio
async def test_me_without_token_is_401(async_client):
    resp = await async_client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] in ("UNAUTHORIZED", "INVALID_TOKEN")
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth_api.py -v`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Write `controllers/deps.py`**:

```python
from fastapi import Header
from app.services.auth.security import decode_token, Principal
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.constants.enums import UserRole

async def get_current_principal(authorization: str | None = Header(default=None)) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    return decode_token(authorization.split(" ", 1)[1])

async def require_admin(principal: Principal = None) -> Principal:  # see Step 4 wiring
    ...
```

> Wire `require_user`/`require_admin` with `Depends(get_current_principal)`:
> ```python
> from fastapi import Depends
> async def require_user(p: Principal = Depends(get_current_principal)) -> Principal:
>     return p
> async def require_admin(p: Principal = Depends(get_current_principal)) -> Principal:
>     if p.role != UserRole.ADMIN:
>         raise ForbiddenError("Admin role required")
>     return p
> ```

- [ ] **Step 4: Write `auth_controller.py`**:

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.controllers.deps import require_user
from app.services.auth import auth_service
from app.services.auth.security import Principal
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    return await auth_service.register(session, body)

@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    return await auth_service.authenticate(session, body)

@router.get("/me", response_model=UserOut)
async def me(principal: Principal = Depends(require_user), session: AsyncSession = Depends(get_session)):
    return UserOut.model_validate(await auth_service.get_user(session, principal.user_id))
```

- [ ] **Step 5: Mount in `controllers/__init__.py`** — `from app.controllers import auth_controller` + `api_router.include_router(auth_controller.router)`.

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_auth_api.py -v`
Expected: PASS.

- [ ] **Step 7: Run the whole suite + linter**

Run: `cd backend && uv run pytest -v && uv run ruff check app tests`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add backend/app/controllers backend/tests/test_auth_api.py
git commit -m "feat(backend): auth controllers (register/login/me) + auth deps (require_user/admin)"
```

---

## Self-Review

**Spec coverage (`01` §1 auth/roles + `02` auth rows + `08` structure):**
- Register/login/me → Tasks 7–8 ✓ · JWT + roles → Task 6 ✓ · admin 403 guard (`require_admin`) → Task 8 ✓ (exercised for real in P4 admin endpoints) · error envelope → Task 5 ✓ · config-from-file → Task 2 ✓ · layering (controllers/services/models/schemas/constants/config/core) → all tasks ✓.
- **Out of scope for P1 (by design):** forum, events, engine — these are P2–P4.

**Placeholder scan:** `deps.py` Step 3 intentionally shows the final `require_user`/`require_admin` bodies in the note block — fold them into the actual file (no `...` left in the committed code). No other TODOs.

**Type consistency:** `Principal(user_id, role)` is produced in Task 6 and consumed unchanged in Tasks 7–8. `AuthResponse{token, user: UserOut}` and `UserOut{id, username, email, role}` are consistent across service (Task 7) and controllers (Task 8). `get_session` (Task 3) is the single session dependency used by all controllers and overridden in tests.

**Prereq flagged:** Tasks 3–8 require a running Postgres with a `meritforge_test` database; document setup in P7's README. `email-validator` dep is called out in Task 7 Step 3.
