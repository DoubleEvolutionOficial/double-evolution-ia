from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core import UserRole, public_analysis_response, admin_analysis_response
from app.core.analysis_view import RuleDetail


def test_public_analysis_response_contains_limited_fields():
    response = public_analysis_response(
        status="ok",
        confidence=0.85,
        strength=0.7,
        risk="low",
    )

    assert response.status == "ok"
    assert response.confidence == 0.85
    assert response.strength == 0.7
    assert response.risk == "low"


def test_admin_analysis_response_contains_rules_and_details():
    response = admin_analysis_response(
        score=10.0,
        confidence=0.9,
        status="ok",
        strength=0.7,
        risk="low",
        rules=[
            RuleDetail(
                rule_code="REG-001",
                matched=True,
                score=5.0,
                weight=1.0,
                reason="example",
            )
        ],
        statistics={"total_rules": 1},
        technical_details={"model": "core"},
    )

    assert response.score == 10.0
    assert response.rules[0].rule_code == "REG-001"
    assert response.technical_details["model"] == "core"
    assert UserRole.ADMIN.value == "admin"
