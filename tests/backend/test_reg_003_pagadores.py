from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.rule_engine import RuleEngine


def test_pagadores_detects_duplo_pattern():
    engine = RuleEngine()
    context = {"values": [1, 0, 0, 2]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    assert result["score"] == 1.0
    assert rule_data["metadata"]["payment_patterns"][0]["pattern"] == "Duplo"
    assert rule_data["metadata"]["payment_patterns"][0]["score"] == 2.0


def test_pagadores_detects_dentado_pattern():
    engine = RuleEngine()
    context = {"values": [1, 0, 2, 0, 3]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    assert result["score"] > 0
    pattern = rule_data["metadata"]["payment_patterns"][0]
    assert pattern["pattern"] == "Dentado"
    assert pattern["score"] == 1.5


def test_pagadores_detects_banguelo_pattern():
    engine = RuleEngine()
    context = {"values": [1, 0, 2, 3, 0, 4]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    pattern = rule_data["metadata"]["payment_patterns"][0]
    assert pattern["pattern"] == "Banguelo"
    assert pattern["score"] == 1.0


def test_pagadores_detects_banguelao_pattern():
    engine = RuleEngine()
    context = {"values": [1, 0, 2, 3, 4, 0, 5]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    pattern = rule_data["metadata"]["payment_patterns"][0]
    assert pattern["pattern"] == "Banguelão"
    assert pattern["score"] == 0.5


def test_pagadores_ignores_invalid_spacing():
    engine = RuleEngine()
    context = {"values": [1, 0, 2, 3, 4, 5, 0, 6]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    assert rule_data["metadata"]["payment_patterns"] == []


def test_pagadores_detects_multiple_patterns():
    engine = RuleEngine()
    context = {"values": [0, 1, 0, 2, 3, 0]}

    result = engine.evaluate(context)
    rule_data = next(rule for rule in result["rules"] if rule["id"] == "REG-003")

    assert len(rule_data["metadata"]["payment_patterns"]) == 2
