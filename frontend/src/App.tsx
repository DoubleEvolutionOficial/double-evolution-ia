import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeLaboratory } from "./api/laboratory";
import { fetchHealth } from "./api/health";
import { JsonViewer } from "./components/JsonViewer";
import { Panel } from "./components/Panel";
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
import { PersistentStorageInfo } from "./services/storage/types";
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
import "./App.css";

type RequestState = "idle" | "loading" | "success" | "error" | "offline";

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

function providerStatusLabel(status: LiveDataProviderStatus): string {
  if (status.state === "not_configured") {
    return "WebSocket não configurado";
  }
  if (status.state === "reconnecting") {
    return "reconnecting";
  }
  if (status.state === "online") {
    return "online";
  }
  return "offline";
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

function protectedExplanation(decision: "Aguardar" | "Observar" | "Entrar"): string {
  if (decision === "Entrar") {
    return "Sinais agregados estao favoraveis. Acompanhe com gestao de risco e confirme o contexto ao vivo.";
  }

  if (decision === "Observar") {
    return "Cenario em transicao. Aguarde mais confirmacoes antes de qualquer acao operacional.";
  }

  return "Momento defensivo. O sistema recomenda paciencia ate aparecer uma janela mais consistente.";
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
  const [activeBottomTab, setActiveBottomTab] = useState<
    "estatisticas" | "padroes" | "performance" | "replay" | "simulacao" | "logs"
  >("estatisticas");

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
  const protectedDecisionText = protectedExplanation(tradingDecision);
  const headerStatus =
    healthState === "success" ? health?.status ?? "online" : requestStateLabel(healthState);

  const aiCards = [
    { label: "Decisao", value: tradingDecision },
    { label: "Confidence", value: headerConfidence },
    { label: "Risk", value: `${performanceAnalytics.average_risk.toFixed(1)}%` },
    { label: "Trend", value: pickMetric(analysis?.trend, ["direction", "trend", "status"]) },
    {
      label: "Probability",
      value: pickMetric(analysis?.probability, ["probability", "chance", "score"]),
    },
    { label: "Consensus", value: pickMetric(analysis?.consensus, ["decision", "status", "signal"]) },
    {
      label: "Correlation",
      value: pickMetric(analysis?.correlation, ["correlation", "strength", "pair"]),
    },
    { label: "Learning", value: String(learning.learning_score) },
  ];

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
            <Panel title="Painel da IA" subtitle="Cards de decisao e inteligencia em tempo real">
              <div className="ia-cards-grid">
                {aiCards.map((card) => (
                  <article className="ia-card" key={card.label}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>

              <div className="status-line">
                <p className="status-label">Estado da analise</p>
                <StatusBadge status={requestStateLabel(analysisState)} />
              </div>
              <div className="status-line">
                <p className="status-label">Estado do stream</p>
                <StatusBadge status={liveConnected ? "online" : "offline"} />
              </div>
              <div className="status-line">
                <p className="status-label">Status da conexao</p>
                <StatusBadge status={providerStatusLabel(providerStatus)} />
              </div>
              <div className="status-line">
                <p className="status-label">Log de conexao</p>
                <p className="status-label">{providerStatus.message}</p>
              </div>
              <div className="status-line">
                <p className="status-label">Ultima mensagem recebida</p>
                <p className="status-label">
                  {providerStatus.lastMessageAt
                    ? `${formatClock(new Date(providerStatus.lastMessageAt))} - ${providerStatus.lastMessage ?? "mensagem recebida"}`
                    : "Sem mensagens"}
                </p>
              </div>
              <div className="protected-explanation">
                <p className="protected-explanation-title">Explicacao protegida</p>
                <p>{protectedDecisionText}</p>
              </div>

              {analysisError ? <p className="error-text">{analysisError}</p> : null}
            </Panel>

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
            <article className="placeholder-card">
              <h4>{activeBottomTab.toUpperCase()}</h4>
              <p>
                Painel visual em evolucao para o Sprint UI-01. Estrutura pronta para integrar conteudo comercial,
                mantendo o stream e os controles de operacao ativos no topo.
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
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
