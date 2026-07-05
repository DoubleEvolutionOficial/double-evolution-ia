from __future__ import annotations

from typing import Any

from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.trend_engine import TrendEngine


class ConsensusEngine:
    """Consolidates Laboratory signals into a consensus output."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)

    def build_consensus_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "consensus_score": 0.0,
                "agreement_level": "baixo",
                "confidence": 0.0,
                "supporting_factors": [],
                "conflicting_factors": [],
                "explanation": ["Sem histórico suficiente para consolidar consenso"],
            }

        trend = self.trend_engine.build_trend_report()
        seasonality = self.seasonality_engine.build_seasonality_report()
        correlations = self.correlation_engine.build_correlation_report()["correlations"]
        pattern_scores = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()
        confidence_assessment = self.confidence_engine.assess_prediction({"predicted_event": trend["trend_direction"]})

        trend_score = float(trend.get("trend_strength", 0.0))
        seasonality_score = float(seasonality.get("seasonality_strength", 0.0))
        correlation_score = self._average([float(item.get("strength", 0.0)) for item in correlations[:8]])
        confidence_score = float(confidence_assessment.get("confidence", 0.0))
        pattern_signal = self._average([float(item.get("score", 0.0)) for item in pattern_scores])
        regime_signal = self._average([float(item.get("score", 0.0)) * 100.0 for item in regimes])

        consensus_score = (
            trend_score * 0.2
            + seasonality_score * 0.15
            + correlation_score * 0.2
            + confidence_score * 0.2
            + pattern_signal * 0.15
            + regime_signal * 0.1
        )
        consensus_score = round(max(0.0, min(100.0, consensus_score)), 2)

        if consensus_score >= 75.0:
            agreement_level = "alto"
        elif consensus_score >= 45.0:
            agreement_level = "médio"
        else:
            agreement_level = "baixo"

        confidence = round(max(0.0, min(100.0, confidence_score * 0.7 + correlation_score * 0.3)), 2)

        supporting_factors = self._supporting_factors(
            trend,
            seasonality,
            correlations,
            confidence_assessment,
            pattern_scores,
            regimes,
        )
        conflicting_factors = self._conflicting_factors(
            trend,
            seasonality,
            correlations,
            confidence_assessment,
        )

        explanation = [
            f"Consenso consolidado com score {consensus_score:.2f}",
            f"Tendência dominante: {trend.get('trend_direction', 'NEUTRO').lower()}",
            f"Sazonalidade dominante: {seasonality.get('dominant_classification', 'NEUTRO').lower()}",
            f"Correlações fortes observadas: {len([c for c in correlations if c.get('strength', 0.0) >= 60.0])}",
        ]

        return {
            "consensus_score": consensus_score,
            "agreement_level": agreement_level,
            "confidence": confidence,
            "supporting_factors": supporting_factors,
            "conflicting_factors": conflicting_factors,
            "explanation": explanation,
        }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)

    def _supporting_factors(
        self,
        trend: dict[str, Any],
        seasonality: dict[str, Any],
        correlations: list[dict[str, Any]],
        confidence_assessment: dict[str, Any],
        pattern_scores: list[dict[str, Any]],
        regimes: list[dict[str, Any]],
    ) -> list[str]:
        supporting: list[str] = []

        if float(trend.get("trend_strength", 0.0)) >= 55.0:
            supporting.append("TrendEngine")
        if float(seasonality.get("seasonality_strength", 0.0)) >= 50.0:
            supporting.append("SeasonalityEngine")
        if any(float(item.get("strength", 0.0)) >= 60.0 for item in correlations):
            supporting.append("CorrelationEngine")
        if float(confidence_assessment.get("confidence", 0.0)) >= 50.0:
            supporting.append("ConfidenceEngine")
        if any(float(item.get("score", 0.0)) >= 60.0 for item in pattern_scores):
            supporting.append("PatternScore")
        if any(float(item.get("score", 0.0)) >= 0.6 for item in regimes):
            supporting.append("RegimeDetector")

        return supporting

    def _conflicting_factors(
        self,
        trend: dict[str, Any],
        seasonality: dict[str, Any],
        correlations: list[dict[str, Any]],
        confidence_assessment: dict[str, Any],
    ) -> list[str]:
        conflicting: list[str] = []

        trend_direction = str(trend.get("trend_direction", "NEUTRO")).lower()
        seasonality_direction = str(seasonality.get("dominant_classification", "NEUTRO")).lower()
        if trend_direction != "neutro" and seasonality_direction != "neutro" and trend_direction != seasonality_direction:
            conflicting.append("TrendEngine vs SeasonalityEngine")

        if self._average([float(item.get("strength", 0.0)) for item in correlations]) < 45.0:
            conflicting.append("CorrelationEngine")

        if float(confidence_assessment.get("confidence", 0.0)) < 45.0:
            conflicting.append("ConfidenceEngine")

        return conflicting