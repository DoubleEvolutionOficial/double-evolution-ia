from fastapi import FastAPI

from app.api import router as api_router
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Double Evolution IA",
        version=settings.APP_VERSION,
        description="API backend for Double Evolution IA"
    )
    app.include_router(api_router)
    return app


app = create_app()
