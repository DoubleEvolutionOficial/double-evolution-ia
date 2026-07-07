import { LearningEngineState } from "../learning/types";
import { LiveDataEvent } from "../live-data/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";
import { PatternRankingResult } from "../pattern-ranking/types";
import { PerformanceAnalyticsSnapshot } from "../performance-analytics/types";
import { StrategyCenterState } from "../strategy/types";

export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PersistentStorageInfo = {
  status: "ready" | "empty" | "error";
  last_save: string | null;
  total_records: number;
  memory_usage: number;
  auto_save: boolean;
};

export type PersistentLearningRecord = {
  updated_at: string;
  engine_state: LearningEngineState;
};

export type PersistentPatternDiscoveryRecord = {
  updated_at: string;
  result: PatternDiscoveryResult;
};

export type PersistentPatternRankingRecord = {
  updated_at: string;
  result: PatternRankingResult;
};

export type PersistentStrategyCenterRecord = {
  updated_at: string;
  state: StrategyCenterState;
};

export type PersistentPerformanceAnalyticsRecord = {
  updated_at: string;
  snapshot: PerformanceAnalyticsSnapshot;
};

export type BacktestRecord = {
  timestamp: string;
  signal: "Vermelho" | "Preto" | "Branco";
  confidence: number;
  risk: number;
  result: string;
  outcome: "win" | "loss";
  pattern: string;
};

export type ManualSimulationRecord = {
  timestamp: string;
  entry: "red" | "black" | "white";
  result: "WIN" | "LOSS" | "GALE 1" | "GALE 2";
  amountDelta: number;
  bankrollAfter: number;
};

export type ManualSimulationState = {
  bankrollStart: number;
  bankrollCurrent: number;
  records: ManualSimulationRecord[];
};

export type PersistentHistoryImportRecord = {
  updated_at: string;
  events: LiveDataEvent[];
};

export type PersistentBacktestRecord = {
  updated_at: string;
  records: BacktestRecord[];
};

export type PersistentManualSimulationRecord = {
  updated_at: string;
  state: ManualSimulationState;
};