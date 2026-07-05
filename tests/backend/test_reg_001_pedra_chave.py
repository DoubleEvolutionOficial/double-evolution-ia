from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.rule_engine import RuleEngine


def test_pedra_chave_rule_reduces_sum_above_14():
    engine = RuleEngine()
    context = {
        "hourly_groups": [
            {
                "hour": "10:00",
                "blank_time": "10:12",
                "values": [9, 0, 8],
            }
        ]
    }

    result = engine.evaluate(context)

    assert result["score"] == 8.0
    assert result["rules"][0]["id"] == "REG-001"
    metadata = result["rules"][0]["metadata"]["groups"][0]
    assert metadata["hora"] == "10:00"
    assert metadata["horario_primeiro_branco"] == "10:12"
    assert metadata["pedra_esquerda"] == 9
    assert metadata["pedra_direita"] == 8
    assert metadata["soma"] == 17
    assert metadata["pedra_chave"] == 8


def test_pedra_chave_rule_aggregates_multiple_hours():
    engine = RuleEngine()
    context = {
        "hourly_groups": [
            {
                "hour": "09:00",
                "blank_time": "09:07",
                "values": [4, 0, 7],
            },
            {
                "hour": "11:00",
                "blank_time": "11:15",
                "values": [3, 5, 0, 6],
            },
        ]
    }

    result = engine.evaluate(context)

    assert result["score"] == 22.0
    assert len(result["rules"][0]["metadata"]["groups"]) == 2
