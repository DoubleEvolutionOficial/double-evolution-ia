import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { JsonViewer } from "./components/JsonViewer";

type RequestState = "idle" | "loading" | "success" | "error" | "offline";
type LabSpeed = 1 | 2 | 5 | 10 | 20;
type ImportFormat = "csv" | "json";
type ManualEntryColor = "red" | "black" | "white";
type ManualEntryResult = "WIN" | "LOSS" | "GALE 1" | "GALE 2";
type MainView =
  | "painel"
  | "ao-vivo"
  | "ia"
  | "estrategias"
  | "simulacao"
  | "backtest"
  | "historico"
  | "estatisticas"
  | "configuracoes";

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
  const [activeMainView, setActiveMainView] = useState<MainView>("painel");
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
  const learningEngineRef = useRef(new LearningEngine());
  const patternDiscoveryEngineRef = useRef(new PatternDiscoveryEngine());
  const patternRankingEngineRef = useRef(new PatternRankingEngine());
  const performanceAnalyticsEngineRef = useRef(new PerformanceAnalytics());
  const strategyEngineRef = useRef(new StrategyEngine());
  const replaySeenKeysRef = useRef<Set<string>>(new Set());
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

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

      if (providerName === "external") {
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
        lastAnalysisSignatureRef.current = signature;
        if (patternRanking.ranked_patterns.length || patternDiscovery.patterns.length) {
          runStrategySelection(strategyMode, manualStrategy);
        }
      } catch (err) {
        const mapped = mapErrorToState(err);
        setAnalysisState(mapped.state);
        setAnalysisError(mapped.message);
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

    const storedImportedHistory = storageService.loadImportedHistoryEvents();
    if (storedImportedHistory.length) {
      setImportedHistory(storedImportedHistory);
      setLastImportTotal(storedImportedHistory.length);
      setImportMessage(`Historico importado carregado (${storedImportedHistory.length} eventos).`);
    }

    const storedBacktestRecords = storageService.loadBacktestRecords();
    if (storedBacktestRecords.length) {
      setBacktestRecords(storedBacktestRecords);
    }

    const storedManualSimulation = storageService.loadManualSimulationState();
    if (storedManualSimulation) {
      setManualBankrollStart(storedManualSimulation.bankrollStart);
      setManualBankrollCurrent(storedManualSimulation.bankrollCurrent);
      setManualSimulationRecords(storedManualSimulation.records);
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
  }, []);

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

  function handleOpenImportPicker() {
    importFileInputRef.current?.click();
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError(null);
    setImportMessage(`Importando ${file.name}...`);

    try {
      const content = await file.text();
      const rows: Record<string, unknown>[] =
        importFormat === "json" ? (JSON.parse(content) as Record<string, unknown>[]) : parseCsvRows(content);

      if (!Array.isArray(rows) || !rows.length) {
        setImportError("Arquivo sem registros validos para importacao.");
        setImportMessage(null);
        return;
      }

      const events: LiveDataEvent[] = [];
      const errors: string[] = [];

      rows.forEach((raw, index) => {
        const normalized = normalizeImportedEvent(raw, events);
        if (normalized.event) {
          events.push(normalized.event);
          return;
        }
        if (normalized.error) {
          errors.push(`Linha ${index + 2}: ${normalized.error}`);
        }
      });

      if (!events.length) {
        setImportError(errors[0] ?? "Nao foi possivel importar eventos validos.");
        setImportMessage(null);
        return;
      }

      setImportedHistory(events);
      setLastImportTotal(events.length);
      setReplayCursor(0);
      setReplayPlaying(false);
      storageService.saveImportedHistoryEvents(events);
      refreshStorageInfo();
      setImportMessage(
        `${events.length} evento(s) importado(s) com sucesso${errors.length ? ` (${errors.length} ignorado(s))` : ""}.`
      );
      if (errors.length) {
        setImportError(errors[0]);
      }
    } catch {
      setImportMessage(null);
      setImportError("Falha ao ler arquivo. Verifique o formato selecionado (CSV/JSON).");
    } finally {
      event.target.value = "";
    }
  }

  function clearImportedHistory() {
    setImportedHistory([]);
    setLastImportTotal(0);
    setReplayCursor(0);
    setReplayPlaying(false);
    storageService.clearImportedHistoryEvents();
    refreshStorageInfo();
    setImportMessage("Historico importado removido.");
    setImportError(null);
  }

  function toSignalColor(signal: "Vermelho" | "Preto" | "Branco"): "red" | "black" | "white" {
    if (signal === "Vermelho") {
      return "red";
    }
    if (signal === "Preto") {
      return "black";
    }
    return "white";
  }

  function runBacktest() {
    const sourceEvents = importedHistory.length
      ? importedHistory
      : replayHistory.length
        ? replayHistory
        : liveEvents;

    if (sourceEvents.length < BACKTEST_MIN_WINDOW + 1) {
      setBacktestMessage(`Backtest requer ao menos ${BACKTEST_MIN_WINDOW + 1} eventos validos.`);
      setBacktestRecords([]);
      return;
    }

    setIsBacktesting(true);

    const records: BacktestRecord[] = [];
    for (let index = BACKTEST_MIN_WINDOW; index < sourceEvents.length; index += 1) {
      const windowEvents = sourceEvents.slice(index - BACKTEST_MIN_WINDOW, index);
      const current = sourceEvents[index];
      const signal = suggestColor(windowEvents);
      const signalColor = toSignalColor(signal);
      const matches = windowEvents.filter((event) => event.color === signalColor).length;
      const confidence = clampPercent(Math.round((matches / windowEvents.length) * 100));
      const risk = clampPercent(100 - confidence + (current.white ? 6 : 0));
      const outcome = current.color === signalColor ? "win" : "loss";

      records.push({
        timestamp: current.timestamp,
        signal,
        confidence,
        risk,
        result: outcome === "win" ? "Acerto" : `Erro (${eventColorLabel(current.color)})`,
        outcome,
        pattern: `streak-${computeLongestColorStreak(windowEvents)}`,
      });
    }

    setBacktestRecords(records);
    storageService.saveBacktestRecords(records);
    refreshStorageInfo();
    setBacktestMessage(`Backtest concluido: ${records.length} entrada(s).`);
    setIsBacktesting(false);
  }

  function clearBacktest() {
    setBacktestRecords([]);
    setBacktestMessage("Backtest limpo.");
    storageService.clearBacktestRecords();
    refreshStorageInfo();
  }

  function registerManualSimulationEntry() {
    const delta = manualDeltaByResult(manualEntryResult);
    const updatedBankroll = Number((manualBankrollCurrent + delta).toFixed(2));

    const nextRecord: ManualSimulationRecord = {
      timestamp: new Date().toISOString(),
      entry: manualEntryColor,
      result: manualEntryResult,
      amountDelta: delta,
      bankrollAfter: updatedBankroll,
    };

    const nextRecords = [nextRecord, ...manualSimulationRecords].slice(0, 120);
    setManualBankrollCurrent(updatedBankroll);
    setManualSimulationRecords(nextRecords);
    storageService.saveManualSimulationState({
      bankrollStart: manualBankrollStart,
      bankrollCurrent: updatedBankroll,
      records: nextRecords,
    });
    refreshStorageInfo();
  }

  function resetManualSimulation() {
    setManualBankrollCurrent(manualBankrollStart);
    setManualSimulationRecords([]);
    storageService.clearManualSimulationState();
    refreshStorageInfo();
  }

  function handleSimulationStart() {
    if (providerName !== "simulator") {
      handleProviderChange("simulator");
    }
    handleSimulatorStart();
  }

  function handleSimulationPause() {
    handleSimulatorPause();
  }

  function handleSimulationReset() {
    handleSimulatorReset();
  }

  const navItems: Array<{ id: MainView; label: string }> = [
    { id: "painel", label: "Painel" },
    { id: "ao-vivo", label: "Ao vivo" },
    { id: "ia", label: "IA" },
    { id: "estrategias", label: "Estratégias" },
    { id: "simulacao", label: "Simulação" },
    { id: "backtest", label: "Backtest" },
    { id: "historico", label: "Histórico" },
    { id: "estatisticas", label: "Estatísticas" },
    { id: "configuracoes", label: "Configurações" },
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
  const managerNeedsConfiguration = activeManagedStatus.availability !== "available";
  const liveProviderNeedsConfiguration = providerStatus.state === "not_configured";
  const managerStatusMessage = managerNeedsConfiguration
    ? `${managedProviderLabel(providerSnapshot.activeProvider)} ainda nao esta totalmente configurado.`
    : activeManagedStatus.message;
  const liveStatusMessage = liveProviderNeedsConfiguration
    ? `${providerLabel(providerName)} requer configuracao para operar.`
    : providerStatus.message;

  const historyEvents = useMemo(() => {
    if (liveEvents.length) {
      return liveEvents;
    }
    if (replayHistory.length) {
      return replayHistory;
    }
    return importedHistory;
  }, [importedHistory, liveEvents, replayHistory]);

  const statisticsFromEvents = useMemo(() => {
    const total = historyEvents.length;
    const red = historyEvents.filter((event) => event.color === "red").length;
    const black = historyEvents.filter((event) => event.color === "black").length;
    const white = historyEvents.filter((event) => event.color === "white").length;

    const toRatio = (value: number) => (total ? Number(((value / total) * 100).toFixed(1)) : 0);
    return {
      total,
      red,
      black,
      white,
      redPct: toRatio(red),
      blackPct: toRatio(black),
      whitePct: toRatio(white),
    };
  }, [historyEvents]);
  const mainContent = (() => {
    if (activeMainView === "painel") {
      return (
        <section className="center-zone">
          <Panel title="Painel das Pedras" subtitle="Grid profissional com atualizacao automatica por evento">
            <StonesGrid events={liveEvents} />
          </Panel>

          <div className="ia-column">
            <IntelligenceDecisionCenter
              status={centerStatus}
              suggestedColor={suggestedColor}
              confidence={confidencePercent}
              riskLabel={riskLabel}
              engineIndicators={engineIndicators}
              justifications={decisionJustifications}
              streamStatus={liveConnected ? "online" : "offline"}
            />

            <Panel title="Resumo operacional" subtitle="Status, provider, eventos, confianca e decisao atual">
              <div className="provider-availability-grid">
                <article className="provider-availability-card">
                  <strong>Status</strong>
                  <span>{headerStatus}</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Provider</strong>
                  <span>{providerLabel(providerName)}</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Eventos</strong>
                  <span>{liveEvents.length}</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Confianca</strong>
                  <span>{confidencePercent.toFixed(1)}%</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Learning</strong>
                  <span>{learning.learning_score.toFixed(1)}</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Decisao</strong>
                  <span>{tradingDecision}</span>
                </article>
              </div>

              <div className="action-row">
                <button
                  className="analyze-button"
                  type="button"
                  onClick={() => setShowHealthDetails((previous) => !previous)}
                >
                  {showHealthDetails ? "Ocultar health" : "Exibir health"}
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleCheckHealth}
                  disabled={isCheckingHealth}
                >
                  {isCheckingHealth ? "Consultando..." : "Atualizar health"}
                </button>
              </div>

              {showHealthDetails ? (
                health ? <JsonViewer data={health} /> : <p className="empty-state">Sem status consultado.</p>
              ) : null}
              {healthError ? <p className="error-text">{healthError}</p> : null}
            </Panel>
          </div>
        </section>
      );
    }

    if (activeMainView === "ao-vivo") {
      return (
        <section className="center-zone">
          <Panel title="Ao vivo" subtitle="Conexao de providers e comandos operacionais existentes">
            <div className="action-row">
              <label className="provider-select">
                Fonte live
                <select
                  value={providerName}
                  onChange={(event) => handleProviderChange(event.target.value as LiveDataProviderName)}
                >
                  {availableProviders.map((name) => (
                    <option key={name} value={name}>
                      {providerLabel(name)}
                    </option>
                  ))}
                </select>
              </label>

              <button className="analyze-button" type="button" onClick={handleConnectLiveData} disabled={liveConnected}>
                Conectar
              </button>
              <button className="analyze-button" type="button" onClick={handleDisconnectLiveData} disabled={!liveConnected}>
                Desconectar
              </button>
              <button className="analyze-button" type="button" onClick={handleAnalyze} disabled={isAnalyzing || !liveEvents.length}>
                {isAnalyzing ? "Analisando..." : "Analisar"}
              </button>
            </div>

            <div className="status-line">
              <p className="status-label">Status live</p>
              <p className="status-label">{providerStatus.state}</p>
            </div>
            <p className="empty-state">{liveStatusMessage}</p>
          </Panel>

          <div className="ia-column">
            <Panel title="Provider Manager" subtitle="Simulator, Replay, CSV e WebSocket">
              <div className="action-row">
                <label className="provider-select">
                  Provider manager
                  <select
                    value={providerSnapshot.activeProvider}
                    onChange={(event) => handleManagerProviderChange(event.target.value as ManagedProviderId)}
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

              <div className="status-line">
                <p className="status-label">Estado</p>
                <p className="status-label">{providerStateLabel(activeManagedStatus.state)}</p>
              </div>
              <p className="empty-state">{managerStatusMessage}</p>

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
            </Panel>
          </div>
        </section>
      );
    }

    if (activeMainView === "ia") {
      return (
        <section className="center-zone">
          <IntelligenceDecisionCenter
            status={centerStatus}
            suggestedColor={suggestedColor}
            confidence={confidencePercent}
            riskLabel={riskLabel}
            engineIndicators={engineIndicators}
            justifications={decisionJustifications}
            streamStatus={liveConnected ? "online" : "offline"}
          />

          <div className="ia-column">
            <Panel title="Atualizacao IA" subtitle="Dados operacionais disponiveis no momento">
              <div className="provider-availability-grid">
                <article className="provider-availability-card">
                  <strong>Trend</strong>
                  <span>{trendValue.toFixed(1)}%</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Probability</strong>
                  <span>{probabilityValue.toFixed(1)}%</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Consensus</strong>
                  <span>{consensusValue.toFixed(1)}%</span>
                </article>
                <article className="provider-availability-card">
                  <strong>Learning</strong>
                  <span>{learningValue.toFixed(1)}%</span>
                </article>
              </div>
              <div className="action-row">
                <button className="analyze-button" type="button" onClick={handleAnalyze} disabled={isAnalyzing || !liveEvents.length}>
                  {isAnalyzing ? "Analisando..." : "Atualizar IA"}
                </button>
              </div>
              {analysisError ? <p className="error-text">{analysisError}</p> : null}
            </Panel>
          </div>
        </section>
      );
    }

    if (activeMainView === "estrategias") {
      return (
        <section className="center-zone">
          <Panel title="Estrategias" subtitle="Selecao de estrategia e descoberta de padroes">
            <div className="action-row">
              <button className="analyze-button" type="button" onClick={handleAutoStrategy}>
                Modo automatico
              </button>
              <button className="analyze-button" type="button" onClick={handleManualStrategy}>
                Modo manual
              </button>
              <label className="provider-select">
                Estrategia manual
                <select
                  value={manualStrategy}
                  onChange={(event) => setManualStrategy(event.target.value as typeof manualStrategy)}
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Aggressive">Aggressive</option>
                  <option value="Adaptive">Adaptive</option>
                  <option value="Experimental">Experimental</option>
                </select>
              </label>
              <button className="analyze-button" type="button" onClick={handleScanHistory} disabled={isScanningPatterns}>
                {isScanningPatterns ? "Escaneando..." : "Escanear historico"}
              </button>
            </div>

            <div className="provider-availability-grid">
              <article className="provider-availability-card">
                <strong>Modo</strong>
                <span>{strategyMode}</span>
              </article>
              <article className="provider-availability-card">
                <strong>Melhor estrategia</strong>
                <span>{strategyResult.best_strategy}</span>
              </article>
              <article className="provider-availability-card">
                <strong>Confianca</strong>
                <span>{strategyResult.confidence.toFixed(1)}%</span>
              </article>
              <article className="provider-availability-card">
                <strong>Win rate esperado</strong>
                <span>{strategyResult.expected_win_rate.toFixed(1)}%</span>
              </article>
            </div>

            {scanMessage ? <p className="empty-state">{scanMessage}</p> : null}
          </Panel>

          <div className="ia-column">
            <Panel title="Simulacao manual" subtitle="Somente simulacao local, sem apostas reais">
              <div className="action-row">
                <label className="provider-select">
                  Entrada
                  <select
                    value={manualEntryColor}
                    onChange={(event) => setManualEntryColor(event.target.value as ManualEntryColor)}
                  >
                    <option value="red">Vermelho</option>
                    <option value="black">Preto</option>
                    <option value="white">Branco</option>
                  </select>
                </label>
                <label className="provider-select">
                  Resultado
                  <select
                    value={manualEntryResult}
                    onChange={(event) => setManualEntryResult(event.target.value as ManualEntryResult)}
                  >
                    <option value="WIN">WIN</option>
                    <option value="LOSS">LOSS</option>
                    <option value="GALE 1">GALE 1</option>
                    <option value="GALE 2">GALE 2</option>
                  </select>
                </label>
                <button className="analyze-button" type="button" onClick={registerManualSimulationEntry}>
                  Registrar
                </button>
                <button className="analyze-button" type="button" onClick={resetManualSimulation}>
                  Resetar
                </button>
              </div>

              <div className="status-line">
                <p className="status-label">Banca inicial</p>
                <p className="status-label">{manualBankrollStart.toFixed(2)}</p>
              </div>
              <div className="status-line">
                <p className="status-label">Banca atual</p>
                <p className="status-label">{manualBankrollCurrent.toFixed(2)}</p>
              </div>

              {manualSimulationRecords.length ? (
                <div className="provider-availability-grid">
                  {manualSimulationRecords.slice(0, 6).map((record) => (
                    <article className="provider-availability-card" key={`${record.timestamp}-${record.result}`}>
                      <strong>{record.result}</strong>
                      <span>{eventColorLabel(record.entry)}</span>
                      <span>{record.bankrollAfter.toFixed(2)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Sem registros de simulacao manual.</p>
              )}
            </Panel>
          </div>
        </section>
      );
    }

    if (activeMainView === "simulacao") {
      return (
        <section className="center-zone">
          <Panel title="Simulacao" subtitle="Controle do SimulatorProvider sem apostas reais">
            <div className="action-row">
              <button className="analyze-button" type="button" onClick={handleSimulationStart}>
                Iniciar
              </button>
              <button className="analyze-button" type="button" onClick={handleSimulationPause}>
                Pausar
              </button>
              <button className="analyze-button" type="button" onClick={handleSimulationReset}>
                Resetar
              </button>
              <label className="provider-select">
                Velocidade
                <select
                  value={simulatorSpeed}
                  onChange={(event) => handleSimulatorSpeedChange(event.target.value as SimulatorSpeed)}
                >
                  <option value="lento">lento</option>
                  <option value="normal">normal</option>
                  <option value="rapido">rapido</option>
                </select>
              </label>
            </div>

            <div className="status-line">
              <p className="status-label">Provider atual</p>
              <p className="status-label">{providerLabel(providerName)}</p>
            </div>
            <div className="status-line">
              <p className="status-label">Status</p>
              <p className="status-label">{providerStatus.state}</p>
            </div>
            <p className="empty-state">Simulacao local apenas para testes internos, sem automacao de apostas.</p>
          </Panel>

          <div className="ia-column">
            <Panel title="Pedras da simulacao" subtitle="Eventos do simulator refletidos automaticamente no grid">
              <StonesGrid events={liveEvents} />
            </Panel>
          </div>
        </section>
      );
    }

    if (activeMainView === "backtest") {
      return (
        <section className="center-zone">
          <Panel title="Backtest" subtitle="Importacao CSV/JSON, replay e execucao do backtest">
            <input
              ref={importFileInputRef}
              type="file"
              accept={importFormat === "csv" ? ".csv,text/csv" : ".json,application/json"}
              onChange={handleImportFileChange}
              style={{ display: "none" }}
            />

            <div className="action-row">
              <label className="provider-select">
                Formato
                <select
                  value={importFormat}
                  onChange={(event) => setImportFormat(event.target.value as ImportFormat)}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <button className="analyze-button" type="button" onClick={handleOpenImportPicker}>
                Escolher arquivo
              </button>
              <button className="analyze-button" type="button" onClick={runBacktest} disabled={isBacktesting}>
                {isBacktesting ? "Executando..." : "Executar backtest"}
              </button>
              <button className="analyze-button" type="button" onClick={clearBacktest}>
                Limpar backtest
              </button>
              <button className="analyze-button" type="button" onClick={clearImportedHistory}>
                Limpar importado
              </button>
            </div>

            {importMessage ? <p className="empty-state">{importMessage}</p> : null}
            {importError ? <p className="error-text">{importError}</p> : null}
            {backtestMessage ? <p className="empty-state">{backtestMessage}</p> : null}

            <div className="provider-availability-grid">
              <article className="provider-availability-card">
                <strong>Eventos importados</strong>
                <span>{lastImportTotal}</span>
              </article>
              <article className="provider-availability-card">
                <strong>Registros backtest</strong>
                <span>{backtestRecords.length}</span>
              </article>
            </div>
          </Panel>

          <div className="ia-column">
            {importedHistory.length ? (
              <ReplayTimeline events={importedHistory} />
            ) : (
              <Panel title="Replay" subtitle="Aguardando importacao de arquivo para replay">
                <p className="empty-state">Nenhum arquivo importado ainda.</p>
              </Panel>
            )}
          </div>
        </section>
      );
    }

    if (activeMainView === "historico") {
      return (
        <section className="center-zone">
          <Panel title="Historico" subtitle="Eventos vindos do LiveDataService ou do StorageService">
            <StonesGrid events={historyEvents} />
          </Panel>

          <div className="ia-column">
            <ReplayTimeline events={historyEvents} />
          </div>
        </section>
      );
    }

    if (activeMainView === "estatisticas") {
      return (
        <section className="center-zone">
          <Panel title="Estatisticas" subtitle="Calculo em tempo real a partir dos eventos disponiveis">
            <div className="provider-availability-grid">
              <article className="provider-availability-card">
                <strong>Total</strong>
                <span>{statisticsFromEvents.total}</span>
              </article>
              <article className="provider-availability-card">
                <strong>Vermelho</strong>
                <span>{statisticsFromEvents.red} ({statisticsFromEvents.redPct}%)</span>
              </article>
              <article className="provider-availability-card">
                <strong>Preto</strong>
                <span>{statisticsFromEvents.black} ({statisticsFromEvents.blackPct}%)</span>
              </article>
              <article className="provider-availability-card">
                <strong>Branco</strong>
                <span>{statisticsFromEvents.white} ({statisticsFromEvents.whitePct}%)</span>
              </article>
            </div>
          </Panel>
        </section>
      );
    }

    return (
      <section className="center-zone">
        <Panel title="Configuracoes" subtitle="Controles existentes de persistencia e ambiente">
          <div className="status-line">
            <p className="status-label">Storage status</p>
            <p className="status-label">{storageInfo.status}</p>
          </div>
          <div className="status-line">
            <p className="status-label">Ultimo save</p>
            <p className="status-label">{storageInfo.last_save ?? "-"}</p>
          </div>
          <div className="status-line">
            <p className="status-label">Total de registros</p>
            <p className="status-label">{storageInfo.total_records}</p>
          </div>

          <div className="action-row">
            <button className="analyze-button" type="button" onClick={saveLearningNow}>
              Salvar memoria
            </button>
            <button className="analyze-button" type="button" onClick={refreshStorageInfo}>
              Atualizar storage
            </button>
            <button className="analyze-button" type="button" onClick={clearLearningMemory}>
              Limpar memoria
            </button>
          </div>

          {storageMessage ? <p className="empty-state">{storageMessage}</p> : null}
          <p className="empty-state">Em desenvolvimento: configuracoes avancadas de integracao externa.</p>
        </Panel>
      </section>
    );
  })();

  return (
    <main className="pro-dashboard">
      <aside className="sidebar">
        <div className="brand-mini">DE</div>
        <div className="sidebar-title">Double Evolution IA</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeMainView === item.id ? "nav-item-active" : ""}`}
              onClick={() => setActiveMainView(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.label.slice(0, 2).toUpperCase()}
              </span>
              <span>{item.label}</span>
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

        {mainContent}
      </section>
    </main>
  );
}

export default App;
