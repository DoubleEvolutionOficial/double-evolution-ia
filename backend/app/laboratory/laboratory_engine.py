from __future__ import annotations

from typing import Any

from app.laboratory.event_logger import EventLogger


class LaboratoryEngine:
    """Standalone module for recording analysis events without affecting rule evaluation."""

    def __init__(self, event_logger: EventLogger | None = None) -> None:
        self.event_logger = event_logger or EventLogger()

    def record_analysis_event(self, analysis_id: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.event_logger.log_event(analysis_id, context)

    def get_events(self) -> list[dict[str, Any]]:
        return list(self.event_logger.events)
