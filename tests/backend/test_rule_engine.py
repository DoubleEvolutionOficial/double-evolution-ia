from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.rule_engine import RuleEngine


def test_rule_engine_returns_zero_when_no_rules():
    engine = RuleEngine([])
    result = engine.evaluate()

    assert result == {
        "score": 0.0,
        "confidence": 0.0,
        "rules": [],
    }
