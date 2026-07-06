import { LearningEngineState } from "../learning/types";
import { PatternDiscoveryResult } from "../pattern-discovery/types";
import { LocalStorageDriver } from "./localStorageDriver";
import {
  PersistentLearningRecord,
  PersistentPatternDiscoveryRecord,
  PersistentStorageInfo,
  StorageDriver,
} from "./types";

const LEARNING_STORAGE_KEY = "double-evolution.learning-engine.v1";
const PATTERN_DISCOVERY_STORAGE_KEY = "double-evolution.pattern-discovery.v1";

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
}

export const storageService = new StorageService();