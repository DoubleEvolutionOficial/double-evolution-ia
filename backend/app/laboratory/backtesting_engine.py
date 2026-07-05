from __future__ import annotations

from typing import Any

from app.laboratory.event_store import EventStore
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.prediction_engine import PredictionEngine


class BacktestingEngine:
    """Evaluates PredictionEngine forecasts against historical Laboratory events."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        prediction_engine: PredictionEngine | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.prediction_engine = prediction_engine

    def run_backtest(self, min_history: int = 2) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if len(events) <= min_history:
            return {
                "total_predictions": 0,
                "correct_predictions": 0,
                "accuracy": 0.0,
                "average_probability": 0.0,
                "average_confidence": 0.0,
                "results": [],
            }

        results: list[dict[str, Any]] = []

        for index in range(min_history, len(events)):
            history_engine = LaboratoryEngine(event_store=EventStore())
            for historical_event in events[:index]:
                history_engine.record_analysis_event(historical_event)

            prediction_engine = self.prediction_engine or PredictionEngine(history_engine)
            forecast = prediction_engine.predict_next_event()
            actual_event = events[index]
            predicted_event = str(forecast.get("predicted_event", "NEUTRO"))

            results.append(
                {
                    "predicted_event": predicted_event,
                    "actual_event": actual_event.classification,
                    "hit": predicted_event == actual_event.classification,
                    "probability": float(forecast.get("probability", 0.0)),
                    "confidence": float(forecast.get("confidence", 0.0)),
                    "final_score": float(forecast.get("final_score", 0.0)),
                    "timestamp": actual_event.timestamp,
                }
            )

        total_predictions = len(results)
        correct_predictions = sum(1 for result in results if result["hit"])
        average_probability = sum(result["probability"] for result in results) / total_predictions
        average_confidence = sum(result["confidence"] for result in results) / total_predictions

        return {
            "total_predictions": total_predictions,
            "correct_predictions": correct_predictions,
            "accuracy": round(correct_predictions / total_predictions, 4),
            "average_probability": round(average_probability, 4),
            "average_confidence": round(average_confidence, 4),
            "results": results,
        }