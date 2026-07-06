from fastapi import APIRouter

from app.api.v1.analysis import router as analysis_router
from app.api.v1.health import router as health_router
from app.api.v1.laboratory import router as laboratory_router

router = APIRouter(prefix="/v1")
router.include_router(health_router)
router.include_router(analysis_router)
router.include_router(laboratory_router)

__all__ = ["router"]
