from __future__ import annotations

RULE_WEIGHTS: dict[str, float] = {
    "REG-001": 1.0,
    "REG-002": 1.0,
    "REG-003": 0.5,
}


def get_rule_weight(rule_id: str | None, default_weight: float = 1.0) -> float:
    if not rule_id:
        return default_weight
    return RULE_WEIGHTS.get(rule_id, default_weight)
