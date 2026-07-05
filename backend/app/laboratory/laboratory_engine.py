from __future__ import annotations

from app.laboratory.event_logger import AnalysisEvent, EventLogger
from app.laboratory.event_store import EventStore


class LaboratoryEngine:
    """Standalone module for recording analysis events without affecting rule evaluation."""

    def __init__(self, event_logger: EventLogger | None = None, event_store: EventStore | None = None) -> None:
        self.event_logger = event_logger or EventLogger()
        self.event_store = event_store or EventStore()

    def record_analysis_event(self, event: AnalysisEvent) -> AnalysisEvent:
        self.event_store.add_event(event)
        return self.event_logger.log_event(event)

    def get_events(self) -> list[AnalysisEvent]:
        return self.event_store.get_events()
