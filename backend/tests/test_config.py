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
