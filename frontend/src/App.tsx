import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeLaboratory } from "./api/laboratory";
import { fetchHealth } from "./api/health";
import { IntelligenceDecisionCenter } from "./components/IntelligenceDecisionCenter";
import { Panel } from "./components/Panel";
import { ReplayTimeline } from "./components/ReplayTimeline";
import { StonesGrid } from "./components/StonesGrid";
import { StatusBadge } from "./components/StatusBadge";
import { LearningEngine } from "./services/learning/learningEngine";
import { LearningSnapshot } from "./services/learning/types";
import { PatternDiscoveryEngine } from "./services/pattern-discovery/patternDiscoveryEngine";
import {
  DiscoveredPattern,
  PatternDiscoveryResult,
} from "./services/pattern-discovery/types";
import { PatternRankingEngine } from "./services/pattern-ranking/patternRankingEngine";
import {
  PatternRankingResult,
} from "./services/pattern-ranking/types";
import { PerformanceAnalytics } from "./services/performance-analytics/performanceAnalytics";
import { PerformanceAnalyticsSnapshot } from "./services/performance-analytics/types";
import { StrategyEngine } from "./services/strategy/strategyEngine";
import {
  StrategyCenterState,
  StrategyDecision,
  StrategyMode,
  StrategyResult,
} from "./services/strategy/types";
import { liveDataService } from "./services/live-data/liveDataService";
import { storageService } from "./services/storage/storageService";
import {
  BacktestRecord,
  ManualSimulationRecord,
  ManualSimulationState,
  PersistentStorageInfo,
} from "./services/storage/types";
import {
  LiveDataEvent,
  LiveDataProviderStatus,
  LiveDataProviderName,
  SimulatorSpeed,
} from "./services/live-data/types";
import {
  LaboratoryAnalyzeResponse,
  LaboratoryEvent,
  LaboratoryHealth,
} from "./types/laboratory";
import { providerManager } from "./services/provider-manager/providerManager";
import { ManagedProviderId, ProviderManagerSnapshot } from "./services/provider-manager/types";
import "./App.css";

type RequestState = "idle" | "loading" | "success" | "error" | "offline";
type LabSpeed = 1 | 2 | 5 | 10 | 20;
type ImportFormat = "csv" | "json";
type ManualEntryColor = "red" | "black" | "white";
type ManualEntryResult = "WIN" | "LOSS" | "GALE 1" | "GALE 2";

const LAB_PIPELINE_STAGES = [
  "Recebeu Evento",
  "Trend",
  "Seasonality",
  "Correlation",
  "Consensus",
  "Risk",
  "Probability",
  "Learning",
  "Decision",
] as const;

const LAB_SPEED_OPTIONS: LabSpeed[] = [1, 2, 5, 10, 20];

const BACKTEST_MIN_WINDOW = 6;

const MAX_REPLAY_HISTORY = 500;

function replayEventKey(event: LiveDataEvent): string {
  return `${event.timestamp}|${event.color}|${event.number}|${event.white ? "1" : "0"}`;
}

function mapErrorToState(err: unknown): { state: RequestState; message: string } {
  const message = err instanceof Error ? err.message : "Erro inesperado na API";
  const lower = message.toLowerCase();
  const isOffline =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network error") ||
    lower.includes("offline");

  return {
    state: isOffline ? "offline" : "error",
    message: isOffline ? "API offline ou indisponivel no momento" : message,
  };
}

function requestStateLabel(state: RequestState): string {
  if (state === "loading") {
    return "loading";
  }
  if (state === "success") {
    return "sucesso";
  }
  if (state === "error") {
    return "erro";
  }
  if (state === "offline") {
    return "offline";
  }
  return "idle";
}

function toLaboratoryEvent(event: LiveDataEvent): LaboratoryEvent {
  const when = new Date(event.timestamp);
  const classification = event.color === "red" ? "DEVEDOR" : "PAGADOR";

  return {
    timestamp: event.timestamp,
    hour: when.getUTCHours(),
    minute: when.getUTCMinutes(),
    side: event.number % 2 === 0 ? "right" : "left",
    distance: Number((event.number / 2 + 3).toFixed(1)),
    classification,
    confidence: event.white ? 72 : 84,
    score: event.white ? 1.8 : 2.4,
    triggered_rules: classification === "DEVEDOR" ? ["REG-002"] : ["REG-003"],
    recommendation: classification === "DEVEDOR" ? "Revisar" : "Aprovar",
  };
}

function formatClock(time: Date): string {
  return time.toLocaleTimeString("pt-BR", { hour12: false });
}

function providerLabel(provider: LiveDataProviderName): string {
  if (provider === "mock") {
    return "Mock";
  }
  if (provider === "manual") {
    return "Manual";
  }
  if (provider === "simulator") {
    return "Simulator";
  }
  if (provider === "external") {
    return "External";
  }
  return "WebSocket";
}

function managedProviderLabel(provider: ManagedProviderId): string {
  if (provider === "simulator") {
    return "Simulator";
  }
  if (provider === "replay") {
    return "Replay";
  }
  if (provider === "csv") {
    return "CSV";
  }
  return "WebSocket";
}

function providerAvailabilityLabel(value: "available" | "coming_soon" | "unavailable"): string {
  if (value === "available") {
    return "disponivel";
  }
  if (value === "coming_soon") {
    return "estrutura pronta";
  }
  return "indisponivel";
}

function providerStateLabel(value: "idle" | "connected" | "running" | "paused" | "stopped" | "error"): string {
  if (value === "idle") {
    return "idle";
  }
  if (value === "connected") {
    return "conectado";
  }
  if (value === "running") {
    return "executando";
  }
  if (value === "paused") {
    return "pausado";
  }
  if (value === "stopped") {
    return "parado";
  }
  return "erro";
}

function eventColorLabel(color: "red" | "black" | "white"): string {
  if (color === "red") {
    return "Vermelho";
  }
  if (color === "black") {
    return "Preto";
  }
  return "Branco";
}

function eventColorTone(color: "red" | "black" | "white"): "red" | "black" | "white" {
  return color;
}

