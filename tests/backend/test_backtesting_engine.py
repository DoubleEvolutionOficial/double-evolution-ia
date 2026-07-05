from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from app.laboratory import AnalysisEvent, BacktestingEngine, LaboratoryEngine


def test_backtesting_engine_replays_predictions_against_history():
    engine = LaboratoryEngine()
    backtesting_engine = BacktestingEngine(engine)

    events = [
        AnalysisEvent("2026-07-05T10:00:00Z", 10, 0, "left", 10.0, "DEVEDOR", 80.0, 2.0, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:01:00Z", 10, 1, "left", 9.0, "DEVEDOR", 82.0, 2.2, ["REG-002"], "Revisar"),
        AnalysisEvent("2026-07-05T10:02:00Z", 10, 2, "right", 7.0, "PAGADOR", 85.0, 2.4, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:03:00Z", 10, 3, "right", 8.0, "PAGADOR", 83.0, 2.1, ["REG-003"], "Aprovar"),
        AnalysisEvent("2026-07-05T10:04:00Z", 10, 4, "left", 6.0, "DEVEDOR", 79.0, 2.0, ["REG-002"], "Revisar"),
    ]

    for event in events:
        engine.record_analysis_event(event)

    report = backtesting_engine.run_backtest(min_history=2)

    assert report["total_predictions"] == 3
    assert 0.0 <= report["accuracy"] <= 1.0
    assert 0.0 <= report["average_probability"] <= 1.0
    assert 0.0 <= report["average_confidence"] <= 1.0
    assert len(report["results"]) == 3
    assert {"predicted_event", "actual_event", "hit", "probability", "confidence", "final_score", "timestamp"}.issubset(report["results"][0].keys())