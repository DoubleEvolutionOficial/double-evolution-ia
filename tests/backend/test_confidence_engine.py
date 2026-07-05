from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, ConfidenceEngine, LaboratoryEngine, PredictionEngine


def test_confidence_engine_scores_prediction_with_explanation_and_factors():
    engine = LaboratoryEngine()

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 8.0, "PAGADOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 6.0, "DEVEDOR", 79.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    prediction = PredictionEngine(engine).predict_next_event()
    assessment = ConfidenceEngine(engine).assess_prediction(prediction)

    assert 0.0 <= assessment["confidence"] <= 100.0
    assert assessment["reliability"] in {"baixa", "média", "alta"}
    assert assessment["risk_level"] in {"baixo", "médio", "alto"}
    assert assessment["explanation"]
    assert assessment["factors"]
    assert {"historical_accuracy", "pattern_score", "regime_score", "historical_frequency", "statistical_consistency", "average_distance", "temporal_stability", "backtesting_accuracy"}.issubset(assessment["factors"].keys())


def test_prediction_engine_includes_confidence_engine_fields():
    engine = LaboratoryEngine()

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    prediction = PredictionEngine(engine).predict_next_event()

    assert 0.0 <= prediction["confidence"] <= 100.0
    assert prediction["reliability"] in {"baixa", "média", "alta"}
    assert prediction["risk_level"] in {"baixo", "médio", "alto"}
    assert prediction["explanation"]
    assert prediction["factors"]