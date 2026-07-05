from __future__ import annotations

from typing import Any

from app.core.base_rule import BaseRule, RuleEvaluationResult
from app.rules.registry import register_rule


class PagadoresRule(BaseRule):
    def __init__(self) -> None:
        super().__init__(
            id="REG-003",
            name="Pagadores",
            description=(
                "Detects debtor payment patterns by analyzing spacing between blanks: "
                "Duplo (0 spacing), Dentado (1 stone), Banguelo (2 stones), "
                "Banguelão (3 stones). Auxiliary confirmatory rule."
            ),
            weight=0.5,
            active=True,
        )
        self._payment_records: list[dict[str, Any]] = []

    @staticmethod
    def _get_pattern_name(spacing: int) -> str | None:
        patterns = {
            0: "Duplo",
            1: "Dentado",
            2: "Banguelo",
            3: "Banguelão",
        }
        return patterns.get(spacing)

    @staticmethod
    def _get_pattern_score(spacing: int) -> float:
        scores = {
            0: 2.0,
            1: 1.5,
            2: 1.0,
            3: 0.5,
        }
        return scores.get(spacing, 0.0)

    def evaluate(self, context: dict[str, Any] | None = None) -> float:
        context = context or {}
        values = context.get("values", [])
        self._payment_records = []

        if not isinstance(values, list):
            return 0.0

        blank_indices = [i for i, v in enumerate(values) if v == 0]
        if len(blank_indices) < 2:
            return 0.0

        total_score = 0.0
        for i in range(len(blank_indices) - 1):
            current_blank = blank_indices[i]
            next_blank = blank_indices[i + 1]
            spacing = next_blank - current_blank - 1

            if spacing not in [0, 1, 2, 3]:
                continue

            pattern_name = self._get_pattern_name(spacing)
            pattern_score = self._get_pattern_score(spacing)
            total_score += pattern_score

            self._payment_records.append(
                {
                    "blank_1_index": current_blank + 1,
                    "blank_2_index": next_blank + 1,
                    "spacing": spacing,
                    "pattern": pattern_name,
                    "score": pattern_score,
                }
            )

        return total_score

    def to_result(self, score: float) -> RuleEvaluationResult:
        result = super().to_result(score)
        result.metadata["payment_patterns"] = self._payment_records
        return result


pagadores_rule = register_rule(PagadoresRule())
