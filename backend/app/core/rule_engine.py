from __future__ import annotations

from typing import Iterable

from app.core.base_rule import BaseRule, RuleEvaluationResult
from app.rules.registry import get_registered_rules


class RuleEngine:
    """Engine responsible for orchestrating active rule evaluations."""

    def __init__(self, rules: Iterable[BaseRule] | None = None) -> None:
        self._rules = list(rules) if rules is not None else get_registered_rules()

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