function parseColor(value: unknown): "red" | "black" | "white" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "red" || normalized === "vermelho") {
    return "red";
  }
  if (normalized === "black" || normalized === "preto") {
    return "black";
  }
  if (normalized === "white" || normalized === "branco") {
    return "white";
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function inferColorFromNumber(number: number): "red" | "black" | "white" {
  if (number === 0) {
    return "white";
  }
  return number % 2 === 0 ? "black" : "red";
}

function normalizeImportedEvent(
  raw: Record<string, unknown>,
  previousEvents: LiveDataEvent[]
): { event: LiveDataEvent | null; error: string | null } {
  const rawNumber = parseNumber(raw.number ?? raw.numero ?? raw.n);
  const rawColor = parseColor(raw.color ?? raw.cor);
  const rawTimestamp = parseTimestamp(raw.timestamp ?? raw.time ?? raw.datetime ?? raw.datahora);

  if (rawNumber === null || rawNumber < 0 || rawNumber > 14) {
    return { event: null, error: "numero invalido" };
  }

  if (!rawTimestamp) {
    return { event: null, error: "timestamp invalido" };
  }

  const derivedColor = inferColorFromNumber(rawNumber);
  const color = rawColor ?? derivedColor;
  if (rawNumber === 0 && color !== "white") {
    return { event: null, error: "numero 0 deve ser branco" };
  }

  const previousColors = previousEvents.slice(-7).map((item) => item.color);
  const sequence = [...previousColors, color];

  return {
    event: {
      timestamp: rawTimestamp,
      color,
      number: rawNumber,
      white: color === "white",
      sequence,
    },
    error: null,
  };
}

function parseCsvRows(content: string): Record<string, unknown>[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((item) => item.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const columns = line.split(separator).map((item) => item.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = columns[index] ?? "";
    });
    return row;
  });
}

function manualDeltaByResult(result: ManualEntryResult): number {
  if (result === "WIN") {
    return 1;
  }
  if (result === "GALE 1") {
    return 0.45;
  }
  if (result === "GALE 2") {
    return 0.2;
  }
  return -1;
}

