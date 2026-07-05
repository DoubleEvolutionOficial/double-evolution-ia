from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RuleEvaluationResult:
    rule_id: str
    name: str
    description: str
    weight: float
    score: float
    active: bool
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.rule_id,
            "name": self.name,
            "description": self.description,
            "weight": self.weight,
            "score": self.score,
            "active": self.active,
            "metadata": self.metadata,
        }


class BaseRule(ABC):
    """Public contract for evaluation rules."""

    id: str
    name: str
    description: str
    weight: float
    active: bool

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        weight: float = 1.0,
        active: bool = True,
    ) -> None:
        self.id = id
        self.name = name
        self.description = description
        self.weight = weight
        self.active = active

    @abstractmethod
    def evaluate(self, context: dict[str, Any] | None = None) -> float:
        """Execute rule evaluation and return a numeric score."""
        raise NotImplementedError

    def to_result(self, score: float) -> RuleEvaluationResult:
        return RuleEvaluationResult(
            rule_id=self.id,
            name=self.name,
            description=self.description,
            weight=self.weight,
            score=score,
            active=self.active,
        )
