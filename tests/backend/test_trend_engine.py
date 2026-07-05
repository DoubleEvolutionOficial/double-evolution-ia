from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, LaboratoryEngine, TrendEngine


def test_trend_engine_handles_empty_history():
    report = TrendEngine(LaboratoryEngine()).build_trend_report()

    assert report["trend_direction"] == "NEUTRO"
    assert report["trend_strength"] == 0.0
    assert report["momentum"] == "flat"
    assert report["dominant_side"] == "indefinido"
    assert report["dominant_classification"] == "NEUTRO"
    assert report["confidence"] == 0.0
    assert report["explanation"]
    assert report["factors"]["classification_bias"] == 0.0


def test_trend_engine_builds_report_from_laboratory_history():
    engine = LaboratoryEngine()
    trend_engine = TrendEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 12.0, "DEVEDOR", 84.0, 2.5, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 11.0, "DEVEDOR", 83.0, 2.4, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "left", 10.0, "DEVEDOR", 82.0, 2.3, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 9.0, "PAGADOR", 81.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 8.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    report = trend_engine.build_trend_report()

    assert report["trend_direction"] in {"DEVEDOR", "PAGADOR", "NEUTRO"}
    assert 0.0 <= report["trend_strength"] <= 100.0
    assert report["momentum"] in {"rising", "falling", "flat"}
    assert report["dominant_side"] in {"left", "right", "equilibrado"}
    assert report["dominant_classification"] in {"DEVEDOR", "PAGADOR", "NEUTRO"}
    assert 0.0 <= report["confidence"] <= 100.0
    assert report["explanation"]
    assert {
        "classification_bias",
        "sequence_strength",
        "side_bias",
        "distance_trend",
        "temporal_stability",
        "historical_consistency",
    }.issubset(report["factors"].keys())