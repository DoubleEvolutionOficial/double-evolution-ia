from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


class EventLogger:
    """Stores analysis events for future statistical mining."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def log_event(self, analysis_id: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        event = {
            "analysis_id": analysis_id,
            "context": dict(context or {}),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.events.append(event)
        return event
