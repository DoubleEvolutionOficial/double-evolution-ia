from __future__ import annotations

from typing import Iterable

from app.core.base_rule import BaseRule, RuleEvaluationResult
from app.core.decision_engine import DecisionEngine
from app.rules.registry import get_registered_rules


class RuleEngine:
    """Engine responsible for orchestrating active rule evaluations."""

    def __init__(self, rules: Iterable[BaseRule] | None = None) -> None:
        if rules is None:
            import app.rules  # Register all rule implementations when engine starts.
            self._rules = get_registered_rules()
        else:
            self._rules = list(rules)

    @property
    def active_rules(self) -> list[BaseRule]:
        return [rule for rule in self._rules if rule.active]

    def evaluate(self, context: dict[str, object] | None = None) -> dict[str, object]:
        context = context or {}
        results: list[RuleEvaluationResult] = []
        total_score = 0.0
        total_weight = 0.0

        for rule in self.active_rules:
            rule_score = rule.evaluate(context)
            results.append(rule.to_result(rule_score))
            total_score += rule_score * rule.weight
            total_weight += rule.weight

        confidence = total_score / total_weight if total_weight > 0 else 0.0

        return {
            "score": total_score,
            "confidence": confidence,
            "rules": [result.to_dict() for result in results],
        }

    def decide(self, context: dict[str, object] | None = None) -> dict[str, object]:
        evaluation = self.evaluate(context)
        return DecisionEngine().decide(evaluation["rules"])

    def user_summary(self, context: dict[str, object] | None = None) -> dict[str, object]:
        evaluation = self.evaluate(context)
        return DecisionEngine().user_summary(evaluation["rules"])

    def admin_report(self, context: dict[str, object] | None = None) -> dict[str, object]:
        evaluation = self.evaluate(context)
        return DecisionEngine().admin_report(evaluation["rules"])
