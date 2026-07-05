from __future__ import annotations

from typing import Any

from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_discovery import PatternDiscovery


class PatternScore:
    """Scores discovered patterns based on historical frequency, recency, stability and confidence."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None, pattern_discovery: PatternDiscovery | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.pattern_discovery = pattern_discovery or PatternDiscovery(self.laboratory_engine)

    def score_patterns(self) -> list[dict[str, Any]]:
        patterns = self.pattern_discovery.discover_patterns()
        scored: list[dict[str, Any]] = []

        for pattern in patterns:
            frequency = float(pattern.get("occurrences", 0))
            confidence = float(pattern.get("confidence", 0.0))
            recency = self._recency_score(pattern)
            stability = self._stability_score(pattern)
            consecutive = self._consecutive_score(pattern)
            statistical_confidence = self._statistical_confidence(frequency, confidence)

            score = round(min(100.0, (frequency * 12.5) + (confidence * 20.0) + recency + stability + consecutive + statistical_confidence), 2)
            strength = self._strength(score)
            recommendation = self._recommendation(score, strength)
            risk = self._risk(score)

            scored.append({
                "name": pattern.get("name"),
                "score": score,
                "confidence": confidence,
                "strength": strength,
                "recommendation": recommendation,
                "risk": risk,
            })

        return scored

    @staticmethod
    def _recency_score(pattern: dict[str, Any]) -> float:
        return 10.0

    @staticmethod
    def _stability_score(pattern: dict[str, Any]) -> float:
        occurrences = float(pattern.get("occurrences", 0))
        return min(20.0, occurrences * 5.0)

    @staticmethod
    def _consecutive_score(pattern: dict[str, Any]) -> float:
        occurrences = float(pattern.get("occurrences", 0))
        return min(15.0, occurrences * 3.0)

    @staticmethod
    def _statistical_confidence(frequency: float, confidence: float) -> float:
        return min(25.0, (frequency * 2.0) + (confidence * 10.0))

    @staticmethod
    def _strength(score: float) -> str:
        if score >= 80:
            return "alto"
        if score >= 50:
            return "médio"
        return "baixo"

    @staticmethod
    def _recommendation(score: float, strength: str) -> str:
        if score >= 80:
            return "Monitorar com atenção"
        if score >= 50:
            return "Acompanhar evolução"
        return "Manter observação"

    @staticmethod
    def _risk(score: float) -> str:
        if score >= 80:
            return "alto"
        if score >= 50:
            return "médio"
        return "baixo"
