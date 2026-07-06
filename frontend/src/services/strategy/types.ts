import { LearningEngineState } from "../learning/types";
import { LiveDataEvent } from "../live-data/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";
import { PatternRankingResult } from "../pattern-ranking/types";

export type StrategyName =
  | "Conservative"
  | "Balanced"
  | "Aggressive"
  | "Adaptive"
  | "Experimental"
  | "Auto";

export type StrategyMode = "auto" | "manual";

export type StrategyDecision = {
  strategy: StrategyName;
  strategy_score: number;
  expected_win_rate: number;
  expected_risk: number;
  confidence: number;
  expected_delay: number;
  recommendation: string;
  reason: string;
  selected_at: string;
  mode: StrategyMode;
};

export type StrategyResult = {
  best_strategy: StrategyName;
  strategy_score: number;
  expected_win_rate: number;
  expected_risk: number;
  confidence: number;
  expected_delay: number;
  recommendation: string;
  reason: string;
  generated_at: string;
  strategy_scores: Array<{
    strategy: StrategyName;
    score: number;
  }>;
};

export type StrategyEngineInput = {
  ranking: PatternRankingResult;
  discovery: PatternDiscoveryResult;
  learningState: LearningEngineState;
  trend: Record<string, unknown> | null;
  seasonality: Record<string, unknown> | null;
  consensus: Record<string, unknown> | null;
  risk: Record<string, unknown> | null;
  signal: Record<string, unknown> | null;
  liveEvents: LiveDataEvent[];
  mode: StrategyMode;
  manualStrategy: Exclude<StrategyName, "Auto">;
};

export type StrategyCenterState = {
  mode: StrategyMode;
  manual_strategy: Exclude<StrategyName, "Auto">;
  result: StrategyResult;
  history: StrategyDecision[];
};
