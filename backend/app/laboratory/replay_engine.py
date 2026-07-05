from __future__ import annotations

from typing import Any

from app.laboratory.event_logger import AnalysisEvent
from app.laboratory.laboratory_engine import LaboratoryEngine


class ReplayEngine:
    """Replays recorded laboratory events without mutating them."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()

    def replay(self, count: int | None = None, start_hour: int | None = None, end_hour: int | None = None, hour: int | None = None) -> list[AnalysisEvent]:
        events = self.laboratory_engine.get_events()

        if hour is not None:
            events = [event for event in events if event.hour == hour]
        elif start_hour is not None or end_hour is not None:
            lower = start_hour if start_hour is not None else 0
            upper = end_hour if end_hour is not None else 23
            events = [event for event in events if lower <= event.hour <= upper]

        if count is not None:
            events = events[:count]

        return list(events)
