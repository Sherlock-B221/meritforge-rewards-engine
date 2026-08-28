import uuid

import pytest

from app.config import get_settings
from app.constants.enums import UserRole
from app.controllers.deps import PageParams, get_optional_principal, paginate
from app.services.auth.security import create_access_token


@pytest.mark.asyncio
async def test_paginate_defaults_and_clamps_low():
    s = get_settings()
    assert await paginate(page=1, limit=None) == PageParams(page=1, limit=s.default_page_size)
    assert await paginate(page=-5, limit=0) == PageParams(page=1, limit=1)


@pytest.mark.asyncio
async def test_paginate_clamps_high_limit():
    s = get_settings()
    result = await paginate(page=3, limit=99999)
    assert result.page == 3
    assert result.limit == s.max_page_size


@pytest.mark.asyncio
async def test_optional_principal_is_anonymous_without_a_bearer_token():
    assert await get_optional_principal(authorization=None) is None
    assert await get_optional_principal(authorization="Basic abc") is None


@pytest.mark.asyncio
async def test_optional_principal_is_anonymous_on_a_bad_token():
    # A malformed/expired token degrades to anonymous rather than raising —
    # a stale token must never 401 a public page.
    assert await get_optional_principal(authorization="Bearer not-a-jwt") is None


@pytest.mark.asyncio
async def test_optional_principal_resolves_a_valid_token():
    uid = uuid.uuid4()
    token = create_access_token(uid, UserRole.USER)
    p = await get_optional_principal(authorization=f"Bearer {token}")
    assert p is not None
    assert p.user_id == uid
    assert p.role == UserRole.USER
