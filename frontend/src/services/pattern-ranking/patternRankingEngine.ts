import { LearningEngineState } from "../learning/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";
import { PatternRankingResult, PatternRankLabel, RankedPattern } from "./types";

export class PatternRankingEngine {
  rank(
    discovery: PatternDiscoveryResult,
    learningState: LearningEngineState
  ): PatternRankingResult {
    const ranked = discovery.patterns.map((pattern) => {
      const confidenceScore = clamp(pattern.confidence);
      const historicalAccuracy = clamp(pattern.accuracy);
      const recentAccuracy = this.recentAccuracy(pattern.pattern, learningState.history);
      const trendScore = this.trendScore(learningState);
      const riskScore = clamp(100 - confidenceScore * 0.55 - historicalAccuracy * 0.25);
      const stabilityScore = clamp(
        learningState.snapshot.stability * 0.65 +
          Math.min(100, pattern.occurrences * 4) * 0.35
      );
      const learningScore = clamp(learningState.snapshot.learning_score);

      const globalScore = clamp(
        confidenceScore * 0.2 +
          historicalAccuracy * 0.18 +
          recentAccuracy * 0.16 +
          trendScore * 0.12 +
          (100 - riskScore) * 0.12 +
          stabilityScore * 0.12 +
          learningScore * 0.1
      );

      const rankLabel = this.rankLabel(globalScore, pattern.status);
      const finalRank = Math.max(1, Math.round(globalScore));

      return {
        id: pattern.id,
        pattern: pattern.pattern,
        rank: rankLabel,
        global_score: round2(globalScore),
        confidence_score: round2(confidenceScore),
        historical_accuracy: round2(historicalAccuracy),
        recent_accuracy: round2(recentAccuracy),
        trend_score: round2(trendScore),
        risk_score: round2(riskScore),
        stability_score: round2(stabilityScore),
        learning_score: round2(learningScore),
        final_rank: finalRank,
        occurrences: pattern.occurrences,
        confidence: round2(pattern.confidence),
        accuracy: round2(pattern.accuracy),
        last_seen: this.lastSeen(pattern.pattern, learningState.history),
        status: rankLabel === "Discarded" ? "discarded" : "active",
      } satisfies RankedPattern;
    });

    ranked.sort((a, b) => b.global_score - a.global_score);

    return {
      ranked_patterns: ranked,
      scanned_at: new Date().toISOString(),
    };
  }

  private rankLabel(score: number, baseStatus: "accepted" | "discarded"): PatternRankLabel {
    if (baseStatus === "discarded" || score < 30) {
      return "Discarded";
    }
    if (score >= 90) {
      return "Elite";
    }
    if (score >= 78) {
      return "Excellent";
    }
    if (score >= 64) {
      return "Good";
    }
    if (score >= 48) {
      return "Average";
    }
    return "Weak";
  }

  private trendScore(state: LearningEngineState): number {
    const total = state.trend_up + state.trend_down + state.trend_flat;
    if (!total) {
      return 0;
    }

    const dominant = Math.max(state.trend_up, state.trend_down, state.trend_flat);
    const dominanceScore = (dominant / total) * 100;
    const behaviorPenalty = Math.min(100, state.behavior_changes * 6);
    return clamp(dominanceScore * 0.7 + (100 - behaviorPenalty) * 0.3);
  }

  private recentAccuracy(patternName: string, history: LearningEngineState["history"]): number {
    if (history.length < 6) {
      return 0;
    }

    const recent = history.slice(-20);
    const tokens = this.patternTokens(patternName);
    const hits = recent.filter((event) => tokens.includes(event.color)).length;
    return clamp((hits / Math.max(1, recent.length)) * 100);
  }

  private lastSeen(patternName: string, history: LearningEngineState["history"]): string | null {
    const tokens = this.patternTokens(patternName);
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (tokens.includes(history[i].color)) {
        return history[i].timestamp;
      }
    }
    return history.length ? history[history.length - 1].timestamp : null;
  }

  private patternTokens(patternName: string): string[] {
    const normalized = patternName.toLowerCase();
    const result: string[] = [];

    if (normalized.includes("red") || normalized.includes("vermelh")) {
      result.push("red");
    }
    if (normalized.includes("black") || normalized.includes("pret")) {
      result.push("black");
    }
    if (normalized.includes("white") || normalized.includes("branc")) {
      result.push("white");
    }

    if (!result.length) {
      result.push("red", "black", "white");
    }

    return result;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}