function mapTradingDecision(
  confidence: number,
  risk: number,
  connected: boolean
): "Aguardar" | "Observar" | "Entrar" {
  if (!connected) {
    return "Aguardar";
  }

  if (confidence >= 74 && risk <= 42) {
    return "Entrar";
  }

  if (confidence >= 58 && risk <= 62) {
    return "Observar";
  }

  return "Aguardar";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toPercent(value: number): number {
  if (value >= 0 && value <= 1) {
    return clampPercent(value * 100);
  }
  return clampPercent(value);
}

function pickNumericMetric(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const current = record[key];
    if (typeof current === "number" && Number.isFinite(current)) {
      return current;
    }
    if (typeof current === "string") {
      const parsed = Number.parseFloat(current.replace("%", "").trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function computeLongestColorStreak(events: LiveDataEvent[]): number {
  if (!events.length) {
    return 0;
  }

  let max = 1;
  let current = 1;

  for (let index = 1; index < events.length; index += 1) {
    if (events[index].color === events[index - 1].color) {
      current += 1;
      if (current > max) {
        max = current;
      }
    } else {
      current = 1;
    }
  }

  return max;
}

function mapDecisionStatus(
  confidence: number,
  risk: number,
  connected: boolean
): "Observando" | "Preparando Entrada" | "Entrada Confirmada" | "Aguardar" {
  if (!connected) {
    return "Aguardar";
  }

  if (confidence >= 78 && risk <= 35) {
    return "Entrada Confirmada";
  }

  if (confidence >= 62 && risk <= 52) {
    return "Preparando Entrada";
  }

  if (confidence >= 44) {
    return "Observando";
  }

  return "Aguardar";
}

function mapRiskLabel(riskPercent: number): "Muito baixo" | "Baixo" | "Médio" | "Alto" | "Muito alto" {
  if (riskPercent <= 20) {
    return "Muito baixo";
  }
  if (riskPercent <= 40) {
    return "Baixo";
  }
  if (riskPercent <= 60) {
    return "Médio";
  }
  if (riskPercent <= 80) {
    return "Alto";
  }
  return "Muito alto";
}

function suggestColor(events: LiveDataEvent[]): "Preto" | "Vermelho" | "Branco" {
  const recent = events.slice(-20);
  if (!recent.length) {
    return "Branco";
  }

  let red = 0;
  let black = 0;
  let white = 0;
  recent.forEach((event) => {
    if (event.color === "red") {
      red += 1;
    }
    if (event.color === "black") {
      black += 1;
    }
    if (event.color === "white") {
      white += 1;
    }
  });

  if (white >= red && white >= black) {
    return "Branco";
  }
  return red >= black ? "Vermelho" : "Preto";
}

function createEmptyLearning(): LearningSnapshot {
  return {
    learning_score: 0,
    samples: 0,
    accuracy: 0,
    adaptation_level: 0,
    stability: 0,
    last_updated_at: null,
    pattern_memory: {},
    trend_memory: {
      up: 0,
      down: 0,
      flat: 0,
      behavior_changes: 0,
      average_gap_seconds: 0,
    },
  };
}

function createEmptyStorageInfo(): PersistentStorageInfo {
  return {
    status: "empty",
    last_save: null,
    total_records: 0,
    memory_usage: 0,
    auto_save: true,
  };
}

function createEmptyPatternDiscovery(): PatternDiscoveryResult {
  return {
    scanned_at: new Date(0).toISOString(),
    summary: {
      total_patterns: 0,
      new_patterns: 0,
      high_confidence: 0,
      discarded_patterns: 0,
      discovery_progress: 0,
    },
    patterns: [],
  };
}

function createEmptyPatternRanking(): PatternRankingResult {
  return {
    scanned_at: new Date(0).toISOString(),
    ranked_patterns: [],
  };
}

function createEmptyStrategyResult(): StrategyResult {
  return {
    best_strategy: "Auto",
    strategy_score: 0,
    expected_win_rate: 0,
    expected_risk: 0,
    confidence: 0,
    expected_delay: 0,
    recommendation: "Aguardando dados para estrategia.",
    reason: "Sem dados suficientes para classificar estrategia.",
    generated_at: new Date(0).toISOString(),
    strategy_scores: [],
  };
}

function createEmptyPerformanceAnalytics(): PerformanceAnalyticsSnapshot {
  return {
    updated_at: new Date(0).toISOString(),
    overall_accuracy: 0,
    todays_accuracy: 0,
    last_100_predictions: 0,
    win_rate: 0,
    loss_rate: 0,
    average_confidence: 0,
    average_risk: 0,
    prediction_accuracy: 0,
    strategy_accuracy: 0,
    pattern_accuracy: 0,
    learning_evolution: 0,
    best_strategy: "-",
    worst_strategy: "-",
    best_pattern: "-",
    worst_pattern: "-",
    win_loss_chart: {
      wins: 0,
      losses: 0,
    },
    accuracy_timeline: [],
    learning_curve: [],
    accuracy_by_hour: [],
    accuracy_by_strategy: [],
    performance_by_pattern: [],
    last_results: [],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatMetric(value: unknown, fallback = "-"): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return fallback;
}

function pickMetric(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "-"
): string {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    if (key in record) {
      return formatMetric(record[key], fallback);
    }
  }

  return fallback;
}

function App() {
  const [health, setHealth] = useState<LaboratoryHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerName, setProviderName] = useState<LiveDataProviderName>(
    liveDataService.getProviderName()
  );
  const [simulatorSpeed, setSimulatorSpeed] = useState<SimulatorSpeed>("normal");
  const [availableProviders] = useState<LiveDataProviderName[]>(
    liveDataService.getAvailableProviders()
  );
  const [liveConnected, setLiveConnected] = useState(liveDataService.isConnected());
  const [liveEvents, setLiveEvents] = useState<LiveDataEvent[]>(liveDataService.getLatestEvents());
  const [providerStatus, setProviderStatus] = useState<LiveDataProviderStatus>(
    liveDataService.getProviderStatus()
  );
  const [replayHistory, setReplayHistory] = useState<LiveDataEvent[]>([]);
  const [analysis, setAnalysis] = useState<LaboratoryAnalyzeResponse | null>(
    null
  );
  const [healthState, setHealthState] = useState<RequestState>("idle");
  const [analysisState, setAnalysisState] = useState<RequestState>("idle");
  const [healthError, setHealthError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [learning, setLearning] = useState<LearningSnapshot>(createEmptyLearning);
  const [storageInfo, setStorageInfo] = useState<PersistentStorageInfo>(createEmptyStorageInfo);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [patternDiscovery, setPatternDiscovery] = useState<PatternDiscoveryResult>(
    createEmptyPatternDiscovery
  );
  const [patternRanking, setPatternRanking] = useState<PatternRankingResult>(
    createEmptyPatternRanking
  );
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("auto");
  const [manualStrategy, setManualStrategy] = useState<
    "Conservative" | "Balanced" | "Aggressive" | "Adaptive" | "Experimental"
  >("Balanced");
  const [strategyResult, setStrategyResult] = useState<StrategyResult>(
    createEmptyStrategyResult
  );
  const [strategyHistory, setStrategyHistory] = useState<StrategyDecision[]>([]);
  const [performanceAnalytics, setPerformanceAnalytics] = useState<PerformanceAnalyticsSnapshot>(
    createEmptyPerformanceAnalytics
  );
  const [isScanningPatterns, setIsScanningPatterns] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [importedHistory, setImportedHistory] = useState<LiveDataEvent[]>([]);
  const [importFormat, setImportFormat] = useState<ImportFormat>("csv");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportTotal, setLastImportTotal] = useState(0);
  const [replayCursor, setReplayCursor] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<LabSpeed>(1);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [backtestRecords, setBacktestRecords] = useState<BacktestRecord[]>([]);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestMessage, setBacktestMessage] = useState<string | null>(null);
  const [manualEntryColor, setManualEntryColor] = useState<ManualEntryColor>("red");
  const [manualEntryResult, setManualEntryResult] = useState<ManualEntryResult>("WIN");
  const [manualBankrollStart, setManualBankrollStart] = useState(100);
  const [manualSimulationRecords, setManualSimulationRecords] = useState<ManualSimulationRecord[]>([]);
  const [manualBankrollCurrent, setManualBankrollCurrent] = useState(100);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<
    "estatisticas" | "padroes" | "performance" | "replay" | "simulacao" | "logs"
  >("estatisticas");
  const [isLabMode, setIsLabMode] = useState(true);
  const [labCursor, setLabCursor] = useState(0);
  const [isLabPlaying, setIsLabPlaying] = useState(false);
  const [isLabLoopEnabled, setIsLabLoopEnabled] = useState(false);
  const [labSpeed, setLabSpeed] = useState<LabSpeed>(1);
  const [pipelineStepIndex, setPipelineStepIndex] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);
  const [providerSnapshot, setProviderSnapshot] = useState<ProviderManagerSnapshot>(() => {
    const activeProvider = providerManager.getActiveProvider();
    const providers = providerManager.getAllStatuses();
    return {
      activeProvider,
      activeStatus: providers[activeProvider],
      providers,
    };
  });

  const debounceTimerRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const pendingAutoAnalyzeRef = useRef(false);
  const lastAnalysisSignatureRef = useRef<string>("");
  const strategyHistoryRef = useRef<StrategyDecision[]>([]);
  const performanceAnalyticsRef = useRef<PerformanceAnalyticsSnapshot>(
    createEmptyPerformanceAnalytics()
  );
  const pipelineTimerRef = useRef<number | null>(null);
  const learningEngineRef = useRef(new LearningEngine());
  const patternDiscoveryEngineRef = useRef(new PatternDiscoveryEngine());
  const patternRankingEngineRef = useRef(new PatternRankingEngine());
  const performanceAnalyticsEngineRef = useRef(new PerformanceAnalytics());
  const strategyEngineRef = useRef(new StrategyEngine());
  const replaySeenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = providerManager.subscribe((snapshot) => {
      setProviderSnapshot(snapshot);
    });

    return unsubscribe;
  }, []);

  const appendReplayHistory = useCallback((events: LiveDataEvent[]) => {
    if (!events.length) {
      return;
    }

    setReplayHistory((previous) => {
      const next = [...previous];

      for (const event of events) {
        const key = replayEventKey(event);
        if (replaySeenKeysRef.current.has(key)) {
          continue;
        }

        replaySeenKeysRef.current.add(key);
        next.push(event);
      }

      if (next.length <= MAX_REPLAY_HISTORY) {
        return next;
      }

      const overflow = next.length - MAX_REPLAY_HISTORY;
      const removed = next.splice(0, overflow);
      removed.forEach((event) => {
        replaySeenKeysRef.current.delete(replayEventKey(event));
      });

      return next;
    });
  }, []);

  const refreshStorageInfo = useCallback(() => {
    setStorageInfo(storageService.getStorageInfo(true));
  }, []);

  const saveLearningNow = useCallback(() => {
    try {
      const state = learningEngineRef.current.exportState();
      const savedAt = storageService.saveLearningState(state);
      refreshStorageInfo();
      setStorageMessage(`Memoria salva em ${formatClock(new Date(savedAt))}`);
    } catch {
      setStorageMessage("Falha ao salvar memoria");
      refreshStorageInfo();
    }
  }, [refreshStorageInfo]);

  const appendStrategyHistory = useCallback(
    (
      result: StrategyResult,
      mode: StrategyMode,
      previous: StrategyDecision[]
    ): StrategyDecision[] => {
      const now = result.generated_at;
      const latest = previous[0];

      if (
        latest &&
        latest.strategy === result.best_strategy &&
        latest.mode === mode &&
        Math.abs(latest.strategy_score - result.strategy_score) < 0.5
      ) {
        return previous;
      }

      const nextEntry: StrategyDecision = {
        strategy: result.best_strategy,
        strategy_score: result.strategy_score,
        expected_win_rate: result.expected_win_rate,
        expected_risk: result.expected_risk,
        confidence: result.confidence,
        expected_delay: result.expected_delay,
        recommendation: result.recommendation,
        reason: result.reason,
        selected_at: now,
        mode,
      };

      return [nextEntry, ...previous].slice(0, 20);
    },
    []
  );

  const runStrategySelection = useCallback(
    (
      nextMode: StrategyMode,
      nextManual: "Conservative" | "Balanced" | "Aggressive" | "Adaptive" | "Experimental",
      historyBase?: StrategyDecision[]
    ) => {
      const state = learningEngineRef.current.exportState();

      const result = strategyEngineRef.current.evaluate({
        ranking: patternRanking,
        discovery: patternDiscovery,
        learningState: state,
        trend: analysis?.trend ?? null,
        seasonality: analysis?.seasonality ?? null,
        consensus: analysis?.consensus ?? null,
        risk: analysis?.risk ?? null,
        signal: analysis?.signal ?? null,
        liveEvents,
        mode: nextMode,
        manualStrategy: nextManual,
      });

      const base = historyBase ?? strategyHistoryRef.current;
      const updatedHistory = appendStrategyHistory(result, nextMode, base);
      setStrategyResult(result);
      setStrategyHistory(updatedHistory);

      const centerState: StrategyCenterState = {
        mode: nextMode,
        manual_strategy: nextManual,
        result,
        history: updatedHistory,
      };

      storageService.saveStrategyCenterState(centerState);
      refreshStorageInfo();
    },
    [
      analysis,
      appendStrategyHistory,
      liveEvents,
      patternDiscovery,
      patternRanking,
      refreshStorageInfo,
    ]
  );

  useEffect(() => {
    strategyHistoryRef.current = strategyHistory;
  }, [strategyHistory]);

  useEffect(() => {
    performanceAnalyticsRef.current = performanceAnalytics;
  }, [performanceAnalytics]);

  const runPerformanceAnalytics = useCallback(
    (nextStrategy?: StrategyResult, nextStrategyHistory?: StrategyDecision[]) => {
      const snapshot = performanceAnalyticsEngineRef.current.evaluate({
        strategy: nextStrategy ?? strategyResult,
        strategyHistory: nextStrategyHistory ?? strategyHistoryRef.current,
        learning,
        ranking: patternRanking,
        signal: analysis?.signal ?? null,
        liveEvents,
        historicalResults: performanceAnalyticsRef.current.last_results,
      });

      performanceAnalyticsRef.current = snapshot;
      setPerformanceAnalytics(snapshot);
      storageService.savePerformanceAnalyticsSnapshot(snapshot);
      refreshStorageInfo();
    },
    [analysis, learning, liveEvents, patternRanking, refreshStorageInfo, strategyResult]
  );

  useEffect(() => {
    if (!liveEvents.length) {
      return;
    }

    runPerformanceAnalytics(strategyResult, strategyHistory);
  }, [
    liveEvents.length,
    runPerformanceAnalytics,
    strategyHistory,
    strategyResult,
  ]);

  const clearLearningMemory = useCallback(() => {
    const confirmClear = window.confirm(
      "Tem certeza que deseja limpar a memoria persistente do LearningEngine?"
    );
    if (!confirmClear) {
      return;
    }

    storageService.clearLearningState();
    storageService.clearPatternDiscoveryResult();
    storageService.clearPatternRankingResult();
    storageService.clearStrategyCenterState();
    storageService.clearPerformanceAnalyticsSnapshot();
    learningEngineRef.current = new LearningEngine();
    lastIngestedIndexRef.current = 0;
    setLearning(createEmptyLearning());
    setStorageMessage("Memoria persistente removida");
    setPatternDiscovery(createEmptyPatternDiscovery());
    setPatternRanking(createEmptyPatternRanking());
    setStrategyMode("auto");
    setManualStrategy("Balanced");
    setStrategyResult(createEmptyStrategyResult());
    setStrategyHistory([]);
    setPerformanceAnalytics(createEmptyPerformanceAnalytics());
    performanceAnalyticsRef.current = createEmptyPerformanceAnalytics();
    setScanProgress(0);
    setScanMessage(null);
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const lastIngestedIndexRef = useRef(0);

  const executeAnalysis = useCallback(
    async (reason: "auto" | "manual") => {
      if (isAnalyzingRef.current) {
        if (reason === "auto") {
          pendingAutoAnalyzeRef.current = true;
        }
        return;
      }

      if (isLabMode && providerName === "external") {
        setAnalysisState("error");
        setAnalysisError("LAB MODE ativo: use Simulator, Replay, CSV ou WebSocket.");
        return;
      }

      const streamEvents = liveDataService.getLatestEvents().slice(-24);
      const events = streamEvents.map(toLaboratoryEvent);
      if (!events.length) {
        setAnalysisState("idle");
        setAnalysisError("Sem eventos no Live Data Service para analise");
        return;
      }

      const latest = streamEvents[streamEvents.length - 1];
      const signature = `${streamEvents.length}-${latest.timestamp}-${latest.number}-${latest.color}`;
      if (reason === "auto" && signature === lastAnalysisSignatureRef.current) {
        return;
      }

      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      setAnalysisError(null);
      setAnalysisState("loading");
      const startedAt = performance.now();

      try {
        const result = await analyzeLaboratory({ events });
        setAnalysis(result);
        setAnalysisState("success");
        setLastAnalyzedAt(new Date());
        setProcessingTimeMs(Math.max(1, Math.round(performance.now() - startedAt)));
        lastAnalysisSignatureRef.current = signature;
        if (patternRanking.ranked_patterns.length || patternDiscovery.patterns.length) {
          runStrategySelection(strategyMode, manualStrategy);
        }
      } catch (err) {
        const mapped = mapErrorToState(err);
        setAnalysisState(mapped.state);
        setAnalysisError(mapped.message);
        setProcessingTimeMs(Math.max(1, Math.round(performance.now() - startedAt)));
      } finally {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;

        if (pendingAutoAnalyzeRef.current) {
          pendingAutoAnalyzeRef.current = false;
          if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            debounceTimerRef.current = null;
            void executeAnalysis("auto");
          }, 500);
        }
      }
    },
    [
      isLabMode,
      manualStrategy,
      patternDiscovery.patterns.length,
      patternRanking.ranked_patterns.length,
      providerName,
      runStrategySelection,
      strategyMode,
    ]
  );

  const scheduleAutoAnalyze = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void executeAnalysis("auto");
    }, 500);
  }, [executeAnalysis]);

  const pushManualEvent = useCallback(() => {
    if (providerName !== "manual") {
      return;
    }

    const number = Math.floor(Math.random() * 15);
    const color: "red" | "black" | "white" =
      number === 0 ? "white" : number % 2 === 0 ? "black" : "red";
    const current = liveDataService.getLatestEvents();
    const sequence = [...current.slice(-7).map((item) => item.color), color];

    liveDataService.pushManualEvent?.({
      timestamp: new Date().toISOString(),
      color,
      number,
      white: color === "white",
      sequence,
    });
  }, [providerName]);

  useEffect(() => {
    const restored = storageService.loadLearningState();
    if (restored) {
      learningEngineRef.current = new LearningEngine(restored);
      setLearning(learningEngineRef.current.getSnapshot());
      lastIngestedIndexRef.current = 0;
      setStorageMessage("Memoria carregada automaticamente");
    }

    const storedDiscovery = storageService.loadPatternDiscoveryResult();
    if (storedDiscovery) {
      setPatternDiscovery(storedDiscovery);
    }

    const storedRanking = storageService.loadPatternRankingResult();
    if (storedRanking) {
      setPatternRanking(storedRanking);
    }

    const storedStrategy = storageService.loadStrategyCenterState();
    if (storedStrategy) {
      setStrategyMode(storedStrategy.mode);
      setManualStrategy(storedStrategy.manual_strategy);
      setStrategyResult(storedStrategy.result);
      setStrategyHistory(storedStrategy.history);
    }

    const storedPerformance = storageService.loadPerformanceAnalyticsSnapshot();
    if (storedPerformance) {
      setPerformanceAnalytics(storedPerformance);
      performanceAnalyticsRef.current = storedPerformance;
    }

    refreshStorageInfo();

    const unsubscribe = liveDataService.subscribe((events) => {
      setLiveEvents(events);
      appendReplayHistory(events);
      setLiveConnected(liveDataService.isConnected());
      setProviderName(liveDataService.getProviderName());
      setProviderStatus(liveDataService.getProviderStatus());

      if (events.length >= lastIngestedIndexRef.current) {
        const newEvents = events.slice(lastIngestedIndexRef.current);
        newEvents.forEach((event) => learningEngineRef.current.ingest(event));
        if (newEvents.length) {
          setLearning(learningEngineRef.current.getSnapshot());
          saveLearningNow();
          if (patternRanking.ranked_patterns.length || patternDiscovery.patterns.length) {
            runStrategySelection(strategyMode, manualStrategy);
          } else {
            runPerformanceAnalytics();
          }
        }
        lastIngestedIndexRef.current = events.length;
      } else {
        lastIngestedIndexRef.current = events.length;
      }

      if (events.length) {
        scheduleAutoAnalyze();
      }
    });

    liveDataService.connect();
    handleCheckHealth();

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      unsubscribe();
      liveDataService.disconnect();
    };
  }, [
    manualStrategy,
    patternDiscovery.patterns.length,
    patternRanking.ranked_patterns.length,
    refreshStorageInfo,
    runPerformanceAnalytics,
    runStrategySelection,
    saveLearningNow,
    scheduleAutoAnalyze,
    strategyMode,
    appendReplayHistory,
  ]);

  function handleConnectLiveData() {
    if (providerName === "simulator") {
      liveDataService.startSimulator?.();
    } else {
      liveDataService.connect();
    }
    setLiveConnected(liveDataService.isConnected());
    setLiveEvents(liveDataService.getLatestEvents());
    setProviderStatus(liveDataService.getProviderStatus());
  }

  function handleDisconnectLiveData() {
    liveDataService.disconnect();
    setLiveConnected(liveDataService.isConnected());
    setProviderStatus(liveDataService.getProviderStatus());
  }

  function handleProviderChange(name: LiveDataProviderName) {
    liveDataService.setProvider(name);
    if (name === "simulator") {
      liveDataService.setSimulatorSpeed?.(simulatorSpeed);
      liveDataService.startSimulator?.();
    }
    setProviderName(liveDataService.getProviderName());
    setLiveConnected(liveDataService.isConnected());
    setLiveEvents(liveDataService.getLatestEvents());
    setProviderStatus(liveDataService.getProviderStatus());
    setReplayHistory([]);
    replaySeenKeysRef.current = new Set();
    learningEngineRef.current = new LearningEngine();
    lastIngestedIndexRef.current = 0;
    setLearning(createEmptyLearning());
    refreshStorageInfo();
  }

  function handleSimulatorSpeedChange(nextSpeed: SimulatorSpeed) {
    setSimulatorSpeed(nextSpeed);
    liveDataService.setSimulatorSpeed?.(nextSpeed);
  }

  function handleSimulatorStart() {
    liveDataService.startSimulator?.();
    setLiveConnected(liveDataService.isConnected());
    setLiveEvents(liveDataService.getLatestEvents());
    setProviderStatus(liveDataService.getProviderStatus());
  }

  function handleSimulatorPause() {
    liveDataService.pauseSimulator?.();
    setLiveConnected(liveDataService.isConnected());
    setProviderStatus(liveDataService.getProviderStatus());
  }

  function handleSimulatorReset() {
    liveDataService.resetSimulator?.();
    setLiveEvents(liveDataService.getLatestEvents());
    setProviderStatus(liveDataService.getProviderStatus());
  }

  function handleManagerProviderChange(nextProvider: ManagedProviderId) {
    providerManager.setActiveProvider(nextProvider);
  }

  function handleManagerConnect() {
    providerManager.connect();
  }

  function handleManagerDisconnect() {
    providerManager.disconnect();
  }

  function handleManagerStart() {
    providerManager.start();
  }

  function handleManagerPause() {
    providerManager.pause();
  }

  function handleManagerReset() {
    providerManager.reset();
  }

  async function handleCheckHealth() {
    setIsCheckingHealth(true);
    setHealthError(null);
    setHealthState("loading");
    try {
      const status = await fetchHealth();
      setHealth(status);
      setHealthState("success");
    } catch (err) {
      const mapped = mapErrorToState(err);
      setHealthState(mapped.state);
      setHealthError(mapped.message);
      setHealth({ status: "offline", module: "laboratory" });
    } finally {
      setIsCheckingHealth(false);
    }
  }

  async function handleAnalyze() {
    await executeAnalysis("manual");
  }

  function handleAutoStrategy() {
    setStrategyMode("auto");
    runStrategySelection("auto", manualStrategy);
  }

  function handleManualStrategy() {
    setStrategyMode("manual");
    runStrategySelection("manual", manualStrategy);
  }

  async function handleScanHistory() {
    if (isScanningPatterns) {
      return;
    }

    const state = learningEngineRef.current.exportState();
    const previousPatterns: DiscoveredPattern[] = patternDiscovery.patterns;

    setIsScanningPatterns(true);
    setScanMessage("Escaneando historico...");
    setScanProgress(5);

    try {
      await delay(80);
      setScanProgress(20);
      await delay(80);
      setScanProgress(45);

      const result = patternDiscoveryEngineRef.current.scan(state, previousPatterns);
      const ranking = patternRankingEngineRef.current.rank(result, state);

      await delay(80);
      setScanProgress(75);
      storageService.savePatternDiscoveryResult(result);
      storageService.savePatternRankingResult(ranking);
      refreshStorageInfo();

      await delay(80);
      setPatternDiscovery(result);
      setPatternRanking(ranking);
      runStrategySelection(strategyMode, manualStrategy);
      setScanProgress(100);
      setScanMessage(`Scan concluido as ${formatClock(new Date())}`);
    } catch {
      setScanMessage("Falha ao escanear historico");
      setScanProgress(0);
    } finally {
      setIsScanningPatterns(false);
    }
  }

  const navItems = [
    "Dashboard",
    "Live",
    "IA",
    "Estrategias",
    "Simulacao",
    "Backtest",
    "Historico",
    "Estatisticas",
    "Configuracoes",
  ];

  const headerAccuracy = `${performanceAnalytics.overall_accuracy.toFixed(1)}%`;
  const headerConfidence = `${performanceAnalytics.average_confidence.toFixed(1)}%`;
  const tradingDecision = mapTradingDecision(
    performanceAnalytics.average_confidence,
    performanceAnalytics.average_risk,
    liveConnected
  );
  const headerStatus =
    healthState === "success" ? health?.status ?? "online" : requestStateLabel(healthState);

  const confidencePercent = clampPercent(performanceAnalytics.average_confidence);
  const riskPercent = clampPercent(performanceAnalytics.average_risk);
  const trendValue = toPercent(
    pickNumericMetric(analysis?.trend, ["strength", "score", "trend_strength", "confidence", "value"]) ??
      confidencePercent * 0.75
  );
  const probabilityValue = toPercent(
    pickNumericMetric(analysis?.probability, ["probability", "chance", "score", "confidence"]) ??
      confidencePercent
  );
  const correlationValue = toPercent(
    pickNumericMetric(analysis?.correlation, ["correlation", "strength", "score", "confidence"]) ?? 50
  );
  const consensusValue = toPercent(
    pickNumericMetric(analysis?.consensus, ["consensus", "score", "confidence", "agreement"]) ??
      confidencePercent * 0.86
  );
  const seasonalityValue = toPercent(
    pickNumericMetric(analysis?.seasonality, ["seasonality", "score", "confidence", "intensity"]) ?? 52
  );
  const learningValue = clampPercent(learning.learning_score);
  const accuracyValue = clampPercent(performanceAnalytics.overall_accuracy);
  const centerStatus = mapDecisionStatus(confidencePercent, riskPercent, liveConnected);
  const riskLabel = mapRiskLabel(riskPercent);
  const suggestedColor = suggestColor(liveEvents);

  const engineIndicators = [
    { name: "Trend", value: trendValue },
    { name: "Probability", value: probabilityValue },
    { name: "Correlation", value: correlationValue },
    { name: "Consensus", value: consensusValue },
    { name: "Seasonality", value: seasonalityValue },
    { name: "Risk", value: riskPercent },
    { name: "Learning", value: learningValue },
    { name: "Confidence", value: confidencePercent },
    { name: "Accuracy", value: accuracyValue },
  ];

  const decisionJustifications = useMemo(() => {
    const phrases: string[] = [];

    if (centerStatus === "Entrada Confirmada") {
      phrases.push("Confluencia elevada.");
    }
    if (centerStatus === "Preparando Entrada") {
      phrases.push("Aguardar confirmacao.");
    }
    if (centerStatus === "Observando") {
      phrases.push("Mercado lateral.");
    }
    if (probabilityValue >= 68) {
      phrases.push("Alta probabilidade.");
    }
    if (confidencePercent < 48) {
      phrases.push("Baixa confianca.");
    }
    if (seasonalityValue >= 58) {
      phrases.push("Regime favoravel.");
    }
    if (computeLongestColorStreak(liveEvents.slice(-36)) >= 4) {
      phrases.push("Sequencia consistente.");
    }
    if (!liveConnected) {
      phrases.push("Aguardar confirmacao.");
    }

    const unique = Array.from(new Set(phrases));
    if (!unique.length) {
      return ["Aguardar confirmacao."];
    }
    return unique.slice(0, 4);
  }, [
    centerStatus,
    confidencePercent,
    liveConnected,
    liveEvents,
    probabilityValue,
    seasonalityValue,
  ]);

  const managedProviders: ManagedProviderId[] = ["simulator", "replay", "csv", "websocket"];
  const activeManagedStatus = providerSnapshot.activeStatus;
  const labEvents = useMemo(() => {
    if (replayHistory.length) {
      return replayHistory;
    }
    return liveEvents;
  }, [liveEvents, replayHistory]);
  const safeLabCursor = labEvents.length ? Math.max(0, Math.min(labCursor, labEvents.length - 1)) : 0;
  const currentLabEvent = labEvents.length ? labEvents[safeLabCursor] : null;
  const pipelineLastIndex = LAB_PIPELINE_STAGES.length - 1;
  const scoreGeral = Number(
    (
      (trendValue + seasonalityValue + correlationValue + consensusValue + probabilityValue + learningValue) /
      6
    ).toFixed(1)
  );
  const debugStatus =
    analysisState === "loading"
      ? "processando"
      : analysisState === "success"
        ? "ativo"
        : analysisState === "offline"
          ? "offline"
          : "aguardando";

  useEffect(() => {
    if (!labEvents.length) {
      setLabCursor(0);
      setIsLabPlaying(false);
      return;
    }

    setLabCursor((previous) => Math.min(previous, labEvents.length - 1));
  }, [labEvents.length]);

  useEffect(() => {
    if (!isLabPlaying || !labEvents.length) {
      return;
    }

    const tickMs = Math.max(80, Math.round(900 / labSpeed));
    const timer = window.setInterval(() => {
      setLabCursor((previous) => {
        if (previous >= labEvents.length - 1) {
          if (isLabLoopEnabled) {
            return 0;
          }
          setIsLabPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, tickMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLabLoopEnabled, isLabPlaying, labEvents.length, labSpeed]);

  useEffect(() => {
    if (pipelineTimerRef.current !== null) {
      window.clearInterval(pipelineTimerRef.current);
      pipelineTimerRef.current = null;
    }

    if (!currentLabEvent) {
      setPipelineStepIndex(0);
      return;
    }

    setPipelineStepIndex(0);
    let nextStep = 0;
    const timer = window.setInterval(() => {
      nextStep += 1;
      if (nextStep >= LAB_PIPELINE_STAGES.length) {
        setPipelineStepIndex(pipelineLastIndex);
        window.clearInterval(timer);
        pipelineTimerRef.current = null;
        return;
      }
      setPipelineStepIndex(nextStep);
    }, isAnalyzing || analysisState === "loading" ? 180 : 260);

    pipelineTimerRef.current = timer;

    return () => {
      window.clearInterval(timer);
      if (pipelineTimerRef.current === timer) {
        pipelineTimerRef.current = null;
      }
    };
  }, [analysisState, currentLabEvent, isAnalyzing, pipelineLastIndex, safeLabCursor]);

  function handleLabPlay() {
    if (!labEvents.length) {
      return;
    }

    if (safeLabCursor >= labEvents.length - 1) {
      setLabCursor(0);
    }
    setIsLabPlaying(true);
  }

  function handleLabPause() {
    setIsLabPlaying(false);
  }

  function handleLabPreviousEvent() {
    if (!labEvents.length) {
      return;
    }

    setIsLabPlaying(false);
    setLabCursor((previous) => {
      if (previous <= 0) {
        return isLabLoopEnabled ? labEvents.length - 1 : 0;
      }
      return previous - 1;
    });
  }

  function handleLabNextEvent() {
    if (!labEvents.length) {
      return;
    }

    setIsLabPlaying(false);
    setLabCursor((previous) => {
      if (previous >= labEvents.length - 1) {
        return isLabLoopEnabled ? 0 : previous;
      }
      return previous + 1;
    });
  }

  return (
    <main className="pro-dashboard">
      <aside className="sidebar">
        <div className="brand-mini">DE</div>
        <div className="sidebar-title">Double Evolution IA</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`nav-item ${item === "Dashboard" ? "nav-item-active" : ""}`}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.slice(0, 2).toUpperCase()}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="top-header">
          <div className="top-header-brand">
            <h1>Double Evolution IA</h1>
            <p>Professional Data Intelligence Dashboard</p>
          </div>
          <div className="header-metrics">
            <article className="header-chip">
              <span>Status Online</span>
              <StatusBadge status={headerStatus} />
            </article>
            <article className="header-chip">
              <span>Provider ativo</span>
              <strong>{providerLabel(providerName)}</strong>
            </article>
            <article className="header-chip">
              <span>Eventos recebidos</span>
              <strong>{liveEvents.length}</strong>
            </article>
            <article className="header-chip">
              <span>Accuracy</span>
              <strong>{headerAccuracy}</strong>
            </article>
            <article className="header-chip">
              <span>Confidence</span>
              <strong>{headerConfidence}</strong>
            </article>
            <article className="header-chip">
              <span>Learning Score</span>
              <strong>{learning.learning_score}</strong>
            </article>
            <article className="header-chip">
              <span>Ultima decisao</span>
              <strong>{tradingDecision}</strong>
            </article>
          </div>
        </header>

        <section className="center-zone">
          <Panel title="Painel das Pedras" subtitle="Grid profissional com atualizacao automatica por evento">
            <StonesGrid events={liveEvents} />
          </Panel>

          <div className="ia-column">
            <Panel title="LAB MODE" subtitle="Laboratorio isolado para testes com Replay, Simulator, CSV e WebSocket">
              <div className="lab-mode-row">
                <label className="lab-mode-toggle" htmlFor="lab-mode-toggle">
                  <input
                    id="lab-mode-toggle"
                    type="checkbox"
                    checked={isLabMode}
                    onChange={(event) => setIsLabMode(event.target.checked)}
                  />
                  <span>{isLabMode ? "Laboratorio ativo" : "Laboratorio inativo"}</span>
                </label>
                <span className={`lab-mode-pill ${isLabMode ? "lab-mode-pill-active" : "lab-mode-pill-inactive"}`}>
                  {isLabMode ? "test environment" : "modo misto"}
                </span>
              </div>

              <div className="lab-source-grid">
                {managedProviders.map((provider) => {
                  const itemStatus = providerSnapshot.providers[provider];
                  const isActive = providerSnapshot.activeProvider === provider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      className={`lab-source-card ${isActive ? "lab-source-card-active" : ""}`}
                      onClick={() => handleManagerProviderChange(provider)}
                    >
                      <strong>{managedProviderLabel(provider)}</strong>
                      <span>{providerStateLabel(itemStatus.state)}</span>
                      <small>{providerAvailabilityLabel(itemStatus.availability)}</small>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Evento Atual" subtitle="Leitura do evento sob analise no laboratorio">
              <div className="lab-event-grid">
                <article className="lab-event-card">
                  <span>Evento</span>
                  <strong>{currentLabEvent ? `#${safeLabCursor + 1}` : "-"}</strong>
                </article>
                <article className="lab-event-card">
                  <span>Horario</span>
                  <strong>{currentLabEvent ? formatClock(new Date(currentLabEvent.timestamp)) : "-"}</strong>
                </article>
                <article className="lab-event-card">
                  <span>Numero</span>
                  <strong>{currentLabEvent ? currentLabEvent.number : "-"}</strong>
                </article>
                <article className="lab-event-card">
                  <span>Cor</span>
                  <strong
                    className={`lab-event-color-${
                      currentLabEvent ? eventColorTone(currentLabEvent.color) : "white"
                    }`}
                  >
                    {currentLabEvent ? eventColorLabel(currentLabEvent.color) : "-"}
                  </strong>
                </article>
                <article className="lab-event-card">
                  <span>Branco</span>
                  <strong>{currentLabEvent ? (currentLabEvent.white ? "Sim" : "Nao") : "-"}</strong>
                </article>
                <article className="lab-event-card lab-event-card-sequence">
                  <span>Sequencia</span>
                  <strong>
                    {currentLabEvent && currentLabEvent.sequence.length
                      ? currentLabEvent.sequence.slice(-8).join(" > ")
                      : "-"}
                  </strong>
                </article>
              </div>
            </Panel>

            <Panel title="Pipeline" subtitle="Estado da IA em tempo real durante o processamento">
              <div className="lab-pipeline-flow" aria-label="Pipeline horizontal do laboratorio">
                {LAB_PIPELINE_STAGES.map((stage, index) => {
                  const tone =
                    index === pipelineStepIndex ? "active" : index < pipelineStepIndex ? "done" : "idle";
                  return (
                    <div className="lab-pipeline-node-wrap" key={stage}>
                      <article className={`lab-pipeline-node lab-pipeline-node-${tone}`}>
                        <span>{stage}</span>
                      </article>
                      {index < pipelineLastIndex ? <span className="lab-pipeline-arrow">→</span> : null}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Painel de Debug" subtitle="Apenas metricas operacionais, sem exibicao de regras internas">
              <div className="lab-debug-grid">
                <article className="lab-debug-card">
                  <span>tempo processamento</span>
                  <strong>{processingTimeMs ? `${processingTimeMs} ms` : "-"}</strong>
                </article>
                <article className="lab-debug-card">
                  <span>score geral</span>
                  <strong>{scoreGeral.toFixed(1)}%</strong>
                </article>
                <article className="lab-debug-card">
                  <span>confianca</span>
                  <strong>{confidencePercent.toFixed(1)}%</strong>
                </article>
                <article className="lab-debug-card">
                  <span>risco</span>
                  <strong>{riskPercent.toFixed(1)}%</strong>
                </article>
                <article className="lab-debug-card">
                  <span>status</span>
                  <strong>{debugStatus}</strong>
                </article>
              </div>
            </Panel>

            <Panel title="Controles" subtitle="Play, Pause, navegacao de evento, velocidade e loop">
              <div className="lab-controls-row">
                <button className="analyze-button" type="button" onClick={handleLabPlay} disabled={!labEvents.length}>
                  Play
                </button>
                <button className="analyze-button" type="button" onClick={handleLabPause}>
                  Pause
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleLabNextEvent}
                  disabled={!labEvents.length}
                >
                  Proximo Evento
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleLabPreviousEvent}
                  disabled={!labEvents.length}
                >
                  Evento Anterior
                </button>
              </div>

              <div className="lab-controls-row">
                <label className="provider-select">
                  Velocidade
                  <select
                    value={String(labSpeed)}
                    onChange={(event) => setLabSpeed(Number(event.target.value) as LabSpeed)}
                  >
                    {LAB_SPEED_OPTIONS.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}x
                      </option>
                    ))}
                  </select>
                </label>

                <label className="lab-loop-toggle" htmlFor="lab-loop-toggle">
                  <input
                    id="lab-loop-toggle"
                    type="checkbox"
                    checked={isLabLoopEnabled}
                    onChange={(event) => setIsLabLoopEnabled(event.target.checked)}
                  />
                  <span>Loop</span>
                </label>

                <span className="lab-cursor-meta">
                  Evento atual: {labEvents.length ? `${safeLabCursor + 1}/${labEvents.length}` : "0/0"}
                </span>
              </div>
            </Panel>

            <IntelligenceDecisionCenter
              status={centerStatus}
              suggestedColor={suggestedColor}
              confidence={confidencePercent}
              riskLabel={riskLabel}
              engineIndicators={engineIndicators}
              justifications={decisionJustifications}
              streamStatus={liveConnected ? "online" : "offline"}
            />

            <Panel title="Controle Operacional" subtitle="Sem novas funcionalidades, apenas comandos existentes">
              <div className="action-row">
                <label className="provider-select">
                  Fonte de dados
                  <select
                    value={providerName}
                    onChange={(event) =>
                      handleProviderChange(event.target.value as LiveDataProviderName)
                    }
                  >
                    {availableProviders.map((name) => (
                      <option key={name} value={name}>
                        {providerLabel(name)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleConnectLiveData}
                  disabled={liveConnected}
                >
                  Conectar
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleDisconnectLiveData}
                  disabled={!liveConnected}
                >
                  Desconectar
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !liveEvents.length}
                >
                  {isAnalyzing ? "Analisando..." : "Analisar"}
                </button>
                {isAnalyzing ? <span className="spinner" aria-label="Analisando" /> : null}

                {providerName === "manual" ? (
                  <button
                    className="analyze-button"
                    type="button"
                    onClick={pushManualEvent}
                    disabled={!liveConnected}
                  >
                    Inserir evento manual
                  </button>
                ) : null}

                {providerName === "simulator" ? (
                  <>
                    <label className="provider-select">
                      Velocidade
                      <select
                        value={simulatorSpeed}
                        onChange={(event) =>
                          handleSimulatorSpeedChange(event.target.value as SimulatorSpeed)
                        }
                      >
                        <option value="lento">lento</option>
                        <option value="normal">normal</option>
                        <option value="rapido">rapido</option>
                      </select>
                    </label>
                    <button className="analyze-button" type="button" onClick={handleSimulatorStart}>
                      Iniciar simulacao
                    </button>
                    <button className="analyze-button" type="button" onClick={handleSimulatorPause}>
                      Pausar simulacao
                    </button>
                    <button className="analyze-button" type="button" onClick={handleSimulatorReset}>
                      Resetar simulacao
                    </button>
                  </>
                ) : null}
              </div>

              <div className="provider-manager-panel">
                <div className="status-line">
                  <p className="status-label">Provider ativo (manager)</p>
                  <p className="status-label">{managedProviderLabel(providerSnapshot.activeProvider)}</p>
                </div>
                <div className="status-line">
                  <p className="status-label">Estado</p>
                  <p className="status-label">{providerStateLabel(activeManagedStatus.state)}</p>
                </div>
                <div className="status-line">
                  <p className="status-label">Disponibilidade</p>
                  <p className="status-label">
                    {providerAvailabilityLabel(activeManagedStatus.availability)}
                  </p>
                </div>

                <div className="action-row">
                  <label className="provider-select">
                    Fonte (manager)
                    <select
                      value={providerSnapshot.activeProvider}
                      onChange={(event) =>
                        handleManagerProviderChange(event.target.value as ManagedProviderId)
                      }
                    >
                      {managedProviders.map((provider) => (
                        <option key={provider} value={provider}>
                          {managedProviderLabel(provider)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="analyze-button" type="button" onClick={handleManagerConnect}>
                    Connect
                  </button>
                  <button className="analyze-button" type="button" onClick={handleManagerDisconnect}>
                    Disconnect
                  </button>
                  <button className="analyze-button" type="button" onClick={handleManagerStart}>
                    Start
                  </button>
                  <button className="analyze-button" type="button" onClick={handleManagerPause}>
                    Pause
                  </button>
                  <button className="analyze-button" type="button" onClick={handleManagerReset}>
                    Reset
                  </button>
                </div>

                <div className="provider-availability-grid">
                  {managedProviders.map((provider) => {
                    const itemStatus = providerSnapshot.providers[provider];
                    return (
                      <article className="provider-availability-card" key={provider}>
                        <strong>{managedProviderLabel(provider)}</strong>
                        <span>{providerStateLabel(itemStatus.state)}</span>
                        <span>{providerAvailabilityLabel(itemStatus.availability)}</span>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="status-line">
                <p className="status-label">Ultima analise</p>
                <p className="status-label">
                  {lastAnalyzedAt ? formatClock(lastAnalyzedAt) : "Aguardando analise"}
                </p>
              </div>

              <div className="action-row">
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleCheckHealth}
                  disabled={isCheckingHealth}
                >
                  {isCheckingHealth ? "Consultando..." : "Atualizar health"}
                </button>
                <StatusBadge status={headerStatus} />
              </div>

              {health ? <JsonViewer data={health} /> : <p className="empty-state">Sem status consultado.</p>}
              {healthError ? <p className="error-text">{healthError}</p> : null}
            </Panel>
          </div>
        </section>

        <section className="lower-tabs-panel">
          <div className="lower-tabs-header" role="tablist" aria-label="Painel inferior">
            {[
              { id: "estatisticas", label: "Estatisticas" },
              { id: "padroes", label: "Padroes" },
              { id: "performance", label: "Performance" },
              { id: "replay", label: "Replay" },
              { id: "simulacao", label: "Simulacao" },
              { id: "logs", label: "Logs" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeBottomTab === tab.id}
                className={`lower-tab-button ${activeBottomTab === tab.id ? "lower-tab-button-active" : ""}`}
                onClick={() =>
                  setActiveBottomTab(
                    tab.id as
                      | "estatisticas"
                      | "padroes"
                      | "performance"
                      | "replay"
                      | "simulacao"
                      | "logs"
                  )
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="lower-tab-content" role="tabpanel">
            {activeBottomTab === "replay" ? (
              <ReplayTimeline events={replayHistory} />
            ) : (
              <article className="placeholder-card">
                <h4>{activeBottomTab.toUpperCase()}</h4>
                <p>
                  Painel visual premium em evolucao. Esta aba mantem layout comercial enquanto o stream continua
                  alimentando o dashboard em tempo real.
                </p>
                <div className="placeholder-metrics">
                  <span>Eventos: {liveEvents.length}</span>
                  <span>Accuracy: {headerAccuracy}</span>
                  <span>Confidence: {headerConfidence}</span>
                  <span>Learning: {learning.learning_score}</span>
                  <span>Status: {liveConnected ? "online" : "offline"}</span>
                  <span>Decisao: {tradingDecision}</span>
                </div>
              </article>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
