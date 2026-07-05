from __future__ import annotations

from typing import Any

from app.core.base_rule import BaseRule, RuleEvaluationResult
from app.rules.registry import register_rule


class DevedorRule(BaseRule):
    def __init__(self) -> None:
        super().__init__(
            id="REG-002",
            name="Devedor",
            description=(
                "Detects when a blank is in debt by measuring the distance from the last "
                "blank and giving higher weight to distances of 5, 6 and 7 positions."
            ),
            weight=1.0,
            active=True,
        )
        self._debt_records: list[dict[str, Any]] = []

    @staticmethod
    def _distance_weight(distance: int) -> float:
        if distance == 5:
            return 1.0
        if distance == 6:
            return 1.5
        if distance == 7:
            return 2.0
        return 0.0

    def evaluate(self, context: dict[str, Any] | None = None) -> float:
        context = context or {}
        values = context.get("values", [])
        self._debt_records = []

        if not isinstance(values, list):
            return 0.0

        previous_blank = None
        total_score = 0.0

        for index, value in enumerate(values):
            if value != 0:
                continue

            if previous_blank is not None:
                distance = index - previous_blank
                weight = self._distance_weight(distance)
                if weight > 0:
                    score = float(distance * weight)
                    total_score += score
                    self._debt_records.append(
                        {
                            "blank_index": index + 1,
                            "distance_from_last_blank": distance,
                            "weight": weight,
                            "score": score,
                        }
                    )

            previous_blank = index

        return total_score

    def to_result(self, score: float) -> RuleEvaluationResult:
        result = super().to_result(score)
        result.metadata["debt_records"] = self._debt_records
        return result


devedor_rule = register_rule(DevedorRule())
