from __future__ import annotations

from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.consensus_engine import ConsensusEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.explainability_engine import ExplainabilityEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.probability_engine import ProbabilityEngine
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.risk_engine import RiskEngine
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.signal_engine import SignalEngine
from app.laboratory.statistics_engine import StatisticsEngine
from app.laboratory.trend_engine import TrendEngine


class DecisionPipeline:
    """Executes a full Laboratory analysis pipeline and returns one final payload."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        statistics_engine: StatisticsEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        probability_engine: ProbabilityEngine | None = None,
        risk_engine: RiskEngine | None = None,
        consensus_engine: ConsensusEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        signal_engine: SignalEngine | None = None,
        explainability_engine: ExplainabilityEngine | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.probability_engine = probability_engine or ProbabilityEngine(self.laboratory_engine)
        self.risk_engine = risk_engine or RiskEngine(self.laboratory_engine)
        self.consensus_engine = consensus_engine or ConsensusEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.signal_engine = signal_engine or SignalEngine(self.laboratory_engine)
        self.explainability_engine = explainability_engine or ExplainabilityEngine(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def run(self) -> dict[str, Any]:
        # History -> Statistics
        statistics = self.statistics_engine.build_summary()

        # Statistics -> PatternScore
        patterns = self.pattern_score.score_patterns()

        # PatternScore -> RegimeDetector
        regime = self.regime_detector.detect_regimes()

        # RegimeDetector -> TrendEngine
        trend = self.trend_engine.build_trend_report()

        # TrendEngine -> SeasonalityEngine
        seasonality = self.seasonality_engine.build_seasonality_report()

        # SeasonalityEngine -> CorrelationEngine
        correlation = self.correlation_engine.build_correlation_report()

        # CorrelationEngine -> ProbabilityEngine
        probability = self.probability_engine.build_probability_report()

        # ProbabilityEngine -> RiskEngine
        risk = self.risk_engine.build_risk_report()

        # RiskEngine -> ConsensusEngine
        consensus = self.consensus_engine.build_consensus_report()

        # ConsensusEngine -> ConfidenceEngine
        confidence = self.confidence_engine.assess_prediction(
            {"predicted_event": trend.get("trend_direction", "NEUTRO")}
        )

        # ConfidenceEngine -> SignalEngine
        signal = self.signal_engine.build_signal_report()

        # SignalEngine -> ExplainabilityEngine
        explanation = self.explainability_engine.build_explainability_report()

        # Mandatory Laboratory component usage for full pipeline closure.
        backtesting = self.backtesting_engine.run_backtest()
        explanation = {
            **explanation,
            "backtesting_context": {
                "accuracy": backtesting.get("accuracy", 0.0),
                "average_confidence": backtesting.get("average_confidence", 0.0),
                "total_predictions": backtesting.get("total_predictions", 0),
            },
        }

        return {
            "statistics": statistics,
            "patterns": patterns,
            "regime": regime,
            "trend": trend,
            "seasonality": seasonality,
            "correlation": correlation,
            "probability": probability,
            "risk": risk,
            "consensus": consensus,
            "confidence": confidence,
            "signal": signal,
            "explanation": explanation,
        }