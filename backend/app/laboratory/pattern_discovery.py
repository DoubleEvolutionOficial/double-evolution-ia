from __future__ import annotations

from collections import Counter
from typing import Any

from app.laboratory.event_logger import AnalysisEvent
from app.laboratory.laboratory_engine import LaboratoryEngine


class PatternDiscovery:
    """Discovers recurring patterns from laboratory events without modifying them."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()

    def discover_patterns(self) -> list[dict[str, Any]]:
        events = self.laboratory_engine.get_events()
        if not events:
            return []

        patterns: list[dict[str, Any]] = []

        devedor_runs = self._count_runs(events, "DEVEDOR")
        pagador_runs = self._count_runs(events, "PAGADOR")
        before_rain = self._before_rain(events)
        alternation = self._alternation(events)
        minute_repetitions = self._minute_repetitions(events)
        hour_repetitions = self._hour_repetitions(events)
        consecutive = self._consecutive(events)

        if devedor_runs:
            patterns.append({
                "name": "Padrão de Devedores",
                "occurrences": devedor_runs,
                "confidence": 0.8,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.classification for event in events if event.classification == "DEVEDOR"],
            })

        if pagador_runs:
            patterns.append({
                "name": "Padrão de Pagadores",
                "occurrences": pagador_runs,
                "confidence": 0.8,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.classification for event in events if event.classification == "PAGADOR"],
            })

        if before_rain:
            patterns.append({
                "name": "Padrão antes de Chuva",
                "occurrences": before_rain,
                "confidence": 0.75,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.classification for event in events if event.classification != "CHUVA"],
            })

        if alternation:
            patterns.append({
                "name": "Padrão de Alternância entre lados",
                "occurrences": alternation,
                "confidence": 0.7,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.side for event in events],
            })

        if minute_repetitions:
            patterns.append({
                "name": "Padrão de Repetições por Minuto Final",
                "occurrences": minute_repetitions,
                "confidence": 0.7,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.minute % 10 for event in events],
            })

        if hour_repetitions:
            patterns.append({
                "name": "Padrão de Repetições por Horário",
                "occurrences": hour_repetitions,
                "confidence": 0.7,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.hour for event in events],
            })

        if consecutive:
            patterns.append({
                "name": "Padrão Consecutivos de Eventos",
                "occurrences": consecutive,
                "confidence": 0.65,
                "first_occurrence": events[0].timestamp,
                "last_occurrence": events[-1].timestamp,
                "examples": [event.classification for event in events],
            })

        return patterns

    @staticmethod
    def _count_runs(events: list[AnalysisEvent], classification: str) -> int:
        count = 0
        for event in events:
            if event.classification == classification:
                count += 1
        return count

    @staticmethod
    def _before_rain(events: list[AnalysisEvent]) -> int:
        return sum(1 for event in events if event.classification == "CHUVA")

    @staticmethod
    def _alternation(events: list[AnalysisEvent]) -> int:
        if len(events) < 2:
            return 0
        alternations = 0
        for previous, current in zip(events, events[1:]):
            if previous.side != current.side:
                alternations += 1
        return alternations

    @staticmethod
    def _minute_repetitions(events: list[AnalysisEvent]) -> int:
        counts = Counter(event.minute % 10 for event in events)
        return max(counts.values(), default=0)

    @staticmethod
    def _hour_repetitions(events: list[AnalysisEvent]) -> int:
        counts = Counter(event.hour for event in events)
        return max(counts.values(), default=0)

    @staticmethod
    def _consecutive(events: list[AnalysisEvent]) -> int:
        return max(1, len(events))
