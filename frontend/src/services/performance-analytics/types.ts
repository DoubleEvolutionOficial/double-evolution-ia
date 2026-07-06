import { LearningSnapshot } from "../learning/types";
import { PatternRankingResult } from "../pattern-ranking/types";
import { StrategyDecision, StrategyResult } from "../strategy/types";
import { LiveDataEvent } from "../live-data/types";

export type PerformanceOutcome = {
  id: string;
  timestamp: string;
  hour: number;
  strategy: string;
  pattern: string;
  confidence: number;
  risk: number;
  prediction_accuracy: number;
  strategy_accuracy: number;
  pattern_accuracy: number;
  learning_score: number;
  outcome: "win" | "loss";
};

export type MetricByKey = {
  key: string;
  accuracy: number;
  total: number;
};

export type TimelinePoint = {
  timestamp: string;
  value: number;
};

export type PerformanceAnalyticsSnapshot = {
  updated_at: string;
  overall_accuracy: number;
  todays_accuracy: number;
  last_100_predictions: number;
  win_rate: number;
  loss_rate: number;
  average_confidence: number;
  average_risk: number;
  prediction_accuracy: number;
  strategy_accuracy: number;
  pattern_accuracy: number;
  learning_evolution: number;
  best_strategy: string;
  worst_strategy: string;
  best_pattern: string;
  worst_pattern: string;
  win_loss_chart: {
    wins: number;
    losses: number;
  };
  accuracy_timeline: TimelinePoint[];
  learning_curve: TimelinePoint[];
  accuracy_by_hour: MetricByKey[];
  accuracy_by_strategy: MetricByKey[];
  performance_by_pattern: MetricByKey[];
  last_results: PerformanceOutcome[];
};

export type PerformanceAnalyticsInput = {
  strategy: StrategyResult;
  strategyHistory: StrategyDecision[];
  learning: LearningSnapshot;
  ranking: PatternRankingResult;
  signal: Record<string, unknown> | null;
  liveEvents: LiveDataEvent[];
  historicalResults: PerformanceOutcome[];
};
