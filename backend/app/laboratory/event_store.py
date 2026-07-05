from __future__ import annotations

from typing import Any

from app.laboratory.event_logger import AnalysisEvent


class EventStore:
    """In-memory store designed for large volumes of analysis events."""

    def __init__(self) -> None:
        self._events: list[AnalysisEvent] = []

    def add_event(self, event: AnalysisEvent) -> AnalysisEvent:
        self._events.append(event)
        return event

    def get_events(self) -> list[AnalysisEvent]:
        return list(self._events)

    def count(self) -> int:
        return len(self._events)

    def clear(self) -> None:
        self._events.clear()

    def get_slice(self, start: int, end: int | None = None) -> list[AnalysisEvent]:
        return list(self._events[start:end])
