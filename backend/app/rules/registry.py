from __future__ import annotations

from typing import List

from app.core.base_rule import BaseRule


_rule_registry: List[BaseRule] = []


def register_rule(rule: BaseRule) -> BaseRule:
    """Register a rule instance for the engine to discover."""
    _rule_registry.append(rule)
    return rule


def get_registered_rules() -> List[BaseRule]:
    """Return copy of registered rules for evaluation."""
    return list(_rule_registry)
