import { LiveDataEvent } from "../live-data/types";
import { LearningSnapshot } from "./types";

const PATTERN_SIZE = 3;
const WINDOW_SIZE = 10;

type TransitionMap = Map<string, Map<string, number>>;

export class LearningEngine {
  private readonly history: LiveDataEvent[] = [];
  private readonly patternFreq = new Map<string, number>();
  private readonly transitionMap: TransitionMap = new Map();

  private hits = 0;
  private predictionCount = 0;
  private trendUp = 0;
  private trendDown = 0;
  private trendFlat = 0;
  private behaviorChanges = 0;
  private totalGapSeconds = 0;
  private gapCount = 0;
  private lastWindowDominant: string | null = null;

  ingest(event: LiveDataEvent): void {
    const previous = this.history[this.history.length - 1];

    if (previous) {
      this.updatePrediction(previous.color, event.color);
      this.updateTrend(previous.number, event.number);
      this.updateGap(previous.timestamp, event.timestamp);
      this.updateTransition(previous.color, event.color);
    }

    this.history.push(event);
    this.updatePatternFrequency();
    this.detectBehaviorChange();
  }

  getSnapshot(): LearningSnapshot {
    const samples = this.history.length;
    const accuracy = this.predictionCount
      ? (this.hits / this.predictionCount) * 100
      : 0;
    const adaptationLevel = this.calculateAdaptationLevel(samples);
    const stability = this.calculateStability(samples);
    const coverage = Math.min(100, samples * 2.5);
    const learningScore =
      accuracy * 0.35 +
      stability * 0.35 +
      adaptationLevel * 0.2 +
      coverage * 0.1;

    return {
      learning_score: round2(learningScore),
      samples,
      accuracy: round2(accuracy),
      adaptation_level: round2(adaptationLevel),
      stability: round2(stability),
      pattern_memory: this.patternMemoryTop(12),
      trend_memory: {
        up: this.trendUp,
        down: this.trendDown,
        flat: this.trendFlat,
        behavior_changes: this.behaviorChanges,
        average_gap_seconds: round2(this.gapCount ? this.totalGapSeconds / this.gapCount : 0),
      },
    };
  }

  memorySize(): number {
    return this.history.length;
  }

  private updatePrediction(previousColor: string, actualColor: string): void {
    const row = this.transitionMap.get(previousColor);
    if (!row || row.size === 0) {
      return;
    }

    const predicted = this.maxKey(row);
    if (!predicted) {
      return;
    }

    this.predictionCount += 1;
    if (predicted === actualColor) {
      this.hits += 1;
    }
  }

  private updateTrend(previousNumber: number, currentNumber: number): void {
    if (currentNumber > previousNumber) {
      this.trendUp += 1;
      return;
    }
    if (currentNumber < previousNumber) {
      this.trendDown += 1;
      return;
    }
    this.trendFlat += 1;
  }

  private updateGap(previousTimestamp: string, currentTimestamp: string): void {
    const previousMs = Date.parse(previousTimestamp);
    const currentMs = Date.parse(currentTimestamp);

    if (Number.isNaN(previousMs) || Number.isNaN(currentMs) || currentMs <= previousMs) {
      return;
    }

    this.totalGapSeconds += (currentMs - previousMs) / 1000;
    this.gapCount += 1;
  }

  private updateTransition(previousColor: string, nextColor: string): void {
    if (!this.transitionMap.has(previousColor)) {
      this.transitionMap.set(previousColor, new Map());
    }

    const row = this.transitionMap.get(previousColor)!;
    row.set(nextColor, (row.get(nextColor) ?? 0) + 1);
  }

  private updatePatternFrequency(): void {
    if (this.history.length < PATTERN_SIZE) {
      return;
    }

    const pattern = this.history
      .slice(this.history.length - PATTERN_SIZE)
      .map((event) => event.color)
      .join("-");

    this.patternFreq.set(pattern, (this.patternFreq.get(pattern) ?? 0) + 1);
  }

  private detectBehaviorChange(): void {
    if (this.history.length < WINDOW_SIZE * 2) {
      return;
    }

    const latestWindow = this.history
      .slice(-WINDOW_SIZE)
      .map((event) => event.color);
    const dominant = this.dominantColor(latestWindow);

    if (this.lastWindowDominant !== null && dominant !== this.lastWindowDominant) {
      this.behaviorChanges += 1;
    }

    this.lastWindowDominant = dominant;
  }

  private calculateAdaptationLevel(samples: number): number {
    const changePressure = Math.min(100, this.behaviorChanges * 15);
    const dataReadiness = Math.min(100, samples * 2);
    const adaptation = 45 + changePressure * 0.45 + dataReadiness * 0.2;
    return Math.max(0, Math.min(100, adaptation));
  }

  private calculateStability(samples: number): number {
    if (samples < PATTERN_SIZE) {
      return 0;
    }

    const topPatternCount = Math.max(...Array.from(this.patternFreq.values()), 0);
    const patternDominance = Math.min(100, (topPatternCount / Math.max(1, samples)) * 100 * 2.2);

    const averageGap = this.gapCount ? this.totalGapSeconds / this.gapCount : 0;
    const gapStability = Math.max(0, 100 - Math.min(100, Math.abs(averageGap - 1.5) * 40));
    const behaviorPenalty = Math.min(100, this.behaviorChanges * 8);

    return Math.max(
      0,
      Math.min(
        100,
        patternDominance * 0.5 + gapStability * 0.35 + (100 - behaviorPenalty) * 0.15
      )
    );
  }

  private patternMemoryTop(limit: number): Record<string, number> {
    const sorted = Array.from(this.patternFreq.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, limit);
    return Object.fromEntries(top);
  }

  private dominantColor(windowColors: string[]): string {
    const counts = new Map<string, number>();
    windowColors.forEach((color) => {
      counts.set(color, (counts.get(color) ?? 0) + 1);
    });

    const key = this.maxKey(counts);
    return key ?? "white";
  }

  private maxKey(map: Map<string, number>): string | null {
    let bestKey: string | null = null;
    let bestValue = -1;

    map.forEach((value, key) => {
      if (value > bestValue) {
        bestValue = value;
        bestKey = key;
      }
    });

    return bestKey;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}