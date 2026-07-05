from __future__ import annotations

from typing import Any

from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.sequence_analyzer import SequenceAnalyzer
from app.laboratory.statistics_engine import StatisticsEngine


class ConfidenceEngine:
    """Calculates confidence and reliability for Laboratory predictions."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
        statistics_engine: StatisticsEngine | None = None,
        sequence_analyzer: SequenceAnalyzer | None = None,
        backtesting_engine: Any | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)
        self.sequence_analyzer = sequence_analyzer or SequenceAnalyzer(self.laboratory_engine)
        if backtesting_engine is None:
            from app.laboratory.backtesting_engine import BacktestingEngine

            self.backtesting_engine = BacktestingEngine(self.laboratory_engine)
        else:
            self.backtesting_engine = backtesting_engine

    def assess_prediction(self, prediction: dict[str, Any]) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "confidence": 0.0,
                "reliability": "baixa",
                "risk_level": "alto",
                "explanation": ["Sem histórico suficiente para avaliar a previsão"],
                "factors": {
                    "historical_accuracy": 0.0,
                    "pattern_score": 0.0,
                    "regime_score": 0.0,
                    "historical_frequency": 0.0,
                    "statistical_consistency": 0.0,
                    "average_distance": 0.0,
                    "temporal_stability": 0.0,
                    "backtesting_accuracy": 0.0,
                },
            }

        predicted_event = str(prediction.get("predicted_event", "NEUTRO"))
        statistics = self.statistics_engine.build_summary()
        pattern_scores = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()
        backtest = self.backtesting_engine.run_backtest()

        total_events = max(1, len(events))
        predicted_frequency = self._predicted_frequency(predicted_event, statistics, total_events)
        relevant_pattern_score = self._relevant_pattern_score(predicted_event, pattern_scores)
        regime_score = self._regime_score(predicted_event, regimes)
        historical_accuracy = backtest["accuracy"] * 100.0
        statistical_consistency = min(100.0, float(statistics["freq_devedores"]["confidence"]))
        average_distance = self._distance_factor(float(statistics["distancia_media"]["value"]))
        temporal_stability = self._temporal_stability(float(statistics["tempo_medio"]["value"]), self.sequence_analyzer.get_current_sequence())
        backtesting_accuracy = backtest["average_confidence"] * 100.0

        factors = {
            "historical_accuracy": round(historical_accuracy, 2),
            "pattern_score": round(relevant_pattern_score, 2),
            "regime_score": round(regime_score, 2),
            "historical_frequency": round(predicted_frequency, 2),
            "statistical_consistency": round(statistical_consistency, 2),
            "average_distance": round(average_distance, 2),
            "temporal_stability": round(temporal_stability, 2),
            "backtesting_accuracy": round(backtesting_accuracy, 2),
        }

        weighted_confidence = (
            factors["historical_accuracy"] * 0.2
            + factors["pattern_score"] * 0.15
            + factors["regime_score"] * 0.1
            + factors["historical_frequency"] * 0.15
            + factors["statistical_consistency"] * 0.1
            + factors["average_distance"] * 0.1
            + factors["temporal_stability"] * 0.1
            + factors["backtesting_accuracy"] * 0.1
        )
        confidence = round(max(0.0, min(100.0, weighted_confidence)), 2)

        if confidence >= 75.0:
            reliability = "alta"
            risk_level = "baixo"
        elif confidence >= 45.0:
            reliability = "média"
            risk_level = "médio"
        else:
            reliability = "baixa"
            risk_level = "alto"

        explanation = [
            f"Histórico de acertos contribuiu com {factors['historical_accuracy']:.2f}",
            f"Score de padrões relevantes em {factors['pattern_score']:.2f}",
            f"Frequência histórica de {predicted_event.lower()} em {factors['historical_frequency']:.2f}",
            f"Backtesting aponta {factors['backtesting_accuracy']:.2f} de confiança média",
        ]

        return {
            "confidence": confidence,
            "reliability": reliability,
            "risk_level": risk_level,
            "explanation": explanation,
            "factors": factors,
        }

    @staticmethod
    def _predicted_frequency(predicted_event: str, statistics: dict[str, dict[str, Any]], total_events: int) -> float:
        if predicted_event == "DEVEDOR":
            value = float(statistics["freq_devedores"]["value"])
        elif predicted_event == "PAGADOR":
            value = float(statistics["freq_pagadores"]["value"])
        else:
            value = 0.0
        return min(100.0, (value / total_events) * 100.0)

    @staticmethod
    def _relevant_pattern_score(predicted_event: str, pattern_scores: list[dict[str, Any]]) -> float:
        scores = [
            float(pattern["score"])
            for pattern in pattern_scores
            if predicted_event.lower() in str(pattern.get("name", "")).lower()
        ]
        if not scores and pattern_scores:
            scores = [float(pattern["score"]) for pattern in pattern_scores]
        return sum(scores) / len(scores) if scores else 0.0

    @staticmethod
    def _regime_score(predicted_event: str, regimes: list[dict[str, Any]]) -> float:
        for regime in regimes:
            name = str(regime.get("name", "")).lower()
            if predicted_event.lower() in name:
                return min(100.0, float(regime.get("score", 0.0)) * 100.0)
        return min(100.0, float(regimes[0].get("score", 0.0)) * 100.0) if regimes else 0.0

    @staticmethod
    def _distance_factor(average_distance: float) -> float:
        return max(0.0, min(100.0, 100.0 - (average_distance * 10.0)))

    @staticmethod
    def _temporal_stability(average_time_gap: float, sequence: list[str]) -> float:
        sequence_bonus = min(20.0, len(sequence) * 4.0)
        gap_factor = max(0.0, 100.0 - abs(60.0 - average_time_gap))
        return max(0.0, min(100.0, gap_factor * 0.8 + sequence_bonus))