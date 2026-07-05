from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, ConsensusEngine, LaboratoryEngine


def test_consensus_engine_handles_empty_history():
    report = ConsensusEngine(LaboratoryEngine()).build_consensus_report()

    assert report["consensus_score"] == 0.0
    assert report["agreement_level"] == "baixo"
    assert report["confidence"] == 0.0
    assert report["supporting_factors"] == []
    assert report["conflicting_factors"] == []
    assert report["explanation"]


def test_consensus_engine_consolidates_laboratory_components():
    engine = LaboratoryEngine()
    consensus_engine = ConsensusEngine(engine)

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

    report = consensus_engine.build_consensus_report()

    assert 0.0 <= report["consensus_score"] <= 100.0
    assert report["agreement_level"] in {"baixo", "médio", "alto"}
    assert 0.0 <= report["confidence"] <= 100.0
    assert report["supporting_factors"]
    assert isinstance(report["conflicting_factors"], list)
    assert report["explanation"]