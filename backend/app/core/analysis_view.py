from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class PublicAnalysisResponse(BaseModel):
    status: str
    confidence: float
    strength: float
    risk: str


class RuleDetail(BaseModel):
    rule_code: str
    matched: bool
    score: float
    weight: float
    reason: str


class AdminAnalysisResponse(BaseModel):
    score: float
    confidence: float
    status: str
    strength: float
    risk: str
    rules: list[RuleDetail]
    statistics: dict[str, float]
    technical_details: dict[str, Any]


def public_analysis_response(
    status: str,
    confidence: float,
    strength: float,
    risk: str,
) -> PublicAnalysisResponse:
    return PublicAnalysisResponse(
        status=status,
        confidence=confidence,
        strength=strength,
        risk=risk,
    )


def admin_analysis_response(
    score: float,
    confidence: float,
    status: str,
    strength: float,
    risk: str,
    rules: list[RuleDetail],
    statistics: dict[str, float],
    technical_details: dict[str, Any],
) -> AdminAnalysisResponse:
    return AdminAnalysisResponse(
        score=score,
        confidence=confidence,
        status=status,
        strength=strength,
        risk=risk,
        rules=rules,
        statistics=statistics,
        technical_details=technical_details,
    )
