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

const MAX_PERSISTED_EVENTS = 500;
const MAX_PERSISTED_ANALYSES = 200;
const MAX_PERSISTED_BACKTESTS = 50;
const MAX_PERSISTED_SIMULATIONS = 100;
const PERSIST_DEBOUNCE_MS = 350;

const STORAGE_KEY_PRIORITY = [
  PERFORMANCE_ANALYTICS_STORAGE_KEY,
  PATTERN_DISCOVERY_STORAGE_KEY,
  PATTERN_RANKING_STORAGE_KEY,
  STRATEGY_CENTER_STORAGE_KEY,
  HISTORY_IMPORT_STORAGE_KEY,
  BACKTEST_STORAGE_KEY,
  MANUAL_SIMULATION_STORAGE_KEY,
  LEARNING_STORAGE_KEY,
];

export class StorageService {
  private readonly driver: StorageDriver;
  private readonly pendingWrites = new Map<string, number>();
  private readonly pendingValues = new Map<string, string>();
  private readonly lastPersistedValues = new Map<string, string>();
  private warningMessage: string | null = null;

  constructor(driver: StorageDriver = new LocalStorageDriver()) {
    this.driver = driver;
  }

  consumeWarningMessage(): string | null {
    const next = this.warningMessage;
    this.warningMessage = null;
    return next;
  }

  private enqueuePersist(key: string, payload: unknown): void {
    const serialized = JSON.stringify(payload);
    if (this.lastPersistedValues.get(key) === serialized || this.pendingValues.get(key) === serialized) {
      return;
    }

    this.pendingValues.set(key, serialized);
    const activeTimer = this.pendingWrites.get(key);
    if (activeTimer !== undefined) {
      window.clearTimeout(activeTimer);
    }

    const timer = window.setTimeout(() => {
      this.pendingWrites.delete(key);
      this.pendingValues.delete(key);
      this.persistWithQuotaRecovery(key, serialized);
    }, PERSIST_DEBOUNCE_MS);

    this.pendingWrites.set(key, timer);
  }

  private persistWithQuotaRecovery(key: string, serialized: string): void {
    try {
      this.driver.setItem(key, serialized);
      this.lastPersistedValues.set(key, serialized);
      return;
    } catch (error) {
      if (!this.isQuotaExceeded(error)) {
        return;
      }
    }

    const removed = this.removeOldestStorageEntry(key);
    if (!removed) {
      this.warningMessage = "Armazenamento local cheio. Dados antigos foram descartados.";
      return;
    }

    try {
      this.driver.setItem(key, serialized);
      this.lastPersistedValues.set(key, serialized);
    } catch {
      this.warningMessage = "Armazenamento local cheio. Dados antigos foram descartados.";
    }
  }

  private removeOldestStorageEntry(skipKey: string): boolean {
    type Candidate = { key: string; updatedAt: number };
    const candidates: Candidate[] = [];

    for (const key of STORAGE_KEY_PRIORITY) {
      if (key === skipKey) {
        continue;
      }

      try {
        const raw = this.driver.getItem(key);
        if (!raw) {
          continue;
        }

        const parsed = JSON.parse(raw) as { updated_at?: string };
        const updatedAt = parsed?.updated_at ? new Date(parsed.updated_at).getTime() : 0;
        candidates.push({ key, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 });
      } catch {
        candidates.push({ key, updatedAt: 0 });
      }
    }

    if (!candidates.length) {
      return false;
    }

    candidates.sort((left, right) => left.updatedAt - right.updatedAt);
    const oldest = candidates[0];
    this.driver.removeItem(oldest.key);
    this.lastPersistedValues.delete(oldest.key);
    this.pendingValues.delete(oldest.key);
    return true;
  }

  private isQuotaExceeded(error: unknown): boolean {
    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
      return (
        error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014
      );
    }

    if (error instanceof Error) {
      const name = error.name.toLowerCase();
      const message = error.message.toLowerCase();
      return name.includes("quota") || message.includes("quota");
    }

    return false;
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

