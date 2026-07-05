from __future__ import annotations

from typing import Iterable

from app.core.rule_weights import get_rule_weight


class DecisionEngine:
    """Engine to aggregate rule results into a final decision."""

    STATUS_DESFAVORAVEL = "DESFAVORÁVEL"
    STATUS_AGUARDAR = "AGUARDAR"
    STATUS_FAVORAVEL = "FAVORÁVEL"
    STATUS_CONFIRMACAO = "CONFIRMAÇÃO"

    def decide(self, rule_results: Iterable[dict[str, object]]) -> dict[str, object]:
        rule_results = list(rule_results)
        weighted_scores = []
        confidences = []

        for rule in rule_results:
            score = float(rule.get("score", 0.0))
            weight = get_rule_weight(str(rule.get("id", "")))
            weighted_scores.append(score * weight)
            confidences.append(float(rule.get("confidence", 0.0)))

        total_score = sum(weighted_scores)
        confidence = self._aggregate_confidence(confidences)
        classification = self._classify(confidence)

        return {
            "score": total_score,
            "confidence": confidence,
            "status": classification,
            "risk": classification,
            "rules": rule_results,
        }

    def user_summary(self, rule_results: Iterable[dict[str, object]]) -> dict[str, object]:
        decision = self.decide(rule_results)
        return {
            "score": decision["score"],
            "confidence": decision["confidence"],
            "status": decision["status"],
            "risk": decision["risk"],
        }

    def admin_report(self, rule_results: Iterable[dict[str, object]]) -> dict[str, object]:
        decision = self.decide(rule_results)
        return decision

    @staticmethod
    def _aggregate_confidence(confidences: list[float]) -> float:
        if not confidences:
            return 0.0
        average = sum(confidences) / len(confidences)
        return max(0.0, min(100.0, average))

    def _classify(self, confidence: float) -> str:
        if confidence <= 39.0:
            return self.STATUS_DESFAVORAVEL
        if confidence <= 69.0:
            return self.STATUS_AGUARDAR
        if confidence <= 89.0:
            return self.STATUS_FAVORAVEL
        return self.STATUS_CONFIRMACAO
