from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, LaboratoryEngine, SeasonalityEngine


def test_seasonality_engine_handles_empty_history():
    report = SeasonalityEngine(LaboratoryEngine()).build_seasonality_report()

    assert report["dominant_hour"] is None
    assert report["dominant_minute_final"] is None
    assert report["dominant_side"] == "indefinido"
    assert report["dominant_classification"] == "NEUTRO"
    assert report["seasonality_strength"] == 0.0
    assert report["confidence"] == 0.0
    assert report["explanation"]
    assert report["factors"]["hour_concentration"] == 0.0


def test_seasonality_engine_builds_report_from_laboratory_history():
    engine = LaboratoryEngine()
    seasonality_engine = SeasonalityEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 12.0, "DEVEDOR", 84.0, 2.5, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:10:00Z", 10, 10, "left", 11.0, "DEVEDOR", 83.0, 2.4, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:20:00Z", 10, 20, "right", 10.0, "DEVEDOR", 82.0, 2.3, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T11:00:00Z", 11, 0, "left", 9.0, "PAGADOR", 81.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T11:10:00Z", 11, 10, "left", 8.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    report = seasonality_engine.build_seasonality_report()

    assert report["dominant_hour"] in {10, 11}
    assert report["dominant_minute_final"] in {0}
    assert report["dominant_side"] in {"left", "right", "equilibrado"}
    assert report["dominant_classification"] in {"DEVEDOR", "PAGADOR", "NEUTRO"}
    assert 0.0 <= report["seasonality_strength"] <= 100.0
    assert 0.0 <= report["confidence"] <= 100.0
    assert report["explanation"]
    assert {
        "hour_concentration",
        "minute_concentration",
        "side_recurrence",
        "classification_recurrence",
        "temporal_consistency",
        "historical_coverage",
    }.issubset(report["factors"].keys())