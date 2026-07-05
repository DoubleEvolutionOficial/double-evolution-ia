from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, LaboratoryEngine, ProbabilityEngine


def test_probability_engine_handles_empty_history():
    report = ProbabilityEngine(LaboratoryEngine()).build_probability_report()

    assert report["probability"] == 0.0
    assert report["confidence"] == 0.0
    assert report["reliability"] == "baixa"
    assert report["expected_accuracy"] == 0.0
    assert report["risk_adjusted_probability"] == 0.0
    assert report["explanation"]


def test_probability_engine_combines_laboratory_components():
    engine = LaboratoryEngine()
    probability_engine = ProbabilityEngine(engine)

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

    report = probability_engine.build_probability_report()

    assert 0.0 <= report["probability"] <= 100.0
    assert 0.0 <= report["confidence"] <= 100.0
    assert report["reliability"] in {"baixa", "média", "alta"}
    assert 0.0 <= report["expected_accuracy"] <= 100.0
    assert 0.0 <= report["risk_adjusted_probability"] <= 100.0
    assert report["explanation"]