from __future__ import annotations

from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.consensus_engine import ConsensusEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.probability_engine import ProbabilityEngine
from app.laboratory.risk_engine import RiskEngine
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.trend_engine import TrendEngine


class SignalEngine:
    """Builds actionable entry signals from Laboratory analytical components."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        probability_engine: ProbabilityEngine | None = None,
        risk_engine: RiskEngine | None = None,
        consensus_engine: ConsensusEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.probability_engine = probability_engine or ProbabilityEngine(self.laboratory_engine)
        self.risk_engine = risk_engine or RiskEngine(self.laboratory_engine)
        self.consensus_engine = consensus_engine or ConsensusEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def build_signal_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "signal": "WAIT",
                "signal_strength": 0.0,
                "probability": 0.0,
                "confidence": 0.0,
                "risk": 0.0,
                "recommendation": "Aguardar histórico para gerar sinal operacional",
                "explanation": ["Sem histórico suficiente para construir sinal"],
            }

        trend = self.trend_engine.build_trend_report()
        probability_report = self.probability_engine.build_probability_report()
        risk_report = self.risk_engine.build_risk_report()
        consensus_report = self.consensus_engine.build_consensus_report()
        confidence_report = self.confidence_engine.assess_prediction(
            {"predicted_event": trend.get("trend_direction", "NEUTRO")}
        )
        seasonality_report = self.seasonality_engine.build_seasonality_report()
        correlation_report = self.correlation_engine.build_correlation_report()
        backtest_report = self.backtesting_engine.run_backtest()

        probability = float(probability_report.get("risk_adjusted_probability", 0.0))
        risk = float(risk_report.get("risk_score", 0.0))

        correlations = correlation_report.get("correlations", [])
        correlation_strength = self._average([float(item.get("strength", 0.0)) for item in correlations[:10]])
        consensus_score = float(consensus_report.get("consensus_score", 0.0))
        base_confidence = float(confidence_report.get("confidence", 0.0))
        probability_confidence = float(probability_report.get("confidence", 0.0))
        consensus_confidence = float(consensus_report.get("confidence", 0.0))
        backtesting_confidence = float(backtest_report.get("average_confidence", 0.0))
        trend_confidence = float(trend.get("confidence", 0.0))
        seasonality_confidence = float(seasonality_report.get("confidence", 0.0))

        confidence = (
            base_confidence * 0.35
            + probability_confidence * 0.25
            + consensus_confidence * 0.15
            + backtesting_confidence * 0.15
            + (self._average([trend_confidence, seasonality_confidence]) * 0.1)
        )
        confidence = round(max(0.0, min(100.0, confidence)), 2)

        signal_strength = (
            probability * 0.35
            + confidence * 0.25
            + (100.0 - risk) * 0.2
            + consensus_score * 0.1
            + correlation_strength * 0.1
        )
        signal_strength = round(max(0.0, min(100.0, signal_strength)), 2)

        signal = "WAIT"
        recommendation = "Aguardar melhor alinhamento entre probabilidade e risco"

        if risk >= 70.0 or probability < 40.0:
            signal = "AVOID"
            recommendation = "Evitar entrada no momento devido ao risco elevado"
        elif signal_strength >= 60.0 and probability >= 55.0 and confidence >= 50.0 and risk < 60.0:
            signal = "ENTER"
            recommendation = "Entrada favorável com risco controlado"

        explanation = [
            f"Probabilidade ajustada ao risco em {probability:.2f}",
            f"Confiança consolidada em {confidence:.2f}",
            f"Risco agregado em {risk:.2f}",
            f"Força do sinal calculada em {signal_strength:.2f}",
            f"Consenso atual em {consensus_score:.2f}",
        ]

        return {
            "signal": signal,
            "signal_strength": signal_strength,
            "probability": round(probability, 2),
            "confidence": confidence,
            "risk": round(risk, 2),
            "recommendation": recommendation,
            "explanation": explanation,
        }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)