      return {
        ...parsed.engine_state,
        history: parsed.engine_state.history.slice(-MAX_PERSISTED_EVENTS),
      };
    } catch {
      return null;
    }
  }

  saveLearningState(state: LearningEngineState): string {
    const now = new Date().toISOString();
    const trimmedHistory = state.history.slice(-MAX_PERSISTED_EVENTS);
    const payload: PersistentLearningRecord = {
      updated_at: now,
      engine_state: {
        ...state,
        history: trimmedHistory,
        snapshot: {
          ...state.snapshot,
          last_updated_at: now,
        },
      },
    };

    this.enqueuePersist(LEARNING_STORAGE_KEY, payload);
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
      if (!parsed?.result) {
        return null;
      }

      return {
        ...parsed.result,
        patterns: parsed.result.patterns.slice(-MAX_PERSISTED_ANALYSES),
      };
    } catch {
      return null;
    }
  }

  savePatternDiscoveryResult(result: PatternDiscoveryResult): string {
    const now = new Date().toISOString();
    const patterns = result.patterns.slice(-MAX_PERSISTED_ANALYSES);
    const payload: PersistentPatternDiscoveryRecord = {
      updated_at: now,
      result: {
        ...result,
        summary: {
          ...result.summary,
          total_patterns: patterns.length,
          new_patterns: patterns.filter((item) => item.is_new).length,
          high_confidence: patterns.filter((item) => item.confidence >= 70).length,
          discarded_patterns: patterns.filter((item) => item.status === "discarded").length,
        },
        patterns,
        scanned_at: now,
      },
    };

    this.enqueuePersist(PATTERN_DISCOVERY_STORAGE_KEY, payload);
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
      if (!parsed?.result) {
        return null;
      }

      return {
        ...parsed.result,
        ranked_patterns: parsed.result.ranked_patterns.slice(-MAX_PERSISTED_ANALYSES),
      };
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
        ranked_patterns: result.ranked_patterns.slice(-MAX_PERSISTED_ANALYSES),
        scanned_at: now,
      },
    };

    this.enqueuePersist(PATTERN_RANKING_STORAGE_KEY, payload);
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
      if (!parsed?.state) {
        return null;
      }

      return {
        ...parsed.state,
        history: parsed.state.history.slice(-MAX_PERSISTED_ANALYSES),
      };
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
        history: state.history.slice(-MAX_PERSISTED_ANALYSES),
        result: {
          ...state.result,
          generated_at: now,
        },
      },
    };

    this.enqueuePersist(STRATEGY_CENTER_STORAGE_KEY, payload);
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
      if (!parsed?.snapshot) {
        return null;
      }

      return {
        ...parsed.snapshot,
        accuracy_timeline: parsed.snapshot.accuracy_timeline.slice(-MAX_PERSISTED_ANALYSES),
        learning_curve: parsed.snapshot.learning_curve.slice(-MAX_PERSISTED_ANALYSES),
        accuracy_by_hour: parsed.snapshot.accuracy_by_hour.slice(-MAX_PERSISTED_ANALYSES),
        accuracy_by_strategy: parsed.snapshot.accuracy_by_strategy.slice(-MAX_PERSISTED_ANALYSES),
        performance_by_pattern: parsed.snapshot.performance_by_pattern.slice(-MAX_PERSISTED_ANALYSES),
        last_results: parsed.snapshot.last_results.slice(-MAX_PERSISTED_ANALYSES),
      };
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
        accuracy_timeline: snapshot.accuracy_timeline.slice(-MAX_PERSISTED_ANALYSES),
        learning_curve: snapshot.learning_curve.slice(-MAX_PERSISTED_ANALYSES),
        accuracy_by_hour: snapshot.accuracy_by_hour.slice(-MAX_PERSISTED_ANALYSES),
        accuracy_by_strategy: snapshot.accuracy_by_strategy.slice(-MAX_PERSISTED_ANALYSES),
        performance_by_pattern: snapshot.performance_by_pattern.slice(-MAX_PERSISTED_ANALYSES),
        last_results: snapshot.last_results.slice(-MAX_PERSISTED_ANALYSES),
      },
    };

    this.enqueuePersist(PERFORMANCE_ANALYTICS_STORAGE_KEY, payload);
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

      return parsed.events.slice(-MAX_PERSISTED_EVENTS);
    } catch {
      return [];
    }
  }

  saveImportedHistoryEvents(events: LiveDataEvent[]): string {
    const now = new Date().toISOString();
    const payload: PersistentHistoryImportRecord = {
      updated_at: now,
      events: events.slice(-MAX_PERSISTED_EVENTS),
    };

    this.enqueuePersist(HISTORY_IMPORT_STORAGE_KEY, payload);
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

      return parsed.records.slice(-MAX_PERSISTED_BACKTESTS);
    } catch {
      return [];
    }
  }

  saveBacktestRecords(records: BacktestRecord[]): string {
    const now = new Date().toISOString();
    const payload: PersistentBacktestRecord = {
      updated_at: now,
      records: records.slice(-MAX_PERSISTED_BACKTESTS),
    };

    this.enqueuePersist(BACKTEST_STORAGE_KEY, payload);
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
      if (!parsed?.state) {
        return null;
      }

      return {
        ...parsed.state,
        records: parsed.state.records.slice(-MAX_PERSISTED_SIMULATIONS),
      };
    } catch {
      return null;
    }
  }

  saveManualSimulationState(state: ManualSimulationState): string {
    const now = new Date().toISOString();
    const payload: PersistentManualSimulationRecord = {
      updated_at: now,
      state: {
        ...state,
        records: state.records.slice(-MAX_PERSISTED_SIMULATIONS),
      },
    };

    this.enqueuePersist(MANUAL_SIMULATION_STORAGE_KEY, payload);
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