from __future__ import annotations

from typing import Any

from app.laboratory.event_logger import AnalysisEvent


class Statistics:
    """Utility helpers for summarizing laboratory events."""

    @staticmethod
    def build_summary(events: list[AnalysisEvent | dict[str, Any]]) -> dict[str, Any]:
        status_counts: dict[str, int] = {}
        confidence_values: list[float] = []

        for event in events:
            if isinstance(event, AnalysisEvent):
                classification = event.classification
                confidence = event.confidence
            else:
                classification = event.get("classification") or event.get("status") or "UNKNOWN"
                confidence = event.get("confidence")

            status_counts[classification] = status_counts.get(classification, 0) + 1

            if confidence is not None:
                confidence_values.append(float(confidence))

        average_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0

        return {
            "total_events": len(events),
            "status_counts": status_counts,
            "average_confidence": average_confidence,
        }
