from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.decision_engine import DecisionEngine
from app.core.rule_engine import RuleEngine


def test_decision_engine_classifies_confidence_ranges():
    decision_engine = DecisionEngine()

    results = [
        {"id": "REG-001", "score": 2.0, "matched": True, "confidence": 20.0, "reason": "low"},
        {"id": "REG-002", "score": 3.0, "matched": False, "confidence": 0.0, "reason": "none"},
    ]

    decision = decision_engine.decide(results)

    assert decision["score"] == 5.0
    assert decision["confidence"] == 10.0
    assert decision["status"] == "DESFAVORÁVEL"
    assert decision["risk"] == "DESFAVORÁVEL"


def test_decision_engine_applies_rule_weights():
    decision_engine = DecisionEngine()

    results = [
        {"id": "REG-001", "score": 4.0, "matched": True, "confidence": 80.0, "reason": "ok"},
        {"id": "REG-002", "score": 2.0, "matched": True, "confidence": 100.0, "reason": "ok"},
    ]

    decision = decision_engine.decide(results)

    assert decision["score"] == 6.0


def test_decision_engine_integration_with_rule_engine():
    engine = RuleEngine()
    decision = engine.decide({
        "hourly_groups": [
            {"hour": "10:00", "blank_time": "10:05", "values": [9, 0, 8]},
        ],
        "values": [0, 1, 2, 3, 4, 0],
    })

    assert "score" in decision
    assert "confidence" in decision
    assert "status" in decision
    assert "risk" in decision
    assert "rules" in decision


def test_decision_engine_user_summary_hides_internal_details():
    engine = RuleEngine()
    summary = engine.user_summary({
        "hourly_groups": [
            {"hour": "10:00", "blank_time": "10:05", "values": [9, 0, 8]},
        ],
        "values": [0, 1, 2, 3, 4, 0],
    })

    assert set(summary.keys()) == {"score", "confidence", "status", "risk"}
