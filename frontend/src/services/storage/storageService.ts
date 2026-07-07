import { LearningEngineState } from "../learning/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";
import { PatternRankingResult } from "../pattern-ranking/types";
import { PerformanceAnalyticsSnapshot } from "../performance-analytics/types";
import { StrategyCenterState } from "../strategy/types";
import { LocalStorageDriver } from "./localStorageDriver";
import {
  BacktestRecord,
  ManualSimulationState,
  PersistentBacktestRecord,
  PersistentHistoryImportRecord,
  PersistentLearningRecord,
  PersistentManualSimulationRecord,
  PersistentPerformanceAnalyticsRecord,
  PersistentPatternDiscoveryRecord,
  PersistentPatternRankingRecord,
  PersistentStrategyCenterRecord,
  PersistentStorageInfo,
  StorageDriver,
} from "./types";
import { LiveDataEvent } from "../live-data/types";

const LEARNING_STORAGE_KEY = "double-evolution.learning-engine.v1";
const PATTERN_DISCOVERY_STORAGE_KEY = "double-evolution.pattern-discovery.v1";
const PATTERN_RANKING_STORAGE_KEY = "double-evolution.pattern-ranking.v1";
const STRATEGY_CENTER_STORAGE_KEY = "double-evolution.strategy-center.v1";
const PERFORMANCE_ANALYTICS_STORAGE_KEY = "double-evolution.performance-analytics.v1";
const HISTORY_IMPORT_STORAGE_KEY = "double-evolution.history-import.v1";
const BACKTEST_STORAGE_KEY = "double-evolution.backtest.v1";
const MANUAL_SIMULATION_STORAGE_KEY = "double-evolution.manual-simulation.v1";

export class StorageService {
  private readonly driver: StorageDriver;

  constructor(driver: StorageDriver = new LocalStorageDriver()) {
    this.driver = driver;
  }

