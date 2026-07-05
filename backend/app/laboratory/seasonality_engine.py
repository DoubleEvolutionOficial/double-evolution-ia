from __future__ import annotations

from collections import Counter
from typing import Any

from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.statistics_engine import StatisticsEngine


class SeasonalityEngine:
    """Derives seasonal recurrence signals from Laboratory history."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        statistics_engine: StatisticsEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)

    def build_seasonality_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "dominant_hour": None,
                "dominant_minute_final": None,
                "dominant_side": "indefinido",
                "dominant_classification": "NEUTRO",
                "seasonality_strength": 0.0,
                "confidence": 0.0,
                "explanation": ["Sem histórico disponível para avaliar sazonalidade"],
                "factors": {
                    "hour_concentration": 0.0,
                    "minute_concentration": 0.0,
                    "side_recurrence": 0.0,
                    "classification_recurrence": 0.0,
                    "temporal_consistency": 0.0,
                    "historical_coverage": 0.0,
                },
            }

        summary = self.statistics_engine.build_summary()
        total_events = len(events)
        hour_counts = Counter(event.hour for event in events)
        minute_final_counts = Counter(event.minute % 10 for event in events)
        side_counts = Counter(event.side.lower() for event in events)
        class_counts = Counter(event.classification for event in events)

        dominant_hour = self._dominant_value(hour_counts)
        dominant_minute_final = self._dominant_value(minute_final_counts)
        dominant_side = self._dominant_side(side_counts)
        dominant_classification = self._dominant_classification(class_counts)

        factors = {
            "hour_concentration": round(self._concentration(hour_counts, total_events), 2),
            "minute_concentration": round(self._concentration(minute_final_counts, total_events), 2),
            "side_recurrence": round(self._concentration(side_counts, total_events), 2),
            "classification_recurrence": round(self._concentration(class_counts, total_events), 2),
            "temporal_consistency": round(self._temporal_consistency(float(summary["tempo_medio"]["value"])), 2),
            "historical_coverage": round(min(100.0, total_events * 10.0), 2),
        }

        seasonality_strength = (
            factors["hour_concentration"] * 0.25
            + factors["minute_concentration"] * 0.2
            + factors["side_recurrence"] * 0.15
            + factors["classification_recurrence"] * 0.2
            + factors["temporal_consistency"] * 0.1
            + factors["historical_coverage"] * 0.1
        )
        seasonality_strength = round(max(0.0, min(100.0, seasonality_strength)), 2)
        confidence = round(max(0.0, min(100.0, seasonality_strength * 0.85 + factors["historical_coverage"] * 0.15)), 2)

        explanation = [
            f"Hora dominante: {dominant_hour}",
            f"Minuto final dominante: {dominant_minute_final}",
            f"Lado dominante: {dominant_side}",
            f"Classificação dominante: {dominant_classification.lower()}",
        ]

        return {
            "dominant_hour": dominant_hour,
            "dominant_minute_final": dominant_minute_final,
            "dominant_side": dominant_side,
            "dominant_classification": dominant_classification,
            "seasonality_strength": seasonality_strength,
            "confidence": confidence,
            "explanation": explanation,
            "factors": factors,
        }

    @staticmethod
    def _dominant_value(counter: Counter[Any]) -> Any:
        if not counter:
            return None
        return counter.most_common(1)[0][0]

    @staticmethod
    def _dominant_side(counter: Counter[str]) -> str:
        left = counter.get("left", 0)
        right = counter.get("right", 0)
        if left > right:
            return "left"
        if right > left:
            return "right"
        return "equilibrado"

    @staticmethod
    def _dominant_classification(counter: Counter[str]) -> str:
        if not counter:
            return "NEUTRO"
        return counter.most_common(1)[0][0]

    @staticmethod
    def _concentration(counter: Counter[Any], total_events: int) -> float:
        if not counter:
            return 0.0
        dominant = counter.most_common(1)[0][1]
        return min(100.0, (dominant / max(1, total_events)) * 100.0)

    @staticmethod
    def _temporal_consistency(average_time_gap: float) -> float:
        return max(0.0, min(100.0, 100.0 - abs(60.0 - average_time_gap)))