from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.laboratory import AnalysisEvent, DecisionPipeline, LaboratoryEngine

router = APIRouter(prefix="/laboratory", tags=["laboratory"])


class LaboratoryEventPayload(BaseModel):
    timestamp: str
    hour: int
    minute: int
    side: str
    distance: float
    classification: str
    confidence: float
    score: float
    triggered_rules: list[str] = Field(default_factory=list)
    recommendation: str | None = None


class LaboratoryAnalyzePayload(BaseModel):
    events: list[LaboratoryEventPayload] = Field(default_factory=list)


@router.get("/health", summary="Laboratory health check")
async def get_laboratory_health() -> dict[str, str]:
    return {
        "status": "online",
        "module": "laboratory",
    }


@router.post("/analyze", summary="Run Laboratory DecisionPipeline")
async def analyze_laboratory(payload: LaboratoryAnalyzePayload) -> dict:
    laboratory_engine = LaboratoryEngine()

    for event in payload.events:
        laboratory_engine.record_analysis_event(
            AnalysisEvent(
                timestamp=event.timestamp,
                hour=event.hour,
                minute=event.minute,
                side=event.side,
                distance=event.distance,
                classification=event.classification,
                confidence=event.confidence,
                score=event.score,
                triggered_rules=event.triggered_rules,
                recommendation=event.recommendation,
            )
        )

    pipeline = DecisionPipeline(laboratory_engine)
    return pipeline.run()