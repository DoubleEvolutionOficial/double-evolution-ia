"""Rule discovery and registration package."""

from app.rules.registry import get_registered_rules, register_rule

# Register rule implementations when the rules package is imported.
from app.rules.reg_001_pedra_chave import pedra_chave_rule  # noqa: F401

__all__ = ["get_registered_rules", "register_rule"]
