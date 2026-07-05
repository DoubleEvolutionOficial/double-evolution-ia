from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.core.rule_engine import RuleEngine


def test_user_view_does_not_receive_rule_details_with_reg_003():
    """Verify UserView never shows rule names, weights, or technical methodology with REG-003 active"""
    engine = RuleEngine()
    context = {"values": [0, 1, 2, 0, 3]}
    
    user_summary = engine.user_summary(context)
    
    # User summary should only contain: score, confidence, status, risk (NO rule details)
    allowed_fields = {"score", "confidence", "status", "risk"}
    assert set(user_summary.keys()) <= allowed_fields
    
    # Should never contain: rule names, rule IDs, weights, technical details
    user_str = str(user_summary)
    assert "REG-001" not in user_str
    assert "REG-002" not in user_str
    assert "REG-003" not in user_str
    assert "Pedra Chave" not in user_str
    assert "Devedor" not in user_str
    assert "Pagadores" not in user_str
    assert "weight" not in user_str.lower()
    assert "technical" not in user_str.lower()


def test_admin_view_receives_full_details_with_reg_003():
    """Verify AdminView shows all rule details including REG-003"""
    engine = RuleEngine()
    context = {"values": [0, 1, 2, 0, 3]}
    
    admin_summary = engine.admin_report(context)
    
    # Admin should have rules array with all active rules
    assert "rules" in admin_summary
    assert isinstance(admin_summary["rules"], list)
    
    # REG-003 should be present
    reg_003_found = any(rule["id"] == "REG-003" for rule in admin_summary["rules"])
    assert reg_003_found, "REG-003 should be in admin report"
    
    # REG-003 should have metadata
    reg_003_rule = next(rule for rule in admin_summary["rules"] if rule["id"] == "REG-003")
    assert "metadata" in reg_003_rule
    assert "payment_patterns" in reg_003_rule["metadata"]


def test_reg_003_does_not_appear_in_user_view():
    """Ensure REG-003 methodology is completely hidden from users"""
    engine = RuleEngine()
    context = {"values": [0, 1, 2, 0, 3, 4, 0]}
    
    user_summary = engine.user_summary(context)
    
    # Should not even hint at rule structure or counts
    user_str = str(user_summary).lower()
    assert "règle" not in user_str  # French for rule
    assert "regra" not in user_str   # Portuguese for rule
    assert "payment" not in user_str
    assert "pattern" not in user_str
    assert "blank" not in user_str
    assert "spacing" not in user_str
