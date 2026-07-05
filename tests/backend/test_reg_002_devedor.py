from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.rule_engine import RuleEngine


def test_devedor_rule_scores_based_on_distance_from_previous_blank():
    engine = RuleEngine()
    context = {
        "values": [0, 1, 2, 3, 4, 0]
    }

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-002")

    assert result["score"] == 5.0
    assert rule_data["metadata"]["debt_records"][0]["distance_from_last_blank"] == 5
    assert rule_data["metadata"]["debt_records"][0]["weight"] == 1.0
    assert rule_data["metadata"]["debt_records"][0]["score"] == 5.0


def test_devedor_rule_uses_higher_weight_for_larger_distance():
    engine = RuleEngine()
    context = {
        "values": [0, 1, 2, 3, 4, 5, 0]
    }

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-002")

    assert result["score"] == 9.0
    assert rule_data["metadata"]["debt_records"][0]["distance_from_last_blank"] == 6
    assert rule_data["metadata"]["debt_records"][0]["weight"] == 1.5


def test_devedor_rule_ignores_distances_outside_5_6_7():
    engine = RuleEngine()
    context = {
        "values": [0, 1, 2, 3, 0]
    }

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-002")

    # REG-002 should have no debt records for distance 4 (outside 5-6-7 range)
    assert rule_data["metadata"]["debt_records"] == []
    # REG-002 score should be 0, but total score includes other rules like REG-003
    assert rule_data["score"] == 0.0
