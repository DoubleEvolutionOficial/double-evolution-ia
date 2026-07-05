from fastapi import APIRouter, Query

from app.core import (
    UserRole,
    public_analysis_response,
    admin_analysis_response,
)
from app.core.analysis_view import RuleDetail

router = APIRouter(tags=["analysis"])


@router.get("/analysis")
async def analysis_view(
    user_role: UserRole = Query(UserRole.USER, description="Perfil do usuário que solicita a análise")
):
    """Retorna a visualização adequada de análise com base no perfil do usuário."""
    if user_role == UserRole.ADMIN:
        return admin_analysis_response(
            score=0.0,
            confidence=0.0,
            status="pending",
            strength=0.0,
            risk="unknown",
            rules=[
                RuleDetail(
                    rule_code="REG-001",
                    matched=False,
                    score=0.0,
                    weight=1.0,
                    reason="placeholder",
                )
            ],
            statistics={"total_rules": 0, "active_rules": 0},
            technical_details={"method": "protected"},
        )

    return public_analysis_response(
        status="pending",
        confidence=0.0,
        strength=0.0,
        risk="unknown",
    )
