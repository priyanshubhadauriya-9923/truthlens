from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "TruthLens API"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = "sqlite:///./truthlens.db"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-this-in-production"
    access_token_expire_minutes: int = 60

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    max_upload_size_mb: int = 10
    rate_limit_per_minute: int = 60

    model_path: str = "models/weights"
    allowed_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
