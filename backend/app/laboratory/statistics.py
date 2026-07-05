from __future__ import annotations

from typing import Any


class Statistics:
    """Utility helpers for summarizing laboratory events."""

    @staticmethod
    def build_summary(events: list[dict[str, Any]]) -> dict[str, Any]:
        status_counts: dict[str, int] = {}
        confidence_values: list[float] = []

        for event in events:
            context = event.get("context", {})
            status = context.get("status") or "UNKNOWN"
            status_counts[status] = status_counts.get(status, 0) + 1

            confidence = context.get("confidence")
            if confidence is not None:
                confidence_values.append(float(confidence))

        average_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0

        return {
            "total_events": len(events),
            "status_counts": status_counts,
            "average_confidence": average_confidence,
        }
