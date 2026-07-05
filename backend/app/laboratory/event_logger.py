from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AnalysisEvent:
    timestamp: str
    hour: int
    minute: int
    side: str
    distance: float
    classification: str
    confidence: float
    score: float
    triggered_rules: list[str] = field(default_factory=list)
    recommendation: str | None = None


class EventLogger:
    """Stores analysis events for future statistical mining."""

    def __init__(self) -> None:
        self.events: list[AnalysisEvent] = []

    def log_event(self, event: AnalysisEvent) -> AnalysisEvent:
        self.events.append(event)
        return event
