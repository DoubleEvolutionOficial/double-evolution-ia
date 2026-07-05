from __future__ import annotations

from typing import Any

from app.laboratory.event_logger import AnalysisEvent
from app.laboratory.laboratory_engine import LaboratoryEngine


class RegimeDetector:
    """Detects simple behavioral regimes from laboratory events without mutating them."""

    def __init__(self, laboratory_engine: LaboratoryEngine | None = None) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()

    def detect_regimes(self) -> list[dict[str, Any]]:
        events = self.laboratory_engine.get_events()
        if not events:
            return [{"name": "Regime Neutro", "score": 0.0, "confidence": 0.0, "motivos": ["Nenhum evento registrado"]}]

        classifications = [event.classification for event in events]
        devedor_count = sum(1 for item in classifications if item == "DEVEDOR")
        pagador_count = sum(1 for item in classifications if item == "PAGADOR")
        strong_minutagem = sum(1 for event in events if event.minute % 5 == 0)
        rain_like = sum(1 for event in events if event.distance and event.distance >= 8.0)

        regimes: list[dict[str, Any]] = []

        if devedor_count >= max(2, len(events) // 2):
            regimes.append({
                "name": "Regime de Devedores",
                "score": min(1.0, devedor_count / max(1, len(events))),
                "confidence": 0.8,
                "motivos": [f"{devedor_count} eventos classificados como devedores"],
            })

        if pagador_count >= max(2, len(events) // 2):
            regimes.append({
                "name": "Regime de Pagadores",
                "score": min(1.0, pagador_count / max(1, len(events))),
                "confidence": 0.8,
                "motivos": [f"{pagador_count} eventos classificados como pagadores"],
            })

        if strong_minutagem >= max(2, len(events) // 2):
            regimes.append({
                "name": "Regime de Minutagem Forte",
                "score": min(1.0, strong_minutagem / max(1, len(events))),
                "confidence": 0.75,
                "motivos": [f"{strong_minutagem} eventos em minutos múltiplos de 5"],
            })

        if rain_like >= max(2, len(events) // 2):
            regimes.append({
                "name": "Regime de Chuva",
                "score": min(1.0, rain_like / max(1, len(events))),
                "confidence": 0.7,
                "motivos": [f"{rain_like} eventos com distância alta"],
            })

        if not regimes:
            regimes.append({
                "name": "Regime Neutro",
                "score": 0.25,
                "confidence": 0.5,
                "motivos": ["Padrões insuficientes para classificar um regime forte"],
            })

        return regimes
