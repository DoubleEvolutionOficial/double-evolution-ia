from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
async def get_health() -> dict:
    return {
        "status": "online",
        "project": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
