"""Rule discovery and registration package."""

from app.rules.registry import get_registered_rules, register_rule

__all__ = ["get_registered_rules", "register_rule"]
