from __future__ import annotations

from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.sequence_analyzer import SequenceAnalyzer
from app.laboratory.statistics_engine import StatisticsEngine


class AdaptiveLearningEngine:
    """Learns from Laboratory history without mutating recorded events."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        statistics_engine: StatisticsEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
        sequence_analyzer: SequenceAnalyzer | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.sequence_analyzer = sequence_analyzer or SequenceAnalyzer(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def build_adaptation_profile(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "adaptation_score": 0.0,
                "learning_state": "cold_start",
                "recommended_bias": "NEUTRO",
                "event_count": 0,
                "explanation": ["Sem histórico disponível para adaptação"],
                "factors": {
                    "historical_accuracy": 0.0,
                    "confidence_reliability": 0.0,
                    "pattern_strength": 0.0,
                    "regime_alignment": 0.0,
                    "frequency_balance": 0.0,
                    "temporal_stability": 0.0,
                    "event_coverage": 0.0,
                },
            }

        statistics = self.statistics_engine.build_summary()
        pattern_scores = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()
        backtest = self.backtesting_engine.run_backtest()
        current_sequence = self.sequence_analyzer.get_current_sequence()

        devedor_count = float(statistics["freq_devedores"]["value"])
        pagador_count = float(statistics["freq_pagadores"]["value"])
        total_events = len(events)

        recommended_bias = self._recommended_bias(devedor_count, pagador_count)
        historical_accuracy = backtest["accuracy"] * 100.0
        confidence_reliability = float(backtest["average_confidence"])
        pattern_strength = self._pattern_strength(pattern_scores)
        regime_alignment = self._regime_alignment(recommended_bias, regimes)
        frequency_balance = self._frequency_balance(devedor_count, pagador_count, total_events)
        temporal_stability = self._temporal_stability(
            float(statistics["tempo_medio"]["value"]),
            float(statistics["distancia_media"]["value"]),
            current_sequence,
        )
        event_coverage = min(100.0, total_events * 5.0)

        factors = {
            "historical_accuracy": round(historical_accuracy, 2),
            "confidence_reliability": round(confidence_reliability, 2),
            "pattern_strength": round(pattern_strength, 2),
            "regime_alignment": round(regime_alignment, 2),
            "frequency_balance": round(frequency_balance, 2),
            "temporal_stability": round(temporal_stability, 2),
            "event_coverage": round(event_coverage, 2),
        }

        adaptation_score = (
            factors["historical_accuracy"] * 0.2
            + factors["confidence_reliability"] * 0.15
            + factors["pattern_strength"] * 0.15
            + factors["regime_alignment"] * 0.1
            + factors["frequency_balance"] * 0.15
            + factors["temporal_stability"] * 0.15
            + factors["event_coverage"] * 0.1
        )
        adaptation_score = round(max(0.0, min(100.0, adaptation_score)), 2)

        if adaptation_score >= 75.0:
            learning_state = "adaptive"
        elif adaptation_score >= 45.0:
            learning_state = "stable"
        else:
            learning_state = "conservative"

        explanation = [
            f"Histórico analisado com {total_events} eventos",
            f"Viés recomendado: {recommended_bias.lower()}",
            f"Backtesting com acurácia de {factors['historical_accuracy']:.2f}",
            f"Estabilidade temporal em {factors['temporal_stability']:.2f}",
        ]

        return {
            "adaptation_score": adaptation_score,
            "learning_state": learning_state,
            "recommended_bias": recommended_bias,
            "event_count": total_events,
            "explanation": explanation,
            "factors": factors,
        }

    @staticmethod
    def _recommended_bias(devedor_count: float, pagador_count: float) -> str:
        if devedor_count > pagador_count:
            return "DEVEDOR"
        if pagador_count > devedor_count:
            return "PAGADOR"
        return "NEUTRO"

    @staticmethod
    def _pattern_strength(pattern_scores: list[dict[str, Any]]) -> float:
        if not pattern_scores:
            return 0.0
        total_score = sum(float(pattern["score"]) for pattern in pattern_scores)
        return min(100.0, total_score / len(pattern_scores))

    @staticmethod
    def _regime_alignment(recommended_bias: str, regimes: list[dict[str, Any]]) -> float:
        for regime in regimes:
            name = str(regime.get("name", "")).lower()
            if recommended_bias.lower() in name:
                return min(100.0, float(regime.get("score", 0.0)) * 100.0)
        if regimes:
            return min(100.0, float(regimes[0].get("score", 0.0)) * 100.0)
        return 0.0

    @staticmethod
    def _frequency_balance(devedor_count: float, pagador_count: float, total_events: int) -> float:
        dominant = max(devedor_count, pagador_count)
        return min(100.0, (dominant / max(1, total_events)) * 100.0)

    @staticmethod
    def _temporal_stability(average_time: float, average_distance: float, sequence: list[str]) -> float:
        time_factor = max(0.0, 100.0 - abs(60.0 - average_time))
        distance_factor = max(0.0, 100.0 - (average_distance * 10.0))
        sequence_factor = min(100.0, len(sequence) * 10.0)
        return min(100.0, (time_factor * 0.4) + (distance_factor * 0.3) + (sequence_factor * 0.3))