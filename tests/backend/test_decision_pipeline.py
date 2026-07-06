from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, DecisionPipeline, LaboratoryEngine


def test_decision_pipeline_handles_empty_history():
    report = DecisionPipeline(LaboratoryEngine()).run()

    assert set(report.keys()) == {
        "statistics",
        "patterns",
        "regime",
        "trend",
        "seasonality",
        "correlation",
        "probability",
        "risk",
        "consensus",
        "confidence",
        "signal",
        "explanation",
    }

    assert isinstance(report["statistics"], dict)
    assert isinstance(report["patterns"], list)
    assert isinstance(report["regime"], list)
    assert isinstance(report["trend"], dict)
    assert isinstance(report["seasonality"], dict)
    assert isinstance(report["correlation"], dict)
    assert isinstance(report["probability"], dict)
    assert isinstance(report["risk"], dict)
    assert isinstance(report["consensus"], dict)
    assert isinstance(report["confidence"], dict)
    assert isinstance(report["signal"], dict)
    assert isinstance(report["explanation"], dict)


def test_decision_pipeline_runs_full_laboratory_flow():
    engine = LaboratoryEngine()
    pipeline = DecisionPipeline(engine)

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

    report = pipeline.run()

    assert set(report.keys()) == {
        "statistics",
        "patterns",
        "regime",
        "trend",
        "seasonality",
        "correlation",
        "probability",
        "risk",
        "consensus",
        "confidence",
        "signal",
        "explanation",
    }

    assert report["statistics"]
    assert isinstance(report["patterns"], list)
    assert isinstance(report["regime"], list)
    assert report["trend"]
    assert report["seasonality"]
    assert report["correlation"]
    assert report["probability"]
    assert report["risk"]
    assert report["consensus"]
    assert report["confidence"]
    assert report["signal"]
    assert report["explanation"]