from pathlib import Path
import sys

import pytest

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, EventLogger, LaboratoryEngine, PatternDetector, RegimeDetector, ReplayEngine, SequenceAnalyzer, Statistics


def test_event_logger_records_complete_event_model():
    logger = EventLogger()

    event = AnalysisEvent(
        timestamp="2026-07-05T10:00:00Z",
        hour=10,
        minute=0,
        side="left",
        distance=12.5,
        classification="AGUARDAR",
        confidence=60.0,
        score=3.0,
        triggered_rules=["REG-001"],
        recommendation="Revisar manualmente",
    )

    stored_event = logger.log_event(event)

    assert stored_event.timestamp == "2026-07-05T10:00:00Z"
    assert stored_event.hour == 10
    assert stored_event.minute == 0
    assert stored_event.side == "left"
    assert stored_event.distance == 12.5
    assert stored_event.classification == "AGUARDAR"
    assert stored_event.confidence == 60.0
    assert stored_event.score == 3.0
    assert stored_event.triggered_rules == ["REG-001"]
    assert stored_event.recommendation == "Revisar manualmente"
    assert len(logger.events) == 1


def test_laboratory_engine_stores_events_in_memory():
    engine = LaboratoryEngine()

    event = AnalysisEvent(
        timestamp="2026-07-05T11:30:00Z",
        hour=11,
        minute=30,
        side="right",
        distance=8.0,
        classification="FAVORÁVEL",
        confidence=90.0,
        score=4.5,
        triggered_rules=["REG-002"],
        recommendation="Seguir fluxo",
    )

    stored_event = engine.record_analysis_event(event)

    assert stored_event.classification == "FAVORÁVEL"
    assert len(engine.get_events()) == 1
    assert engine.get_events()[0].confidence == 90.0


def test_statistics_build_summary_and_pattern_detector_is_placeholder():
    events = [
        AnalysisEvent(
            timestamp="2026-07-05T10:00:00Z",
            hour=10,
            minute=0,
            side="left",
            distance=10.0,
            classification="AGUARDAR",
            confidence=60.0,
            score=2.0,
            triggered_rules=["REG-001"],
            recommendation="Revisar",
        ),
        AnalysisEvent(
            timestamp="2026-07-05T10:05:00Z",
            hour=10,
            minute=5,
            side="right",
            distance=12.0,
            classification="AGUARDAR",
            confidence=65.0,
            score=3.0,
            triggered_rules=["REG-002"],
            recommendation="Revisar",
        ),
        AnalysisEvent(
            timestamp="2026-07-05T10:10:00Z",
            hour=10,
            minute=10,
            side="left",
            distance=8.0,
            classification="FAVORÁVEL",
            confidence=90.0,
            score=4.0,
            triggered_rules=["REG-003"],
            recommendation="Aprovar",
        ),
    ]

    summary = Statistics.build_summary(events)

    assert summary["total_events"] == 3
    assert summary["status_counts"]["AGUARDAR"] == 2
    assert summary["average_confidence"] == pytest.approx(71.66666666666667)
    assert PatternDetector.detect_patterns(events) == []


def test_sequence_analyzer_builds_timeline_and_sequences():
    engine = LaboratoryEngine()
    analyzer = SequenceAnalyzer(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 8.0, "PAGADOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 10.5, "DEVEDOR", 79.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    assert analyzer.get_last_events(3)[0].classification == "PAGADOR"
    assert analyzer.get_current_sequence() == ["DEVEDOR", "DEVEDOR", "PAGADOR", "PAGADOR", "DEVEDOR"]
    assert analyzer.get_longest_sequence("DEVEDOR") == 2
    assert analyzer.get_longest_sequence("PAGADOR") == 2
    assert analyzer.get_average_distance() == pytest.approx(1.625)
    assert analyzer.get_average_time_gap() == pytest.approx(60.0)


def test_replay_engine_replays_events_without_mutating_source():
    engine = LaboratoryEngine()
    replay_engine = ReplayEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 8.0, "PAGADOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    replay_by_count = replay_engine.replay(count=2)
    assert len(replay_by_count) == 2
    assert [event.classification for event in replay_by_count] == ["DEVEDOR", "DEVEDOR"]

    replay_by_interval = replay_engine.replay(start_hour=10, end_hour=10)
    assert len(replay_by_interval) == 4
    assert replay_engine.replay(hour=10)[0].classification == "DEVEDOR"

    assert len(engine.get_events()) == 4
    assert engine.get_events()[0].classification == "DEVEDOR"


def test_regime_detector_detects_expected_regimes_without_mutating_events():
    engine = LaboratoryEngine()
    detector = RegimeDetector(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 2.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:05:00Z", 10, 5, "left", 2.1, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:10:00Z", 10, 10, "right", 2.2, "DEVEDOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:15:00Z", 10, 15, "right", 2.3, "DEVEDOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    regimes = detector.detect_regimes()

    assert [regime["name"] for regime in regimes] == [
        "Regime de Devedores",
        "Regime de Minutagem Forte",
    ]
    assert regimes[0]["score"] >= regimes[1]["score"]
    assert regimes[0]["confidence"] > 0.0
    assert all("motivos" in regime for regime in regimes)
    assert len(engine.get_events()) == 4
