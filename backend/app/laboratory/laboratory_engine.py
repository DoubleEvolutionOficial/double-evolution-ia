from __future__ import annotations

from app.laboratory.event_logger import AnalysisEvent, EventLogger


class LaboratoryEngine:
    """Standalone module for recording analysis events without affecting rule evaluation."""

    def __init__(self, event_logger: EventLogger | None = None) -> None:
        self.event_logger = event_logger or EventLogger()

    def record_analysis_event(self, event: AnalysisEvent) -> AnalysisEvent:
        return self.event_logger.log_event(event)

    def get_events(self) -> list[AnalysisEvent]:
        return list(self.event_logger.events)
