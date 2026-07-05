from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from app.laboratory.event_logger import AnalysisEvent
from app.laboratory.laboratory_engine import LaboratoryEngine


class SequenceAnalyzer:
    """Analyzes laboratory events in chronological order from memory."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()

    def _events(self) -> list[AnalysisEvent]:
        return self.laboratory_engine.get_events()

    def get_last_events(self, count: int) -> list[AnalysisEvent]:
        events = self._events()
        return list(events[-count:]) if count > 0 else []

    def get_current_sequence(self) -> list[str]:
        return [event.classification for event in self._events()]

    def get_longest_sequence(self, classification: str) -> int:
        current = 0
        best = 0
        for event in self._events():
            if event.classification == classification:
                current += 1
                best = max(best, current)
            else:
                current = 0
        return best

    def get_average_distance(self) -> float:
        events = self._events()
        if len(events) < 2:
            return 0.0

        distances = []
        for previous, current in zip(events, events[1:]):
            distances.append(abs(current.distance - previous.distance))
        return sum(distances) / len(distances) if distances else 0.0

    def get_average_time_gap(self) -> float:
        events = self._events()
        if len(events) < 2:
            return 0.0

        gaps_seconds = []
        for previous, current in zip(events, events[1:]):
            try:
                previous_dt = datetime.fromisoformat(previous.timestamp.replace("Z", "+00:00"))
                current_dt = datetime.fromisoformat(current.timestamp.replace("Z", "+00:00"))
                gaps_seconds.append((current_dt - previous_dt).total_seconds())
            except ValueError:
                continue

        return sum(gaps_seconds) / len(gaps_seconds) if gaps_seconds else 0.0

    def get_timeline(self) -> list[dict[str, Any]]:
        return [
            {
                "timestamp": event.timestamp,
                "classification": event.classification,
                "distance": event.distance,
                "side": event.side,
            }
            for event in self._events()
        ]
