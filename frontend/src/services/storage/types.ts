import { LearningEngineState } from "../learning/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";

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