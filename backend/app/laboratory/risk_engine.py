from __future__ import annotations

from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.consensus_engine import ConsensusEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.trend_engine import TrendEngine


class RiskEngine:
    """Calculates aggregate risk using Laboratory-only analytical engines."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        consensus_engine: ConsensusEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.consensus_engine = consensus_engine or ConsensusEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def build_risk_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "risk_score": 0.0,
                "exposure_level": "baixo",
                "stability": 0.0,
                "volatility": 0.0,
                "uncertainty": 100.0,
                "recommendation": "Aguardar histórico para avaliação de risco",
            }

        consensus = self.consensus_engine.build_consensus_report()
        confidence = self.confidence_engine.assess_prediction({"predicted_event": "NEUTRO"})
        correlations = self.correlation_engine.build_correlation_report()["correlations"]
        trend = self.trend_engine.build_trend_report()
        seasonality = self.seasonality_engine.build_seasonality_report()
        pattern_scores = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()
        backtest = self.backtesting_engine.run_backtest()

        stability = self._stability(consensus, confidence, backtest, seasonality)
        volatility = self._volatility(correlations, trend, pattern_scores, regimes)
        uncertainty = self._uncertainty(confidence, consensus, backtest)

        risk_score = round(max(0.0, min(100.0, (volatility * 0.45) + (uncertainty * 0.35) + ((100.0 - stability) * 0.2))), 2)

        if risk_score >= 70.0:
            exposure_level = "alto"
            recommendation = "Reduzir exposição e aguardar confirmação adicional"
        elif risk_score >= 40.0:
            exposure_level = "médio"
            recommendation = "Operar com proteção e monitoramento contínuo"
        else:
            exposure_level = "baixo"
            recommendation = "Condições estáveis para exposição controlada"

        return {
            "risk_score": risk_score,
            "exposure_level": exposure_level,
            "stability": round(stability, 2),
            "volatility": round(volatility, 2),
            "uncertainty": round(uncertainty, 2),
            "recommendation": recommendation,
        }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)

    def _stability(
        self,
        consensus: dict[str, Any],
        confidence: dict[str, Any],
        backtest: dict[str, Any],
        seasonality: dict[str, Any],
    ) -> float:
        return max(
            0.0,
            min(
                100.0,
                (float(consensus.get("consensus_score", 0.0)) * 0.35)
                + (float(confidence.get("confidence", 0.0)) * 0.35)
                + (float(backtest.get("average_confidence", 0.0)) * 0.2)
                + (float(seasonality.get("confidence", 0.0)) * 0.1),
            ),
        )

    def _volatility(
        self,
        correlations: list[dict[str, Any]],
        trend: dict[str, Any],
        pattern_scores: list[dict[str, Any]],
        regimes: list[dict[str, Any]],
    ) -> float:
        correlation_strength = self._average([float(item.get("strength", 0.0)) for item in correlations])
        pattern_risk = self._average([float(item.get("risk", "médio") == "alto") * 100.0 for item in pattern_scores])
        regime_pressure = self._average([float(item.get("score", 0.0)) * 100.0 for item in regimes])
        trend_instability = 100.0 - float(trend.get("confidence", 0.0))

        return max(
            0.0,
            min(
                100.0,
                ((100.0 - correlation_strength) * 0.3)
                + (pattern_risk * 0.25)
                + (regime_pressure * 0.2)
                + (trend_instability * 0.25),
            ),
        )

    def _uncertainty(
        self,
        confidence: dict[str, Any],
        consensus: dict[str, Any],
        backtest: dict[str, Any],
    ) -> float:
        confidence_gap = 100.0 - float(confidence.get("confidence", 0.0))
        consensus_gap = 100.0 - float(consensus.get("confidence", 0.0))
        backtest_gap = 100.0 - (float(backtest.get("accuracy", 0.0)) * 100.0)

        return max(
            0.0,
            min(
                100.0,
                (confidence_gap * 0.4) + (consensus_gap * 0.35) + (backtest_gap * 0.25),
            ),
        )