from pathlib import Path
import sys

sys.path.append(str(Path.cwd() / "backend"))

from fastapi.testclient import TestClient

from app.main import app


def test_laboratory_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/v1/laboratory/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "online",
        "module": "laboratory",
    }


def test_laboratory_analyze_endpoint_returns_decision_pipeline_payload():
    client = TestClient(app)
    payload = {
        "events": [
            {
                "timestamp": "2026-07-05T10:00:00Z",
                "hour": 10,
                "minute": 0,
                "side": "left",
                "distance": 12.0,
                "classification": "DEVEDOR",
                "confidence": 84.0,
                "score": 2.5,
                "triggered_rules": ["REG-002"],
                "recommendation": "Revisar",
            },
            {
                "timestamp": "2026-07-05T10:01:00Z",
                "hour": 10,
                "minute": 1,
                "side": "left",
                "distance": 11.0,
                "classification": "DEVEDOR",
                "confidence": 83.0,
                "score": 2.4,
                "triggered_rules": ["REG-002"],
                "recommendation": "Revisar",
            },
            {
                "timestamp": "2026-07-05T10:02:00Z",
                "hour": 10,
                "minute": 2,
                "side": "right",
                "distance": 10.0,
                "classification": "PAGADOR",
                "confidence": 82.0,
                "score": 2.3,
                "triggered_rules": ["REG-003"],
                "recommendation": "Aprovar",
            },
            {
                "timestamp": "2026-07-05T10:03:00Z",
                "hour": 10,
                "minute": 3,
                "side": "right",
                "distance": 9.0,
                "classification": "PAGADOR",
                "confidence": 81.0,
                "score": 2.1,
                "triggered_rules": ["REG-003"],
                "recommendation": "Aprovar",
            },
            {
                "timestamp": "2026-07-05T10:04:00Z",
                "hour": 10,
                "minute": 4,
                "side": "left",
                "distance": 8.0,
                "classification": "DEVEDOR",
                "confidence": 80.0,
                "score": 2.0,
                "triggered_rules": ["REG-002"],
                "recommendation": "Revisar",
            },
            {
                "timestamp": "2026-07-05T10:05:00Z",
                "hour": 10,
                "minute": 5,
                "side": "left",
                "distance": 7.5,
                "classification": "DEVEDOR",
                "confidence": 79.0,
                "score": 2.0,
                "triggered_rules": ["REG-002"],
                "recommendation": "Revisar",
            },
        ]
    }

    response = client.post("/api/v1/laboratory/analyze", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
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