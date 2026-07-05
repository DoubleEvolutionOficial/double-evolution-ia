from __future__ import annotations

from collections import Counter
from typing import Any

from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.sequence_analyzer import SequenceAnalyzer
from app.laboratory.statistics_engine import StatisticsEngine


class TrendEngine:
    """Derives isolated trend signals from Laboratory history."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        statistics_engine: StatisticsEngine | None = None,
        sequence_analyzer: SequenceAnalyzer | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)
        self.sequence_analyzer = sequence_analyzer or SequenceAnalyzer(self.laboratory_engine)

    def build_trend_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "trend_direction": "NEUTRO",
                "trend_strength": 0.0,
                "momentum": "flat",
                "dominant_side": "indefinido",
                "dominant_classification": "NEUTRO",
                "confidence": 0.0,
                "explanation": ["Sem histórico disponível para avaliar tendência"],
                "factors": {
                    "classification_bias": 0.0,
                    "sequence_strength": 0.0,
                    "side_bias": 0.0,
                    "distance_trend": 0.0,
                    "temporal_stability": 0.0,
                    "historical_consistency": 0.0,
                },
            }

        summary = self.statistics_engine.build_summary()
        sequence = self.sequence_analyzer.get_current_sequence()
        classifications = Counter(event.classification for event in events)
        sides = Counter(event.side.lower() for event in events)

        devedor_count = float(classifications.get("DEVEDOR", 0))
        pagador_count = float(classifications.get("PAGADOR", 0))
        total_events = len(events)

        trend_direction = self._trend_direction(devedor_count, pagador_count)
        dominant_classification = trend_direction
        dominant_side = self._dominant_side(sides)

        factors = {
            "classification_bias": round(self._classification_bias(devedor_count, pagador_count, total_events), 2),
            "sequence_strength": round(self._sequence_strength(sequence), 2),
            "side_bias": round(self._side_bias(sides, total_events), 2),
            "distance_trend": round(self._distance_trend(float(summary["distancia_media"]["value"])), 2),
            "temporal_stability": round(self._temporal_stability(float(summary["tempo_medio"]["value"])), 2),
            "historical_consistency": round(float(summary["freq_devedores"]["confidence"]), 2),
        }

        trend_strength = (
            factors["classification_bias"] * 0.3
            + factors["sequence_strength"] * 0.2
            + factors["side_bias"] * 0.1
            + factors["distance_trend"] * 0.15
            + factors["temporal_stability"] * 0.1
            + factors["historical_consistency"] * 0.15
        )
        trend_strength = round(max(0.0, min(100.0, trend_strength)), 2)

        momentum = self._momentum(events)
        confidence = round(max(0.0, min(100.0, trend_strength * 0.8 + factors["historical_consistency"] * 0.2)), 2)

        explanation = [
            f"Classificação dominante: {dominant_classification.lower()}",
            f"Lado dominante: {dominant_side}",
            f"Sequência observada com força de {factors['sequence_strength']:.2f}",
            f"Estabilidade temporal em {factors['temporal_stability']:.2f}",
        ]

        return {
            "trend_direction": trend_direction,
            "trend_strength": trend_strength,
            "momentum": momentum,
            "dominant_side": dominant_side,
            "dominant_classification": dominant_classification,
            "confidence": confidence,
            "explanation": explanation,
            "factors": factors,
        }

    @staticmethod
    def _trend_direction(devedor_count: float, pagador_count: float) -> str:
        if devedor_count > pagador_count:
            return "DEVEDOR"
        if pagador_count > devedor_count:
            return "PAGADOR"
        return "NEUTRO"

    @staticmethod
    def _dominant_side(sides: Counter[str]) -> str:
        left = sides.get("left", 0)
        right = sides.get("right", 0)
        if left > right:
            return "left"
        if right > left:
            return "right"
        return "equilibrado"

    @staticmethod
    def _classification_bias(devedor_count: float, pagador_count: float, total_events: int) -> float:
        dominant = max(devedor_count, pagador_count)
        return min(100.0, (dominant / max(1, total_events)) * 100.0)

    @staticmethod
    def _sequence_strength(sequence: list[str]) -> float:
        if not sequence:
            return 0.0
        runs = 1
        best = 1
        for previous, current in zip(sequence, sequence[1:]):
            if previous == current:
                runs += 1
                best = max(best, runs)
            else:
                runs = 1
        return min(100.0, best * 20.0)

    @staticmethod
    def _side_bias(sides: Counter[str], total_events: int) -> float:
        dominant = max(sides.values(), default=0)
        return min(100.0, (dominant / max(1, total_events)) * 100.0)

    @staticmethod
    def _distance_trend(average_distance: float) -> float:
        return max(0.0, min(100.0, 100.0 - (average_distance * 10.0)))

    @staticmethod
    def _temporal_stability(average_time_gap: float) -> float:
        return max(0.0, min(100.0, 100.0 - abs(60.0 - average_time_gap)))

    @staticmethod
    def _momentum(events: list[Any]) -> str:
        if len(events) < 2:
            return "flat"
        distance_delta = events[-1].distance - events[0].distance
        if distance_delta < 0:
            return "rising"
        if distance_delta > 0:
            return "falling"
        return "flat"