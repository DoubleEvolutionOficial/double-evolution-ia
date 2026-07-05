from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AdaptiveLearningEngine, AnalysisEvent, LaboratoryEngine


def test_adaptive_learning_engine_handles_empty_history():
    profile = AdaptiveLearningEngine(LaboratoryEngine()).build_adaptation_profile()

    assert profile["adaptation_score"] == 0.0
    assert profile["learning_state"] == "cold_start"
    assert profile["recommended_bias"] == "NEUTRO"
    assert profile["event_count"] == 0
    assert profile["explanation"]
    assert profile["factors"]["historical_accuracy"] == 0.0


def test_adaptive_learning_engine_builds_profile_from_history_without_mutation():
    engine = LaboratoryEngine()
    adaptive_learning_engine = AdaptiveLearningEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 8.0, "PAGADOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 6.0, "DEVEDOR", 79.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    profile = adaptive_learning_engine.build_adaptation_profile()

    assert 0.0 <= profile["adaptation_score"] <= 100.0
    assert profile["learning_state"] in {"adaptive", "stable", "conservative"}
    assert profile["recommended_bias"] in {"DEVEDOR", "PAGADOR", "NEUTRO"}
    assert profile["event_count"] == 5
    assert profile["explanation"]
    assert {
        "historical_accuracy",
        "confidence_reliability",
        "pattern_strength",
        "regime_alignment",
        "frequency_balance",
        "temporal_stability",
        "event_coverage",
    }.issubset(profile["factors"].keys())
    assert len(engine.get_events()) == 5
