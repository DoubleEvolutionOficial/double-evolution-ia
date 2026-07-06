import { StrategyEngineInput, StrategyName, StrategyResult } from "./types";

type StrategyContext = {
  topRankScore: number;
  avgRankScore: number;
  bestConfidence: number;
  bestAccuracy: number;
  stability: number;
  learningScore: number;
  adaptationLevel: number;
  trendStrength: number;
  seasonalityStrength: number;
  consensusStrength: number;
  signalStrength: number;
  riskScore: number;
  regimeConfidence: number;
  recentLearning: number;
  expectedDelay: number;
  noveltyScore: number;
};

const MANUAL_STRATEGIES: Array<Exclude<StrategyName, "Auto">> = [
  "Conservative",
  "Balanced",
  "Aggressive",
  "Adaptive",
  "Experimental",
];

export class StrategyEngine {
  evaluate(input: StrategyEngineInput): StrategyResult {
    const context = this.buildContext(input);

    const scored = [
      this.scoreConservative(context),
      this.scoreBalanced(context),
      this.scoreAggressive(context),
      this.scoreAdaptive(context),
      this.scoreExperimental(context),
      this.scoreAuto(context),
    ];

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const bestAuto = sorted[0];

    const chosen =
      input.mode === "manual"
        ? scored.find((item) => item.strategy === input.manualStrategy) ?? bestAuto
        : bestAuto;

    const expectedWinRate = this.expectedWinRate(chosen.strategy, context);
    const expectedRisk = this.expectedRisk(chosen.strategy, context);
    const confidence = this.strategyConfidence(chosen.strategy, context);
    const reason = this.buildReason(chosen.strategy, context);

    return {
      best_strategy: chosen.strategy,
      strategy_score: round2(chosen.score),
      expected_win_rate: round2(expectedWinRate),
      expected_risk: round2(expectedRisk),
      confidence: round2(confidence),
      expected_delay: round2(context.expectedDelay),
      recommendation: this.recommendation(chosen.strategy, expectedWinRate, expectedRisk, confidence),
      reason,
      generated_at: new Date().toISOString(),
      strategy_scores: scored
        .map((item) => ({ strategy: item.strategy, score: round2(item.score) }))
        .sort((a, b) => b.score - a.score),
    };
  }

  manualStrategies(): Array<Exclude<StrategyName, "Auto">> {
    return [...MANUAL_STRATEGIES];
  }

  private buildContext(input: StrategyEngineInput): StrategyContext {
    const ranked = input.ranking.ranked_patterns;
    const topRankScore = ranked[0]?.global_score ?? 0;
    const avgRankScore = average(ranked.slice(0, 5).map((item) => item.global_score));
    const bestConfidence = ranked[0]?.confidence ?? 0;
    const bestAccuracy = ranked[0]?.accuracy ?? 0;
    const stability = input.learningState.snapshot.stability;
    const learningScore = input.learningState.snapshot.learning_score;
    const adaptationLevel = input.learningState.snapshot.adaptation_level;
    const trendStrength = this.extractScore(input.trend, ["trend_strength", "strength", "confidence", "score"]);
    const seasonalityStrength = this.extractScore(input.seasonality, [
      "seasonality_score",
      "strength",
      "confidence",
      "score",
    ]);
    const consensusStrength = this.extractScore(input.consensus, [
      "consensus_score",
      "agreement",
      "confidence",
      "score",
    ]);
    const signalStrength = this.extractScore(input.signal, ["signal_strength", "strength", "confidence", "score"]);
    const riskScore = this.extractScore(input.risk, ["risk_score", "risk_level", "risk", "score"]);
    const regimePattern = input.discovery.patterns
      .filter((item) => item.category === "regimes")
      .sort((a, b) => b.confidence - a.confidence)[0];
    const regimeConfidence = regimePattern?.confidence ?? 0;
    const expectedDelay =
      input.discovery.patterns
        .slice(0, 5)
        .reduce((sum, item) => sum + item.average_delay, 0) /
      Math.max(1, Math.min(5, input.discovery.patterns.length));

    const recent = input.learningState.history.slice(-20);
    const recentLearning = recent.length
      ? clamp(
          (recent.filter((event) => event.color !== "white").length / Math.max(1, recent.length)) *
            100
        )
      : 0;

    const noveltyScore = clamp(
      (input.discovery.summary.new_patterns / Math.max(1, input.discovery.summary.total_patterns)) *
        100
    );

    return {
      topRankScore,
      avgRankScore,
      bestConfidence,
      bestAccuracy,
      stability,
      learningScore,
      adaptationLevel,
      trendStrength,
      seasonalityStrength,
      consensusStrength,
      signalStrength,
      riskScore,
      regimeConfidence,
      recentLearning,
      expectedDelay: Number.isFinite(expectedDelay) ? expectedDelay : 0,
      noveltyScore,
    };
  }

  private scoreConservative(context: StrategyContext) {
    const score = clamp(
      context.avgRankScore * 0.2 +
        context.bestConfidence * 0.17 +
        context.stability * 0.2 +
        context.consensusStrength * 0.15 +
        (100 - context.riskScore) * 0.2 +
        context.regimeConfidence * 0.08
    );

    return { strategy: "Conservative" as const, score };
  }

  private scoreBalanced(context: StrategyContext) {
    const score = clamp(
      context.avgRankScore * 0.22 +
        context.bestAccuracy * 0.16 +
        context.consensusStrength * 0.14 +
        context.signalStrength * 0.14 +
        (100 - context.riskScore) * 0.12 +
        context.stability * 0.12 +
        context.trendStrength * 0.1
    );

    return { strategy: "Balanced" as const, score };
  }

