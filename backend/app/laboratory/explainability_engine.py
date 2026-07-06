from __future__ import annotations

from typing import Any

from app.laboratory.confidence_engine import ConfidenceEngine
from app.laboratory.consensus_engine import ConsensusEngine
from app.laboratory.correlation_engine import CorrelationEngine
from app.laboratory.laboratory_engine import LaboratoryEngine
from app.laboratory.pattern_score import PatternScore
from app.laboratory.probability_engine import ProbabilityEngine
from app.laboratory.regime_detector import RegimeDetector
from app.laboratory.risk_engine import RiskEngine
from app.laboratory.seasonality_engine import SeasonalityEngine
from app.laboratory.signal_engine import SignalEngine
from app.laboratory.trend_engine import TrendEngine


class ExplainabilityEngine:
    """Converts Laboratory analytical outputs into user-facing explanations."""

    def __init__(
        self,
        laboratory_engine: LaboratoryEngine | None = None,
        signal_engine: SignalEngine | None = None,
        probability_engine: ProbabilityEngine | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        consensus_engine: ConsensusEngine | None = None,
        risk_engine: RiskEngine | None = None,
        trend_engine: TrendEngine | None = None,
        seasonality_engine: SeasonalityEngine | None = None,
        correlation_engine: CorrelationEngine | None = None,
        pattern_score: PatternScore | None = None,
        regime_detector: RegimeDetector | None = None,
    ) -> None:
        self.laboratory_engine = laboratory_engine or LaboratoryEngine()
        self.signal_engine = signal_engine or SignalEngine(self.laboratory_engine)
        self.probability_engine = probability_engine or ProbabilityEngine(self.laboratory_engine)
        self.confidence_engine = confidence_engine or ConfidenceEngine(self.laboratory_engine)
        self.consensus_engine = consensus_engine or ConsensusEngine(self.laboratory_engine)
        self.risk_engine = risk_engine or RiskEngine(self.laboratory_engine)
        self.trend_engine = trend_engine or TrendEngine(self.laboratory_engine)
        self.seasonality_engine = seasonality_engine or SeasonalityEngine(self.laboratory_engine)
        self.correlation_engine = correlation_engine or CorrelationEngine(self.laboratory_engine)
        self.pattern_score = pattern_score or PatternScore(self.laboratory_engine)
        self.regime_detector = regime_detector or RegimeDetector(self.laboratory_engine)

    def build_explainability_report(self) -> dict[str, Any]:
        events = self.laboratory_engine.get_events()
        if not events:
            return {
                "summary": "Histórico insuficiente para explicação detalhada",
                "explanation": ["Sem eventos registrados no Laboratory"],
                "positive_factors": [],
                "negative_factors": ["Ausência de dados históricos"],
                "warnings": ["A explicação pode mudar após novos eventos"],
                "confidence_reason": "Sem base histórica para sustentar confiança",
                "recommendation": "Registrar novos eventos antes de decidir",
                "next_actions": [
                    "Coletar novas observações no Laboratory",
                    "Reavaliar quando houver histórico mínimo",
                ],
            }

        trend = self.trend_engine.build_trend_report()
        signal = self.signal_engine.build_signal_report()
        probability = self.probability_engine.build_probability_report()
        consensus = self.consensus_engine.build_consensus_report()
        risk = self.risk_engine.build_risk_report()
        confidence = self.confidence_engine.assess_prediction(
            {"predicted_event": trend.get("trend_direction", "NEUTRO")}
        )
        seasonality = self.seasonality_engine.build_seasonality_report()
        correlations = self.correlation_engine.build_correlation_report().get("correlations", [])
        patterns = self.pattern_score.score_patterns()
        regimes = self.regime_detector.detect_regimes()

        positive_factors: list[str] = []
        negative_factors: list[str] = []
        warnings: list[str] = []

        signal_strength = float(signal.get("signal_strength", 0.0))
        risk_score = float(risk.get("risk_score", 0.0))
        probability_score = float(probability.get("risk_adjusted_probability", 0.0))
        confidence_score = float(confidence.get("confidence", 0.0))
        consensus_score = float(consensus.get("consensus_score", 0.0))
        trend_direction = str(trend.get("trend_direction", "NEUTRO"))
        seasonal_direction = str(seasonality.get("dominant_classification", "NEUTRO"))
        avg_corr = self._average([float(item.get("strength", 0.0)) for item in correlations[:10]])
        best_pattern = max((float(item.get("score", 0.0)) for item in patterns), default=0.0)
        strongest_regime = max((float(item.get("score", 0.0)) for item in regimes), default=0.0) * 100.0

        if signal_strength >= 60.0:
            positive_factors.append(f"SignalEngine indica força operacional ({signal_strength:.2f})")
        else:
            negative_factors.append(f"Sinal ainda fraco para execução ({signal_strength:.2f})")

        if probability_score >= 55.0:
            positive_factors.append(f"ProbabilityEngine aponta chance ajustada alta ({probability_score:.2f})")
        else:
            negative_factors.append(f"Probabilidade ajustada ao risco limitada ({probability_score:.2f})")

        if confidence_score >= 50.0:
            positive_factors.append(f"ConfidenceEngine sustenta confiança adequada ({confidence_score:.2f})")
        else:
            negative_factors.append(f"Confiança estatística abaixo do ideal ({confidence_score:.2f})")

        if consensus_score >= 50.0:
            positive_factors.append(f"ConsensusEngine mostra alinhamento relevante ({consensus_score:.2f})")
        else:
            negative_factors.append(f"Baixo consenso entre motores analíticos ({consensus_score:.2f})")

        if avg_corr >= 55.0:
            positive_factors.append(f"CorrelationEngine registra correlações úteis ({avg_corr:.2f})")
        else:
            warnings.append(f"Correlações fracas podem reduzir robustez do cenário ({avg_corr:.2f})")

        if best_pattern >= 60.0:
            positive_factors.append(f"PatternScore detecta padrão com score elevado ({best_pattern:.2f})")
        else:
            warnings.append(f"Padrões ainda pouco consistentes ({best_pattern:.2f})")

        if strongest_regime >= 60.0:
            positive_factors.append(f"RegimeDetector encontrou regime dominante ({strongest_regime:.2f})")
        else:
            warnings.append(f"Regime atual pouco definido ({strongest_regime:.2f})")

        if risk_score >= 70.0:
            negative_factors.append(f"RiskEngine reporta risco alto ({risk_score:.2f})")
            warnings.append("Risco elevado: priorizar proteção e gestão de exposição")
        elif risk_score <= 40.0:
            positive_factors.append(f"RiskEngine indica risco controlado ({risk_score:.2f})")

        if (
            trend_direction != "NEUTRO"
            and seasonal_direction != "NEUTRO"
            and trend_direction != seasonal_direction
        ):
            warnings.append("Conflito entre TrendEngine e SeasonalityEngine")

        confidence_reason = (
            f"Confiança baseada em consenso {consensus_score:.2f}, "
            f"probabilidade ajustada {probability_score:.2f} e risco {risk_score:.2f}"
        )

        summary = (
            f"Sinal {signal.get('signal', 'WAIT')} com força {signal_strength:.2f}, "
            f"probabilidade {probability_score:.2f} e risco {risk_score:.2f}"
        )

        explanation = [
            f"TrendEngine indica direção {trend_direction.lower()}",
            f"SeasonalityEngine aponta {seasonal_direction.lower()} como classificação dominante",
            f"SignalEngine recomenda {signal.get('signal', 'WAIT')}",
            f"RiskEngine sugere: {risk.get('recommendation', 'sem recomendação')}",
            f"ProbabilityEngine calculou confiança de {float(probability.get('confidence', 0.0)):.2f}",
        ]

        recommendation = str(signal.get("recommendation", "Aguardar confirmação adicional"))
        if risk_score >= 70.0:
            recommendation = "Evitar entrada até redução do risco e melhora do consenso"
        elif signal.get("signal") == "ENTER" and confidence_score >= 55.0:
            recommendation = "Entrada possível com gestão de risco e acompanhamento contínuo"

        next_actions = self._next_actions(
            signal=str(signal.get("signal", "WAIT")),
            risk_score=risk_score,
            confidence_score=confidence_score,
            warnings=warnings,
        )

        return {
            "summary": summary,
            "explanation": explanation,
            "positive_factors": positive_factors,
            "negative_factors": negative_factors,
            "warnings": warnings,
            "confidence_reason": confidence_reason,
            "recommendation": recommendation,
            "next_actions": next_actions,
        }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)

    @staticmethod
    def _next_actions(signal: str, risk_score: float, confidence_score: float, warnings: list[str]) -> list[str]:
        actions: list[str] = []

        if signal == "ENTER":
            actions.append("Definir tamanho de posição compatível com o risco")
            actions.append("Acompanhar evento a evento para validar continuidade")
        elif signal == "AVOID":
            actions.append("Suspender entradas até estabilização dos indicadores")
            actions.append("Priorizar observação de novos ciclos")
        else:
            actions.append("Aguardar confirmação adicional antes de executar")
            actions.append("Atualizar histórico para melhorar assertividade")

        if risk_score >= 70.0:
            actions.append("Aplicar proteção extra e limites de perda")
        if confidence_score < 50.0:
            actions.append("Revisar padrões e regime para elevar confiança")
        if warnings:
            actions.append("Monitorar alertas de divergência entre motores")

        return actions