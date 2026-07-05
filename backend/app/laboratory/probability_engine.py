from __future__ import annotations

from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.consensus_engine import ConsensusEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.risk_engine import RiskEngine
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.trend_engine import TrendEngine


class ProbabilityEngine:
    """Combines Laboratory analytical engines into a unified probability output."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        consensus_engine: ConsensusEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        risk_engine: RiskEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        pattern_score: PatternScore | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.consensus_engine = consensus_engine or ConsensusEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.risk_engine = risk_engine or RiskEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def build_probability_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "probability": 0.0,
                "confidence": 0.0,
                "reliability": "baixa",
                "expected_accuracy": 0.0,
                "risk_adjusted_probability": 0.0,
                "explanation": ["Sem histórico para cálculo probabilístico"],
            }

        consensus = self.consensus_engine.build_consensus_report()
        confidence = self.confidence_engine.assess_prediction({"predicted_event": "NEUTRO"})
        risk = self.risk_engine.build_risk_report()
        correlations = self.correlation_engine.build_correlation_report()["correlations"]
        trend = self.trend_engine.build_trend_report()
        seasonality = self.seasonality_engine.build_seasonality_report()
        pattern_scores = self.pattern_score.score_patterns()
        backtest = self.backtesting_engine.run_backtest()

        consensus_score = float(consensus.get("consensus_score", 0.0))
        confidence_score = float(confidence.get("confidence", 0.0))
        risk_score = float(risk.get("risk_score", 0.0))
        correlation_score = self._average([float(item.get("strength", 0.0)) for item in correlations[:10]])
        trend_score = float(trend.get("confidence", 0.0))
        seasonality_score = float(seasonality.get("confidence", 0.0))
        pattern_signal = self._average([float(item.get("score", 0.0)) for item in pattern_scores])
        expected_accuracy = float(backtest.get("accuracy", 0.0)) * 100.0

        probability = (
            consensus_score * 0.2
            + confidence_score * 0.2
            + correlation_score * 0.1
            + trend_score * 0.15
            + seasonality_score * 0.1
            + pattern_signal * 0.1
            + expected_accuracy * 0.15
        )
        probability = round(max(0.0, min(100.0, probability)), 2)

        risk_adjusted_probability = round(max(0.0, min(100.0, probability * (1.0 - (risk_score / 100.0)))), 2)

        confidence_out = round(max(0.0, min(100.0, (confidence_score * 0.6) + (correlation_score * 0.2) + (expected_accuracy * 0.2))), 2)
        if confidence_out >= 75.0:
            reliability = "alta"
        elif confidence_out >= 45.0:
            reliability = "média"
        else:
            reliability = "baixa"

        explanation = [
            f"Consenso contribuiu com {consensus_score:.2f}",
            f"Confiança consolidada em {confidence_score:.2f}",
            f"Risco atual em {risk_score:.2f}",
            f"Acurácia esperada de backtesting em {expected_accuracy:.2f}",
        ]

        return {
            "probability": probability,
            "confidence": confidence_out,
            "reliability": reliability,
            "expected_accuracy": round(expected_accuracy, 2),
            "risk_adjusted_probability": risk_adjusted_probability,
            "explanation": explanation,
        }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)