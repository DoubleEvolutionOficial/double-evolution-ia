from pathlib import Path

from pydantic import BaseSettings


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    APP_NAME: str = "Double Evolution IA"
    APP_VERSION: str = "0.1.0-alpha"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'dev.db'}"
    DATABASE_ECHO: bool = False


settings = Settings()
