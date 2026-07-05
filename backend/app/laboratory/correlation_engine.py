from __future__ import annotations

from itertools import combinations
from typing import Any

from app.laboratory.backtesting_engine import BacktestingEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_discovery import PatternDiscovery
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.trend_engine import TrendEngine


class CorrelationEngine:
    """Calculates factor correlations using Laboratory-only signals."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        regime_detector: RegimeDetector | None = None,
        pattern_discovery: PatternDiscovery | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        backtesting_engine: BacktestingEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.pattern_discovery = pattern_discovery or PatternDiscovery(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.backtesting_engine = backtesting_engine or BacktestingEngine(self.laboratory_engine)

    def build_correlation_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        snapshot = self._factor_snapshot()
        if not events:
            return {
                "factor_snapshot": snapshot,
                "correlations": [],
            }

        occurrences = len(events)
        correlations: list[dict[str, Any]] = []
        for factor_a, factor_b in combinations(snapshot.keys(), 2):
            value_a = snapshot[factor_a]
            value_b = snapshot[factor_b]
            strength = self._strength(value_a, value_b)
            confidence = self._confidence(strength, occurrences)
            correlations.append(
                {
                    "factor_a": factor_a,
                    "factor_b": factor_b,
                    "strength": strength,
                    "confidence": confidence,
                    "occurrences": occurrences,
                    "explanation": f"Correlação entre {factor_a} ({value_a}) e {factor_b} ({value_b})",
                }
            )

        correlations.sort(key=lambda item: item["strength"], reverse=True)
        return {
            "factor_snapshot": snapshot,
            "correlations": correlations,
        }

    def _factor_snapshot(self) -> dict[str, Any]:
        regimes = self.regime_detector.detect_regimes()
        patterns = self.pattern_discovery.discover_patterns()
        trend = self.trend_engine.build_trend_report()
        seasonality = self.seasonality_engine.build_seasonality_report()
        backtest = self.backtesting_engine.run_backtest()

        regime_name = "NEUTRO"
        if regimes:
            regime_name = str(regimes[0].get("name", "NEUTRO"))
        if "neutro" in regime_name.lower():
            regime_name = "NEUTRO"

        pattern_name = "SEM_PADRAO"
        if patterns:
            pattern_name = str(patterns[0].get("name", "SEM_PADRAO"))

        predicted_result = "NEUTRO"
        if backtest["results"]:
            predicted_result = str(backtest["results"][-1].get("predicted_event", "NEUTRO"))

        hit_miss = "ACERTO" if backtest.get("accuracy", 0.0) >= 0.5 else "ERRO"

        return {
            "regime": regime_name,
            "pattern": pattern_name,
            "side": seasonality.get("dominant_side", "indefinido"),
            "minute_final": seasonality.get("dominant_minute_final"),
            "hour": seasonality.get("dominant_hour"),
            "trend": trend.get("trend_direction", "NEUTRO"),
            "seasonality": seasonality.get("dominant_classification", "NEUTRO"),
            "predicted_result": predicted_result,
            "hit_miss": hit_miss,
        }

    @staticmethod
    def _strength(value_a: Any, value_b: Any) -> float:
        text_a = str(value_a).lower()
        text_b = str(value_b).lower()
        if text_a == text_b:
            return 90.0

        aligned_tokens = {"devedor", "pagador", "neutro", "left", "right", "acerto", "erro"}
        token_hits = sum(1 for token in aligned_tokens if token in text_a and token in text_b)
        base = 35.0 if value_a is not None and value_b is not None else 10.0
        return round(max(0.0, min(100.0, base + (token_hits * 15.0))), 2)

    @staticmethod
    def _confidence(strength: float, occurrences: int) -> float:
        coverage = min(100.0, occurrences * 10.0)
        return round(max(0.0, min(100.0, (strength * 0.7) + (coverage * 0.3))), 2)