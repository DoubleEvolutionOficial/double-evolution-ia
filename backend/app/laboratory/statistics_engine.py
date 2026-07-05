from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any

from app.laboratory.event_logger import AnalysisEvent
from app.laboratory.laboratory_engine import LaboratoryEngine


class StatisticsEngine:
    """Calculates basic statistics from Laboratory events without modifying them."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()

    def build_summary(self) -> dict[str, dict[str, Any]]:
        events = self.laboratory_engine.get_events()
        quantity = len(events)
        period = self._period(events)
        confidence = self._confidence(events)

        return {
            "freq_pedra_chave": self._metric("freq_pedra_chave", sum(1 for event in events if event.classification == "PEDRA CHAVE"), quantity, confidence, period),
            "freq_devedores": self._metric("freq_devedores", sum(1 for event in events if event.classification == "DEVEDOR"), quantity, confidence, period),
            "freq_pagadores": self._metric("freq_pagadores", sum(1 for event in events if event.classification == "PAGADOR"), quantity, confidence, period),
            "freq_chuva": self._metric("freq_chuva", sum(1 for event in events if event.classification == "CHUVA"), quantity, confidence, period),
            "distancia_media": self._metric("distancia_media", self._average_distance(events), quantity, confidence, period),
            "tempo_medio": self._metric("tempo_medio", self._average_time_gap(events), quantity, confidence, period),
            "maior_sequencia": self._metric("maior_sequencia", self._longest_sequence(events), quantity, confidence, period),
            "distribuicao_por_hora": self._metric("distribuicao_por_hora", self._distribution_by_hour(events), quantity, confidence, period),
            "distribuicao_por_lado": self._metric("distribuicao_por_lado", self._distribution_by_side(events), quantity, confidence, period),
            "distribuicao_por_minuto_final": self._metric("distribuicao_por_minuto_final", self._distribution_by_minute_final(events), quantity, confidence, period),
        }

    @staticmethod
    def _metric(name: str, value: Any, quantity: int, confidence: float, period: str) -> dict[str, Any]:
        return {
            "name": name,
            "value": value,
            "quantity_analyzed": quantity,
            "confidence": confidence,
            "period": period,
        }

    @staticmethod
    def _period(events: list[AnalysisEvent]) -> str:
        if not events:
            return "sem eventos"
        hours = [event.hour for event in events]
        return f"{min(hours)}-{max(hours)}"

    @staticmethod
    def _confidence(events: list[AnalysisEvent]) -> float:
        if not events:
            return 0.0
        return round(sum(event.confidence for event in events) / len(events), 2)

    @staticmethod
    def _average_distance(events: list[AnalysisEvent]) -> float:
        if len(events) < 2:
            return 0.0
        distances = [abs(current.distance - previous.distance) for previous, current in zip(events, events[1:])]
        return round(sum(distances) / len(distances), 2) if distances else 0.0

    @staticmethod
    def _average_time_gap(events: list[AnalysisEvent]) -> float:
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
        return round(sum(gaps_seconds) / len(gaps_seconds), 2) if gaps_seconds else 0.0

    @staticmethod
    def _longest_sequence(events: list[AnalysisEvent]) -> int:
        current = 0
        best = 0
        for event in events:
            if event.classification in {"DEVEDOR", "PAGADOR"}:
                current += 1
                best = max(best, current)
            else:
                current = 0
        return best

    @staticmethod
    def _distribution_by_hour(events: list[AnalysisEvent]) -> dict[int, int]:
        return dict(sorted(Counter(event.hour for event in events).items()))

    @staticmethod
    def _distribution_by_side(events: list[AnalysisEvent]) -> dict[str, int]:
        return dict(sorted(Counter(event.side.lower() for event in events).items()))

    @staticmethod
    def _distribution_by_minute_final(events: list[AnalysisEvent]) -> dict[int, int]:
        return dict(sorted(Counter(event.minute % 10 for event in events).items()))
