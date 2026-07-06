import { LearningEngineState } from "../learning/types";
import { PatternDiscoveryResult, DiscoveredPattern } from "./types";

export class PatternDiscoveryEngine {
  scan(
    learningState: LearningEngineState,
    previousPatterns: DiscoveredPattern[] = []
  ): PatternDiscoveryResult {
    const patterns: DiscoveredPattern[] = [];
    const previousIndex = new Set(previousPatterns.map((pattern) => pattern.pattern));
    const history = learningState.history;

    const averageDelay = learningState.snapshot.trend_memory.average_gap_seconds;
    const baseAccuracy = learningState.snapshot.accuracy;

    Object.entries(learningState.pattern_frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .forEach(([patternName, occurrences]) => {
        const expectedProbability = percent(occurrences / Math.max(1, history.length));
        const confidence = clamp(baseAccuracy * 0.5 + expectedProbability * 0.5);
        patterns.push(
          this.buildPattern(
            `seq-${patternName}`,
            `Sequencia recorrente ${patternName}`,
            "sequencias",
            confidence,
            occurrences,
            baseAccuracy,
            averageDelay,
            expectedProbability,
            previousIndex
          )
        );
      });

    Object.entries(learningState.transitions)
      .slice(0, 6)
      .forEach(([from, row]) => {
        Object.entries(row)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .forEach(([to, occurrences]) => {
            const expectedProbability = percent(occurrences / Math.max(1, history.length));
            const confidence = clamp(learningState.snapshot.stability * 0.4 + expectedProbability * 0.6);
            patterns.push(
              this.buildPattern(
                `comb-${from}-${to}`,
                `Combinacao de cores ${from} -> ${to}`,
                "combinacoes",
                confidence,
                occurrences,
                baseAccuracy,
                averageDelay,
                expectedProbability,
                previousIndex
              )
            );
          });
      });

    if (averageDelay > 0) {
      const periodicConfidence = clamp(100 - Math.min(100, Math.abs(averageDelay - 1.5) * 40));
      patterns.push(
        this.buildPattern(
          "time-repeat",
          "Repeticao temporal observada",
          "repeticoes_temporais",
          periodicConfidence,
          Math.max(1, learningState.gap_count),
          baseAccuracy,
          averageDelay,
          periodicConfidence,
          previousIndex
        )
      );
    }

    const cycleStrength = this.detectCycles(history);
    if (cycleStrength > 0) {
      patterns.push(
        this.buildPattern(
          "cycles",
          "Ciclos de alternancia detectados",
          "ciclos",
          cycleStrength,
          Math.max(1, Math.floor(history.length / 2)),
          baseAccuracy,
          averageDelay,
          cycleStrength,
          previousIndex
        )
      );
    }

    patterns.push(
      this.buildPattern(
        "interval",
        "Intervalo medio entre eventos",
        "intervalos",
        clamp(learningState.snapshot.stability),
        Math.max(1, learningState.gap_count),
        baseAccuracy,
        averageDelay,
        clamp(100 - Math.abs(averageDelay - 1.5) * 30),
        previousIndex
      )
    );

    const trendDominance = this.trendDominance(learningState);
    patterns.push(
      this.buildPattern(
        "trend",
        `Tendencia dominante ${trendDominance.name}`,
        "tendencias",
        trendDominance.confidence,
        trendDominance.occurrences,
        baseAccuracy,
        averageDelay,
        trendDominance.confidence,
        previousIndex
      )
    );

    const anomalyScore = this.detectAnomalies(history);
    patterns.push(
      this.buildPattern(
        "anomaly",
        "Anomalias estatisticas no historico",
        "anomalias",
        anomalyScore,
        Math.max(1, Math.floor(history.length * 0.15)),
        baseAccuracy,
        averageDelay,
        100 - anomalyScore,
        previousIndex
      )
    );

    const regime = this.detectRegime(history);
    patterns.push(
      this.buildPattern(
        "regime",
        `Regime ${regime.name}`,
        "regimes",
        regime.confidence,
        regime.occurrences,
        baseAccuracy,
        averageDelay,
        regime.confidence,
        previousIndex
      )
    );

    patterns.push(
      this.buildPattern(
        "behavior-change",
        "Mudancas de comportamento detectadas",
        "mudancas_comportamento",
        clamp(learningState.behavior_changes * 12),
        learningState.behavior_changes,
        baseAccuracy,
        averageDelay,
        clamp(learningState.snapshot.adaptation_level),
        previousIndex
      )
    );

    const uniquePatterns = dedupePatterns(patterns);
    const summary = this.buildSummary(uniquePatterns);

    return {
      summary,
      patterns: uniquePatterns,
      scanned_at: new Date().toISOString(),
    };
  }

  private buildPattern(
    id: string,
    pattern: string,
    category: DiscoveredPattern["category"],
    confidence: number,
    occurrences: number,
    accuracy: number,
    averageDelay: number,
    expectedProbability: number,
    previousIndex: Set<string>
  ): DiscoveredPattern {
    const normalizedConfidence = clamp(confidence);
    return {
      id,
      pattern,
      category,
      confidence: round2(normalizedConfidence),
      occurrences,
      accuracy: round2(clamp(accuracy)),
      average_delay: round2(Math.max(0, averageDelay)),
      expected_probability: round2(clamp(expectedProbability)),
      status: normalizedConfidence >= 55 ? "accepted" : "discarded",
      is_new: !previousIndex.has(pattern),
    };
  }

  private buildSummary(patterns: DiscoveredPattern[]) {
    const totalPatterns = patterns.length;
    const newPatterns = patterns.filter((pattern) => pattern.is_new).length;
    const highConfidence = patterns.filter((pattern) => pattern.confidence >= 75).length;
    const discarded = patterns.filter((pattern) => pattern.status === "discarded").length;

    return {
      total_patterns: totalPatterns,
      new_patterns: newPatterns,
      high_confidence: highConfidence,
      discarded_patterns: discarded,
      discovery_progress: clamp(totalPatterns * 8 + highConfidence * 6),
    };
  }

  private detectCycles(history: LearningEngineState["history"]): number {
    if (history.length < 6) {
      return 0;
    }

    let alternations = 0;
    for (let i = 2; i < history.length; i += 1) {
      const a = history[i - 2]?.color;
      const b = history[i - 1]?.color;
      const c = history[i]?.color;
      if (a === c && a !== b) {
        alternations += 1;
      }
    }

    return clamp((alternations / Math.max(1, history.length / 3)) * 100);
  }

  private trendDominance(state: LearningEngineState) {
    const values = [
      { name: "alta", value: state.trend_up },
      { name: "baixa", value: state.trend_down },
      { name: "lateral", value: state.trend_flat },
    ].sort((a, b) => b.value - a.value);

    const dominant = values[0] ?? { name: "lateral", value: 0 };
    const total = values.reduce((sum, item) => sum + item.value, 0);
    return {
      name: dominant.name,
      occurrences: dominant.value,
      confidence: clamp(percent(dominant.value / Math.max(1, total))),
    };
  }

  private detectAnomalies(history: LearningEngineState["history"]): number {
    if (!history.length) {
      return 0;
    }

    const whiteCount = history.filter((event) => event.white).length;
    const whiteRatio = whiteCount / Math.max(1, history.length);
    const highNumbers = history.filter((event) => event.number >= 12).length;
    const highRatio = highNumbers / Math.max(1, history.length);

    return clamp((whiteRatio * 60 + highRatio * 40) * 100);
  }

  private detectRegime(history: LearningEngineState["history"]) {
    const colorCounts = new Map<string, number>();
    history.forEach((event) => {
      colorCounts.set(event.color, (colorCounts.get(event.color) ?? 0) + 1);
    });

    const top = Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!top) {
      return {
        name: "neutro",
        occurrences: 0,
        confidence: 0,
      };
    }

    return {
      name: top[0],
      occurrences: top[1],
      confidence: clamp(percent(top[1] / Math.max(1, history.length))),
    };
  }
}

function dedupePatterns(patterns: DiscoveredPattern[]): DiscoveredPattern[] {
  const seen = new Set<string>();
  const result: DiscoveredPattern[] = [];

  patterns.forEach((pattern) => {
    if (seen.has(pattern.pattern)) {
      return;
    }
    seen.add(pattern.pattern);
    result.push(pattern);
  });

  return result;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function percent(value: number): number {
  return clamp(value * 100);
}