from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict, TomlConfigSettingsSource

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
    trending_upvote_weight: float = 2.0
    trending_comment_weight: float = 1.5
    trending_gravity: float = 1.5

    @property
    def async_database_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings):
        # precedence: env > .env > defaults.toml > field defaults
        return (init_settings, env_settings, dotenv_settings, TomlConfigSettingsSource(settings_cls, _TOML))
