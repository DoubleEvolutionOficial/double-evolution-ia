from __future__ import annotations

from typing import Any

from app.core.base_rule import BaseRule, RuleEvaluationResult
from app.rules.registry import register_rule


class PedraChaveRule(BaseRule):
    def __init__(self) -> None:
        super().__init__(
            id="REG-001",
            name="Pedra Chave",
            description=(
                "Calculates the key stone for each hour by locating the first white "
                "(0), reading the stones immediately before and after it, and "
                "reducing the sum to the 0-14 range."
            ),
            weight=1.0,
            active=True,
        )
        self._group_results: list[dict[str, Any]] = []

    @staticmethod
    def _reduce_to_range(value: int) -> int:
        while value > 14:
            value = sum(int(digit) for digit in str(value))
        return value

    def evaluate(self, context: dict[str, Any] | None = None) -> float:
        context = context or {}
        hourly_groups = context.get("hourly_groups", [])
        self._group_results = []

        if not isinstance(hourly_groups, list):
            return 0.0

        total_score = 0.0
        for group in hourly_groups:
            hour = group.get("hour")
            blank_time = group.get("blank_time")
            values = group.get("values", [])

            if not isinstance(values, list) or 0 not in values:
                continue

            first_blank_index = values.index(0)
            if first_blank_index == 0 or first_blank_index == len(values) - 1:
                continue

            left_value = values[first_blank_index - 1]
            right_value = values[first_blank_index + 1]
            raw_sum = left_value + right_value
            pedra_chave = self._reduce_to_range(raw_sum)

            group_result = {
                "hora": hour,
                "horario_primeiro_branco": blank_time,
                "pedra_esquerda": left_value,
                "pedra_direita": right_value,
                "soma": raw_sum,
                "pedra_chave": pedra_chave,
            }
            self._group_results.append(group_result)
            total_score += pedra_chave

        return total_score

    def to_result(self, score: float) -> RuleEvaluationResult:
        result = super().to_result(score)
        result.metadata["groups"] = self._group_results
        return result


pedra_chave_rule = register_rule(PedraChaveRule())
