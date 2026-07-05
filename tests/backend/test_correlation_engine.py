from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, CorrelationEngine, LaboratoryEngine


def test_correlation_engine_handles_empty_history():
    report = CorrelationEngine(LaboratoryEngine()).build_correlation_report()

    assert report["correlations"] == []
    assert report["factor_snapshot"]["regime"] == "NEUTRO"
    assert report["factor_snapshot"]["predicted_result"] == "NEUTRO"
    assert report["factor_snapshot"]["hit_miss"] == "ERRO"


def test_correlation_engine_builds_correlations_from_laboratory_factors():
    engine = LaboratoryEngine()
    correlation_engine = CorrelationEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 12.0, "DEVEDOR", 84.0, 2.5, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 11.0, "DEVEDOR", 83.0, 2.4, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 10.0, "PAGADOR", 82.0, 2.3, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 9.0, "PAGADOR", 81.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 8.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:05:00Z", 10, 5, "left", 7.5, "DEVEDOR", 79.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    report = correlation_engine.build_correlation_report()
    correlations = report["correlations"]

    assert report["factor_snapshot"]["regime"]
    assert report["factor_snapshot"]["pattern"]
    assert report["factor_snapshot"]["trend"]
    assert report["factor_snapshot"]["seasonality"]
    assert report["factor_snapshot"]["predicted_result"]
    assert report["factor_snapshot"]["hit_miss"]

    assert correlations
    assert len(correlations) >= 10
    assert all({"factor_a", "factor_b", "strength", "confidence", "occurrences", "explanation"}.issubset(item.keys()) for item in correlations)
    assert all(0.0 <= item["strength"] <= 100.0 for item in correlations)
    assert all(0.0 <= item["confidence"] <= 100.0 for item in correlations)
    assert all(item["occurrences"] >= 1 for item in correlations)

    correlation_pairs = {(item["factor_a"], item["factor_b"]) for item in correlations}
    assert ("regime", "pattern") in correlation_pairs
    assert ("trend", "seasonality") in correlation_pairs
    assert ("predicted_result", "hit_miss") in correlation_pairs