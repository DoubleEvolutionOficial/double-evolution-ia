import {
  MetricByKey,
  PerformanceAnalyticsInput,
  PerformanceAnalyticsSnapshot,
  PerformanceOutcome,
  TimelinePoint,
} from "./types";

const MAX_RESULTS = 100;

export class PerformanceAnalytics {
  evaluate(input: PerformanceAnalyticsInput): PerformanceAnalyticsSnapshot {
    const base = [...input.historicalResults];
    const latest = input.liveEvents[input.liveEvents.length - 1];
    const topPattern = input.ranking.ranked_patterns[0]?.pattern ?? "-";

    if (latest) {
      const candidate = this.buildOutcome(input, latest, topPattern);
      const alreadyExists = base.some((item) => item.id === candidate.id);
      if (!alreadyExists) {
        base.unshift(candidate);
      }
    }

    const results = base.slice(0, MAX_RESULTS);
    const wins = results.filter((item) => item.outcome === "win").length;
    const losses = results.length - wins;
    const overallAccuracy = average(
      results.map((item) => (item.outcome === "win" ? item.prediction_accuracy : 100 - item.prediction_accuracy))
    );

    const today = new Date().toISOString().slice(0, 10);
    const todayResults = results.filter((item) => item.timestamp.startsWith(today));

    const accuracyByStrategy = this.groupAccuracy(results, (item) => item.strategy);
    const accuracyByPattern = this.groupAccuracy(results, (item) => item.pattern);
    const accuracyByHour = this.groupAccuracy(results, (item) => `${item.hour}`);

    const bestStrategy = accuracyByStrategy[0]?.key ?? "-";
    const worstStrategy = accuracyByStrategy[accuracyByStrategy.length - 1]?.key ?? "-";
    const bestPattern = accuracyByPattern[0]?.key ?? "-";
    const worstPattern = accuracyByPattern[accuracyByPattern.length - 1]?.key ?? "-";

    const learningCurve = results
      .slice()
      .reverse()
      .map((item) => ({ timestamp: item.timestamp, value: round2(item.learning_score) }))
      .slice(-24);

    const accuracyTimeline = results
      .slice()
      .reverse()
      .map((item) => ({
        timestamp: item.timestamp,
        value: round2(item.outcome === "win" ? item.prediction_accuracy : 100 - item.prediction_accuracy),
      }))
      .slice(-24);

    const predictionAccuracy = average(results.map((item) => item.prediction_accuracy));
    const strategyAccuracy = average(results.map((item) => item.strategy_accuracy));
    const patternAccuracy = average(results.map((item) => item.pattern_accuracy));

    const learningEvolution = this.learningEvolution(learningCurve);

    return {
      updated_at: new Date().toISOString(),
      overall_accuracy: round2(overallAccuracy),
      todays_accuracy: round2(
        todayResults.length
          ? average(
              todayResults.map((item) =>
                item.outcome === "win" ? item.prediction_accuracy : 100 - item.prediction_accuracy
              )
            )
          : 0
      ),
      last_100_predictions: results.length,
      win_rate: round2(percent(wins, results.length)),
      loss_rate: round2(percent(losses, results.length)),
      average_confidence: round2(average(results.map((item) => item.confidence))),
      average_risk: round2(average(results.map((item) => item.risk))),
      prediction_accuracy: round2(predictionAccuracy),
      strategy_accuracy: round2(strategyAccuracy),
      pattern_accuracy: round2(patternAccuracy),
      learning_evolution: round2(learningEvolution),
      best_strategy: bestStrategy,
      worst_strategy: worstStrategy,
      best_pattern: bestPattern,
      worst_pattern: worstPattern,
      win_loss_chart: {
        wins,
        losses,
      },
      accuracy_timeline: accuracyTimeline,
      learning_curve: learningCurve,
      accuracy_by_hour: accuracyByHour,
      accuracy_by_strategy: accuracyByStrategy,
      performance_by_pattern: accuracyByPattern,
      last_results: results,
    };
  }

  private buildOutcome(
    input: PerformanceAnalyticsInput,
    latest: PerformanceAnalyticsInput["liveEvents"][number],
    topPattern: string
  ): PerformanceOutcome {
    const signalStrength = this.extractSignalStrength(input.signal);
    const strategy = input.strategy.best_strategy;
    const confidence = clamp(input.strategy.confidence);
    const risk = clamp(input.strategy.expected_risk);

    const predictionAccuracy = clamp(
      input.strategy.expected_win_rate * 0.45 + confidence * 0.35 + (100 - risk) * 0.2
    );

    const strategyHistoryForCurrent = input.strategyHistory.filter(
      (item) => item.strategy === strategy
    );
    const strategyAccuracy = clamp(
      strategyHistoryForCurrent.length
        ? average(strategyHistoryForCurrent.map((item) => item.expected_win_rate))
        : predictionAccuracy
    );

    const topPatternAccuracy = input.ranking.ranked_patterns[0]?.accuracy ?? predictionAccuracy;
    const patternAccuracy = clamp(topPatternAccuracy * 0.7 + predictionAccuracy * 0.3);

    const quality = clamp(
      predictionAccuracy * 0.55 +
        (100 - risk) * 0.2 +
        signalStrength * 0.15 +
        input.learning.learning_score * 0.1
    );

    const outcome: "win" | "loss" = latest.white || quality < 54 ? "loss" : "win";

    const when = new Date(latest.timestamp);

    return {
      id: `${latest.timestamp}-${latest.number}-${strategy}`,
      timestamp: latest.timestamp,
      hour: when.getHours(),
      strategy,
      pattern: topPattern,
      confidence: round2(confidence),
      risk: round2(risk),
      prediction_accuracy: round2(predictionAccuracy),
      strategy_accuracy: round2(strategyAccuracy),
      pattern_accuracy: round2(patternAccuracy),
      learning_score: round2(input.learning.learning_score),
      outcome,
    };
  }

  private groupAccuracy(
    results: PerformanceOutcome[],
    getKey: (item: PerformanceOutcome) => string
  ): MetricByKey[] {
    const grouped = new Map<string, { total: number; score: number }>();

    results.forEach((item) => {
      const key = getKey(item);
      const current = grouped.get(key) ?? { total: 0, score: 0 };
      const score = item.outcome === "win" ? item.prediction_accuracy : 100 - item.prediction_accuracy;
      grouped.set(key, {
        total: current.total + 1,
        score: current.score + score,
      });
    });

    return Array.from(grouped.entries())
      .map(([key, value]) => ({
        key,
        accuracy: round2(value.total ? value.score / value.total : 0),
        total: value.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }

  private extractSignalStrength(signal: Record<string, unknown> | null): number {
    if (!signal) {
      return 0;
    }

    const candidates = ["signal_strength", "strength", "confidence", "score"];
    for (const key of candidates) {
      const value = signal[key];
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

    const values = Object.values(signal)
      .map((value) => (typeof value === "number" ? value : Number.NaN))
      .filter((value) => Number.isFinite(value));

    return values.length ? clamp(average(values)) : 0;
  }

  private learningEvolution(curve: TimelinePoint[]): number {
    if (curve.length < 2) {
      return 0;
    }

    const first = curve[0].value;
    const last = curve[curve.length - 1].value;
    return clamp(last - first + 50) - 50;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number, total: number): number {
  if (!total) {
    return 0;
  }
  return (value / total) * 100;
}