  private scoreAggressive(context: StrategyContext) {
    const score = clamp(
      context.topRankScore * 0.26 +
        context.signalStrength * 0.22 +
        context.trendStrength * 0.2 +
        context.recentLearning * 0.12 +
        context.learningScore * 0.1 +
        context.consensusStrength * 0.1 -
        context.riskScore * 0.1
    );

    return { strategy: "Aggressive" as const, score };
  }

  private scoreAdaptive(context: StrategyContext) {
    const score = clamp(
      context.learningScore * 0.26 +
        context.adaptationLevel * 0.24 +
        context.recentLearning * 0.14 +
        context.trendStrength * 0.12 +
        context.seasonalityStrength * 0.1 +
        context.consensusStrength * 0.08 +
        context.avgRankScore * 0.06
    );

    return { strategy: "Adaptive" as const, score };
  }

  private scoreExperimental(context: StrategyContext) {
    const score = clamp(
      context.noveltyScore * 0.24 +
        context.signalStrength * 0.18 +
        context.trendStrength * 0.16 +
        context.seasonalityStrength * 0.14 +
        context.learningScore * 0.1 +
        context.regimeConfidence * 0.08 +
        context.topRankScore * 0.1 -
        (100 - context.riskScore) * 0.06
    );

    return { strategy: "Experimental" as const, score };
  }

  private scoreAuto(context: StrategyContext) {
    const score = clamp(
      context.avgRankScore * 0.18 +
        context.learningScore * 0.16 +
        context.consensusStrength * 0.15 +
        context.stability * 0.12 +
        context.signalStrength * 0.12 +
        context.trendStrength * 0.1 +
        context.regimeConfidence * 0.08 +
        (100 - context.riskScore) * 0.09
    );

    return { strategy: "Auto" as const, score };
  }

  private expectedWinRate(strategy: StrategyName, context: StrategyContext): number {
    const base =
      context.bestAccuracy * 0.35 +
      context.bestConfidence * 0.2 +
      context.consensusStrength * 0.2 +
      context.signalStrength * 0.15 +
      context.recentLearning * 0.1;

    if (strategy === "Conservative") {
      return clamp(base + 4);
    }
    if (strategy === "Aggressive") {
      return clamp(base - 2 + context.trendStrength * 0.05);
    }
    if (strategy === "Experimental") {
      return clamp(base - 6 + context.noveltyScore * 0.04);
    }

    return clamp(base);
  }

  private expectedRisk(strategy: StrategyName, context: StrategyContext): number {
    const base = clamp(context.riskScore * 0.55 + (100 - context.stability) * 0.2 + (100 - context.consensusStrength) * 0.25);

    if (strategy === "Conservative") {
      return clamp(base * 0.8);
    }
    if (strategy === "Aggressive") {
      return clamp(base * 1.22 + 8);
    }
    if (strategy === "Experimental") {
      return clamp(base * 1.3 + 12);
    }
    if (strategy === "Adaptive") {
      return clamp(base * 0.95);
    }

    return clamp(base);
  }

  private strategyConfidence(strategy: StrategyName, context: StrategyContext): number {
    const base = clamp(
      context.bestConfidence * 0.3 +
        context.consensusStrength * 0.24 +
        context.stability * 0.16 +
        context.learningScore * 0.14 +
        context.regimeConfidence * 0.08 +
        (100 - context.riskScore) * 0.08
    );

    if (strategy === "Conservative") {
      return clamp(base + 6);
    }
    if (strategy === "Aggressive") {
      return clamp(base - 5);
    }
    if (strategy === "Experimental") {
      return clamp(base - 8);
    }

    return clamp(base);
  }

  private recommendation(
    strategy: StrategyName,
    expectedWinRate: number,
    expectedRisk: number,
    confidence: number
  ): string {
    if (expectedWinRate >= 70 && expectedRisk <= 35 && confidence >= 68) {
      return `${strategy}: executar com sizing padrao e monitoramento continuo.`;
    }

    if (expectedRisk >= 65 || confidence <= 45) {
      return `${strategy}: reduzir exposicao e aguardar confirmacao adicional.`;
    }

    return `${strategy}: operar com lote reduzido e revisao a cada novo evento.`;
  }

  private buildReason(strategy: StrategyName, context: StrategyContext): string {
    const clauses = [
      `ranking medio ${round2(context.avgRankScore)}`,
      `risco ${round2(context.riskScore)}`,
      `confianca ${round2(context.bestConfidence)}`,
      `estabilidade ${round2(context.stability)}`,
      `tendencia ${round2(context.trendStrength)}`,
      `regime ${round2(context.regimeConfidence)}`,
      `aprendizado recente ${round2(context.recentLearning)}`,
    ];

    return `${strategy} selecionada por ${clauses.join(", ")}.`;
  }

  private extractScore(
    source: Record<string, unknown> | null,
    keys: string[]
  ): number {
    if (!source) {
      return 0;
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return clamp(value);
      }
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return clamp(parsed);
        }
      }
    }

    const numericValues = Object.values(source)
      .map((value) => (typeof value === "number" ? value : Number.NaN))
      .filter((value) => Number.isFinite(value));

    if (!numericValues.length) {
      return 0;
    }

    return clamp(average(numericValues));
  }
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
