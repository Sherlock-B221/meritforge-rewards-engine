import pytest

from app.config import get_settings
from app.controllers.deps import PageParams, paginate


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