  loadLearningState(): LearningEngineState | null {
    try {
      const raw = this.driver.getItem(LEARNING_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentLearningRecord;
      if (!parsed || !parsed.engine_state) {
        return null;
      }

      return parsed.engine_state;
    } catch {
      return null;
    }
  }

  saveLearningState(state: LearningEngineState): string {
    const now = new Date().toISOString();
    const payload: PersistentLearningRecord = {
      updated_at: now,
      engine_state: {
        ...state,
        snapshot: {
          ...state.snapshot,
          last_updated_at: now,
        },
      },
    };

    this.driver.setItem(LEARNING_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearLearningState(): void {
    this.driver.removeItem(LEARNING_STORAGE_KEY);
  }

  loadPatternDiscoveryResult(): PatternDiscoveryResult | null {
    try {
      const raw = this.driver.getItem(PATTERN_DISCOVERY_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentPatternDiscoveryRecord;
      return parsed?.result ?? null;
    } catch {
      return null;
    }
  }

  savePatternDiscoveryResult(result: PatternDiscoveryResult): string {
    const now = new Date().toISOString();
    const payload: PersistentPatternDiscoveryRecord = {
      updated_at: now,
      result: {
        ...result,
        scanned_at: now,
      },
    };

    this.driver.setItem(PATTERN_DISCOVERY_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearPatternDiscoveryResult(): void {
    this.driver.removeItem(PATTERN_DISCOVERY_STORAGE_KEY);
  }

  loadPatternRankingResult(): PatternRankingResult | null {
    try {
      const raw = this.driver.getItem(PATTERN_RANKING_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentPatternRankingRecord;
      return parsed?.result ?? null;
    } catch {
      return null;
    }
  }

  savePatternRankingResult(result: PatternRankingResult): string {
    const now = new Date().toISOString();
    const payload: PersistentPatternRankingRecord = {
      updated_at: now,
      result: {
        ...result,
        scanned_at: now,
      },
    };

    this.driver.setItem(PATTERN_RANKING_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearPatternRankingResult(): void {
    this.driver.removeItem(PATTERN_RANKING_STORAGE_KEY);
  }

  loadStrategyCenterState(): StrategyCenterState | null {
    try {
      const raw = this.driver.getItem(STRATEGY_CENTER_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentStrategyCenterRecord;
      return parsed?.state ?? null;
    } catch {
      return null;
    }
  }

  saveStrategyCenterState(state: StrategyCenterState): string {
    const now = new Date().toISOString();
    const payload: PersistentStrategyCenterRecord = {
      updated_at: now,
      state: {
        ...state,
        result: {
          ...state.result,
          generated_at: now,
        },
      },
    };

    this.driver.setItem(STRATEGY_CENTER_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearStrategyCenterState(): void {
    this.driver.removeItem(STRATEGY_CENTER_STORAGE_KEY);
  }

  loadPerformanceAnalyticsSnapshot(): PerformanceAnalyticsSnapshot | null {
    try {
      const raw = this.driver.getItem(PERFORMANCE_ANALYTICS_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentPerformanceAnalyticsRecord;
      return parsed?.snapshot ?? null;
    } catch {
      return null;
    }
  }

  savePerformanceAnalyticsSnapshot(snapshot: PerformanceAnalyticsSnapshot): string {
    const now = new Date().toISOString();
    const payload: PersistentPerformanceAnalyticsRecord = {
      updated_at: now,
      snapshot: {
        ...snapshot,
        updated_at: now,
      },
    };

    this.driver.setItem(PERFORMANCE_ANALYTICS_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearPerformanceAnalyticsSnapshot(): void {
    this.driver.removeItem(PERFORMANCE_ANALYTICS_STORAGE_KEY);
  }

  loadImportedHistoryEvents(): LiveDataEvent[] {
    try {
      const raw = this.driver.getItem(HISTORY_IMPORT_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as PersistentHistoryImportRecord;
      if (!Array.isArray(parsed?.events)) {
        return [];
      }

      return parsed.events;
    } catch {
      return [];
    }
  }

  saveImportedHistoryEvents(events: LiveDataEvent[]): string {
    const now = new Date().toISOString();
    const payload: PersistentHistoryImportRecord = {
      updated_at: now,
      events,
    };

    this.driver.setItem(HISTORY_IMPORT_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearImportedHistoryEvents(): void {
    this.driver.removeItem(HISTORY_IMPORT_STORAGE_KEY);
  }

  loadBacktestRecords(): BacktestRecord[] {
    try {
      const raw = this.driver.getItem(BACKTEST_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as PersistentBacktestRecord;
      if (!Array.isArray(parsed?.records)) {
        return [];
      }

      return parsed.records;
    } catch {
      return [];
    }
  }

  saveBacktestRecords(records: BacktestRecord[]): string {
    const now = new Date().toISOString();
    const payload: PersistentBacktestRecord = {
      updated_at: now,
      records,
    };

    this.driver.setItem(BACKTEST_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearBacktestRecords(): void {
    this.driver.removeItem(BACKTEST_STORAGE_KEY);
  }

  loadManualSimulationState(): ManualSimulationState | null {
    try {
      const raw = this.driver.getItem(MANUAL_SIMULATION_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PersistentManualSimulationRecord;
      return parsed?.state ?? null;
    } catch {
      return null;
    }
  }

  saveManualSimulationState(state: ManualSimulationState): string {
    const now = new Date().toISOString();
    const payload: PersistentManualSimulationRecord = {
      updated_at: now,
      state,
    };

    this.driver.setItem(MANUAL_SIMULATION_STORAGE_KEY, JSON.stringify(payload));
    return now;
  }

  clearManualSimulationState(): void {
    this.driver.removeItem(MANUAL_SIMULATION_STORAGE_KEY);
  }

  getStorageInfo(autoSave = true): PersistentStorageInfo {
    try {
      const raw = this.driver.getItem(LEARNING_STORAGE_KEY);
      if (!raw) {
        return {
          status: "empty",
          last_save: null,
          total_records: 0,
          memory_usage: 0,
          auto_save: autoSave,
        };
      }

      const parsed = JSON.parse(raw) as PersistentLearningRecord;
      const totalRecords = parsed.engine_state?.history?.length ?? 0;

      return {
        status: "ready",
        last_save: parsed.updated_at ?? null,
        total_records: totalRecords,
        memory_usage: raw.length,
        auto_save: autoSave,
      };
    } catch {
      return {
        status: "error",
        last_save: null,
        total_records: 0,
        memory_usage: 0,
        auto_save: autoSave,
      };
    }
  }

  getPatternStorageInfo(autoSave = true): PersistentStorageInfo {
    try {
      const raw = this.driver.getItem(PATTERN_DISCOVERY_STORAGE_KEY);
      if (!raw) {
        return {
          status: "empty",
          last_save: null,
          total_records: 0,
          memory_usage: 0,
          auto_save: autoSave,
        };
      }

      const parsed = JSON.parse(raw) as PersistentPatternDiscoveryRecord;
      const totalRecords = parsed.result?.patterns?.length ?? 0;

      return {
        status: "ready",
        last_save: parsed.updated_at ?? null,
        total_records: totalRecords,
        memory_usage: raw.length,
        auto_save: autoSave,
      };
    } catch {
      return {
        status: "error",
        last_save: null,
        total_records: 0,
        memory_usage: 0,
        auto_save: autoSave,
      };
    }
  }

  getPatternRankingStorageInfo(autoSave = true): PersistentStorageInfo {
    try {
      const raw = this.driver.getItem(PATTERN_RANKING_STORAGE_KEY);
      if (!raw) {
        return {
          status: "empty",
          last_save: null,
          total_records: 0,
          memory_usage: 0,
          auto_save: autoSave,
        };
      }

      const parsed = JSON.parse(raw) as PersistentPatternRankingRecord;
      const totalRecords = parsed.result?.ranked_patterns?.length ?? 0;

      return {
        status: "ready",
        last_save: parsed.updated_at ?? null,
        total_records: totalRecords,
        memory_usage: raw.length,
        auto_save: autoSave,
      };
    } catch {
      return {
        status: "error",
        last_save: null,
        total_records: 0,
        memory_usage: 0,
        auto_save: autoSave,
      };
    }
  }

  getStrategyCenterStorageInfo(autoSave = true): PersistentStorageInfo {
    try {
      const raw = this.driver.getItem(STRATEGY_CENTER_STORAGE_KEY);
      if (!raw) {
        return {
          status: "empty",
          last_save: null,
          total_records: 0,
          memory_usage: 0,
          auto_save: autoSave,
        };
      }

      const parsed = JSON.parse(raw) as PersistentStrategyCenterRecord;
      const totalRecords = parsed.state?.history?.length ?? 0;

      return {
        status: "ready",
        last_save: parsed.updated_at ?? null,
        total_records: totalRecords,
        memory_usage: raw.length,
        auto_save: autoSave,
      };
    } catch {
      return {
        status: "error",
        last_save: null,
        total_records: 0,
        memory_usage: 0,
        auto_save: autoSave,
      };
    }
  }

  getPerformanceAnalyticsStorageInfo(autoSave = true): PersistentStorageInfo {
    try {
      const raw = this.driver.getItem(PERFORMANCE_ANALYTICS_STORAGE_KEY);
      if (!raw) {
        return {
          status: "empty",
          last_save: null,
          total_records: 0,
          memory_usage: 0,
          auto_save: autoSave,
        };
      }

      const parsed = JSON.parse(raw) as PersistentPerformanceAnalyticsRecord;
      const totalRecords = parsed.snapshot?.last_results?.length ?? 0;

      return {
        status: "ready",
        last_save: parsed.updated_at ?? null,
        total_records: totalRecords,
        memory_usage: raw.length,
        auto_save: autoSave,
      };
    } catch {
      return {
        status: "error",
        last_save: null,
        total_records: 0,
        memory_usage: 0,
        auto_save: autoSave,
      };
    }
  }
}

export const storageService = new StorageService();