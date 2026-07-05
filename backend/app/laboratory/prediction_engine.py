from __future__ import annotations

from collections import Counter
from typing import Any

from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_discovery import PatternDiscovery
from app.laboratory.pattern_score import PatternScore
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.sequence_analyzer import SequenceAnalyzer
from app.laboratory.statistics_engine import StatisticsEngine


class PredictionEngine:
    """Generates probabilistic forecasts from Laboratory-only signals."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        statistics_engine: StatisticsEngine | None = None,
        pattern_discovery: PatternDiscovery | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
        sequence_analyzer: SequenceAnalyzer | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.statistics_engine = statistics_engine or StatisticsEngine(self.laboratory_engine)
        self.pattern_discovery = pattern_discovery or PatternDiscovery(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine, self.pattern_discovery)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)
        self.sequence_analyzer = sequence_analyzer or SequenceAnalyzer(self.laboratory_engine)

    def predict_next_event(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "predicted_event": "NEUTRO",
                "next_classification": "NEUTRO",
                "probability": 0.0,
                "confidence": 0.0,
                "justification": ["Nenhum evento disponível para previsão"],
                "patterns_used": [],
                "final_score": 0.0,
                "sources": [],
                "reasoning": ["Nenhum evento disponível para previsão"],
            }

        statistics = self.statistics_engine.build_summary()
        discovered_patterns = self.pattern_discovery.discover_patterns()
        scored_patterns = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()
        current_sequence = self.sequence_analyzer.get_current_sequence()
        class_counts = Counter(event.classification for event in events)

        candidate_scores = {
            "DEVEDOR": 0.0,
            "PAGADOR": 0.0,
        }

        candidate_scores["DEVEDOR"] += float(statistics["freq_devedores"]["value"])
        candidate_scores["PAGADOR"] += float(statistics["freq_pagadores"]["value"])

        if current_sequence:
            last_classification = current_sequence[-1]
            if last_classification in candidate_scores:
                candidate_scores[last_classification] += 1.5

        for regime in regimes:
            name = str(regime.get("name", ""))
            score = float(regime.get("score", 0.0))
            if "Devedores" in name:
                candidate_scores["DEVEDOR"] += score * 2.0
            if "Pagadores" in name:
                candidate_scores["PAGADOR"] += score * 2.0

        for pattern in scored_patterns:
            name = str(pattern.get("name", ""))
            score = float(pattern.get("score", 0.0)) / 25.0
            if "Devedores" in name:
                candidate_scores["DEVEDOR"] += score
            if "Pagadores" in name:
                candidate_scores["PAGADOR"] += score

        prediction = max(candidate_scores, key=candidate_scores.get)
        total = sum(candidate_scores.values()) or 1.0
        probability = candidate_scores[prediction] / total
        confidence = min(1.0, probability * (sum(event.confidence for event in events) / (len(events) * 100.0) + 0.25))
        final_score = round(min(100.0, candidate_scores[prediction] * 12.5), 2)

        patterns_used = [
            pattern["name"]
            for pattern in discovered_patterns
            if prediction.lower() in str(pattern.get("name", "")).lower()
            or "chuva" in str(pattern.get("name", "")).lower()
            or "consecutiv" in str(pattern.get("name", "")).lower()
        ]
        if not patterns_used:
            patterns_used = [pattern["name"] for pattern in discovered_patterns[:3]]

        sources = [
            "EventStore",
            "SequenceAnalyzer",
            "StatisticsEngine",
            "PatternDiscovery",
            "PatternScore",
            "RegimeDetector",
        ]
        reasoning = [
            f"Frequência histórica favorece {prediction.lower()}",
            f"Sequência atual: {' -> '.join(current_sequence)}",
            f"Distribuição observada: {dict(class_counts)}",
        ]

        return {
            "predicted_event": prediction,
            "next_classification": prediction,
            "probability": round(probability, 4),
            "confidence": round(confidence, 4),
            "justification": reasoning,
            "patterns_used": patterns_used,
            "final_score": final_score,
            "sources": sources,
            "reasoning": reasoning,
        }