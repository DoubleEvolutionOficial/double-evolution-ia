from pathlib import Path
import sys

import pytest

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import EventLogger, LaboratoryEngine, PatternDetector, Statistics


def test_event_logger_records_events_in_order():
    logger = EventLogger()

    first = logger.log_event("analysis-1", {"status": "AGUARDAR", "confidence": 60.0})
    second = logger.log_event("analysis-2", {"status": "FAVORÁVEL", "confidence": 90.0})

    assert first["analysis_id"] == "analysis-1"
    assert second["analysis_id"] == "analysis-2"
    assert len(logger.events) == 2
    assert logger.events[0]["context"]["status"] == "AGUARDAR"


def test_laboratory_engine_records_analysis_events_without_touching_rule_engine():
    engine = LaboratoryEngine()

    event = engine.record_analysis_event("analysis-10", {"status": "DESFAVORÁVEL", "confidence": 20.0})

    assert event["analysis_id"] == "analysis-10"
    assert event["context"]["status"] == "DESFAVORÁVEL"
    assert len(engine.event_logger.events) == 1


def test_statistics_build_summary_and_pattern_detector_is_placeholder():
    events = [
        {"analysis_id": "a1", "context": {"status": "AGUARDAR", "confidence": 60.0}},
        {"analysis_id": "a2", "context": {"status": "AGUARDAR", "confidence": 65.0}},
        {"analysis_id": "a3", "context": {"status": "FAVORÁVEL", "confidence": 90.0}},
    ]

    summary = Statistics.build_summary(events)

    assert summary["total_events"] == 3
    assert summary["status_counts"]["AGUARDAR"] == 2
    assert summary["average_confidence"] == pytest.approx(71.66666666666667)
    assert PatternDetector.detect_patterns(events) == []
