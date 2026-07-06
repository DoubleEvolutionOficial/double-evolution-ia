import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeLaboratory } from "./api/laboratory";
import { fetchHealth } from "./api/health";
import { JsonViewer } from "./components/JsonViewer";
import { Panel } from "./components/Panel";
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

function buildSparkline(points: Array<{ value: number }>, width = 320, height = 84): string {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    const y = height - (Math.max(0, Math.min(100, points[0].value)) / 100) * height;
    return `0,${y.toFixed(2)} ${width},${y.toFixed(2)}`;
  }

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (Math.max(0, Math.min(100, point.value)) / 100) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const [filterElite, setFilterElite] = useState(false);
  const [filterHighConfidence, setFilterHighConfidence] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [filterRecent, setFilterRecent] = useState(false);
  const [sortBy, setSortBy] = useState<
    "score" | "confidence" | "accuracy" | "occurrences" | "recent"
  >("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
    liveDataService.connect();
    setLiveConnected(liveDataService.isConnected());
  }

  function handleDisconnectLiveData() {
    liveDataService.disconnect();
    setLiveConnected(liveDataService.isConnected());
  }

  function handleProviderChange(name: LiveDataProviderName) {
    liveDataService.setProvider(name);
    setProviderName(liveDataService.getProviderName());
    setLiveConnected(liveDataService.isConnected());
    if (name === "simulator") {
      liveDataService.setSimulatorSpeed?.(simulatorSpeed);
      liveDataService.startSimulator?.();
    }
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
    if (!liveConnected) {
      liveDataService.connect();
    }
    setLiveConnected(liveDataService.isConnected());
  }

  function handleSimulatorPause() {
    liveDataService.pauseSimulator?.();
    setLiveConnected(liveDataService.isConnected());
  }

  function handleSimulatorReset() {
    liveDataService.resetSimulator?.();
    setLiveEvents(liveDataService.getLatestEvents());
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

  const rankedPatterns = useMemo(() => {
    const now = Date.now();
    const recentThresholdMs = 5 * 60 * 1000;

    const filtered = patternRanking.ranked_patterns.filter((pattern) => {
      if (filterElite && pattern.rank !== "Elite") {
        return false;
      }
      if (filterHighConfidence && pattern.confidence < 80) {
        return false;
      }
      if (filterActive && pattern.status !== "active") {
        return false;
      }
      if (filterRecent) {
        if (!pattern.last_seen) {
          return false;
        }
        const ts = Date.parse(pattern.last_seen);
        if (Number.isNaN(ts) || now - ts > recentThresholdMs) {
          return false;
        }
      }
      return true;
    });

    const multiplier = sortDirection === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortBy === "confidence") {
        return (a.confidence - b.confidence) * multiplier;
      }
      if (sortBy === "accuracy") {
        return (a.accuracy - b.accuracy) * multiplier;
      }
      if (sortBy === "occurrences") {
        return (a.occurrences - b.occurrences) * multiplier;
      }
      if (sortBy === "recent") {
        const aTs = a.last_seen ? Date.parse(a.last_seen) : 0;
        const bTs = b.last_seen ? Date.parse(b.last_seen) : 0;
        return (aTs - bTs) * multiplier;
      }
      return (a.global_score - b.global_score) * multiplier;
    });

    return filtered;
  }, [
    filterActive,
    filterElite,
    filterHighConfidence,
    filterRecent,
    patternRanking.ranked_patterns,
    sortBy,
    sortDirection,
  ]);

  const rankingTop10 = useMemo(() => {
    return [...patternRanking.ranked_patterns]
      .sort((a, b) => b.global_score - a.global_score)
      .slice(0, 10);
  }, [patternRanking.ranked_patterns]);

  const topConfidence = useMemo(
    () => Math.max(0, ...patternRanking.ranked_patterns.map((pattern) => pattern.confidence)),
    [patternRanking.ranked_patterns]
  );

  const topAccuracy = useMemo(
    () => Math.max(0, ...patternRanking.ranked_patterns.map((pattern) => pattern.accuracy)),
    [patternRanking.ranked_patterns]
  );

  const topStable = useMemo(
    () => Math.max(0, ...patternRanking.ranked_patterns.map((pattern) => pattern.stability_score)),
    [patternRanking.ranked_patterns]
  );

  const topRecent = useMemo(() => {
    const latest = [...patternRanking.ranked_patterns]
      .filter((pattern) => !!pattern.last_seen)
      .sort(
        (a, b) =>
          Date.parse(b.last_seen ?? "1970-01-01T00:00:00.000Z") -
          Date.parse(a.last_seen ?? "1970-01-01T00:00:00.000Z")
      )[0];

    return latest?.last_seen ? formatClock(new Date(latest.last_seen)) : "-";
  }, [patternRanking.ranked_patterns]);

  const accuracySparkline = useMemo(
    () => buildSparkline(performanceAnalytics.accuracy_timeline),
    [performanceAnalytics.accuracy_timeline]
  );

  const learningSparkline = useMemo(
    () => buildSparkline(performanceAnalytics.learning_curve),
    [performanceAnalytics.learning_curve]
  );

  const winLossTotal =
    performanceAnalytics.win_loss_chart.wins + performanceAnalytics.win_loss_chart.losses;
  const winPercent = winLossTotal
    ? (performanceAnalytics.win_loss_chart.wins / winLossTotal) * 100
    : 0;
  const lossPercent = winLossTotal
    ? (performanceAnalytics.win_loss_chart.losses / winLossTotal) * 100
    : 0;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Double Evolution IA Laboratory</h1>
          <p className="dashboard-subtitle">
            Dashboard operacional para inspeção completa do DecisionPipeline
          </p>
        </div>
        <StatusBadge
          status={healthState === "success" ? health?.status ?? "online" : requestStateLabel(healthState)}
        />
      </header>

      <section className="actions">
        <Panel
          title="Area de Historico"
          subtitle="Fluxo em tempo real via LiveDataService (Mock Provider)"
        >
          {liveEvents.length ? (
            <JsonViewer data={liveEvents.slice(-12)} />
          ) : (
            <p className="empty-state">Sem eventos recebidos do stream no momento.</p>
          )}
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
                    {name.toUpperCase()}
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
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleSimulatorStart}
                >
                  Iniciar simulacao
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleSimulatorPause}
                >
                  Pausar simulacao
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={handleSimulatorReset}
                >
                  Resetar simulacao
                </button>
              </>
            ) : null}
            <span>{liveEvents.length} eventos detectados</span>
            {isAnalyzing ? <span className="spinner" aria-label="Analisando" /> : null}
          </div>
          <p className="auto-indicator">
            ● {isAnalyzing ? "Analisando..." : lastAnalyzedAt ? `Ultima analise as ${formatClock(lastAnalyzedAt)}` : "Idle"}
          </p>
          <div className="status-line">
            <p className="status-label">Estado do stream</p>
            <StatusBadge status={liveConnected ? "online" : "offline"} />
          </div>
          <div className="status-line">
            <p className="status-label">Provider ativo</p>
            <StatusBadge status={providerName} />
          </div>
          <div className="status-line">
            <p className="status-label">Estado da analise</p>
            <StatusBadge status={requestStateLabel(analysisState)} />
          </div>
          {analysisError ? <p className="error-text">{analysisError}</p> : null}
        </Panel>

        <Panel title="Status da IA" subtitle="Consome GET /api/v1/laboratory/health">
          <div className="action-row">
            <button
              className="analyze-button"
              type="button"
              onClick={handleCheckHealth}
              disabled={isCheckingHealth}
            >
              {isCheckingHealth ? "Consultando..." : "Atualizar status"}
            </button>
            <StatusBadge
              status={healthState === "success" ? health?.status ?? "online" : requestStateLabel(healthState)}
            />
          </div>
          <div className="status-line">
            <p className="status-label">Estado do health-check</p>
            <StatusBadge status={requestStateLabel(healthState)} />
          </div>
          {health ? <JsonViewer data={health} /> : <p className="empty-state">Sem status consultado.</p>}
          {healthError ? <p className="error-text">{healthError}</p> : null}
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel title="Painel de Estatisticas" subtitle="statistics">
          {analysis ? <JsonViewer data={analysis.statistics} /> : <p className="empty-state">Execute uma analise para exibir dados.</p>}
        </Panel>
        <Panel title="Painel de Padroes" subtitle="patterns">
          {analysis ? <JsonViewer data={analysis.patterns} /> : <p className="empty-state">Sem dados de padroes.</p>}
        </Panel>
        <Panel title="Painel de Regime" subtitle="regime">
          {analysis ? <JsonViewer data={analysis.regime} /> : <p className="empty-state">Sem dados de regime.</p>}
        </Panel>
        <Panel title="Painel de Tendencia" subtitle="trend">
          {analysis ? <JsonViewer data={analysis.trend} /> : <p className="empty-state">Sem dados de tendencia.</p>}
        </Panel>
        <Panel title="Painel de Sazonalidade" subtitle="seasonality">
          {analysis ? <JsonViewer data={analysis.seasonality} /> : <p className="empty-state">Sem dados de sazonalidade.</p>}
        </Panel>
        <Panel title="Painel de Correlacao" subtitle="correlation">
          {analysis ? <JsonViewer data={analysis.correlation} /> : <p className="empty-state">Sem dados de correlacao.</p>}
        </Panel>
        <Panel title="Painel de Probabilidade" subtitle="probability">
          {analysis ? <JsonViewer data={analysis.probability} /> : <p className="empty-state">Sem dados de probabilidade.</p>}
        </Panel>
        <Panel title="Painel de Risco" subtitle="risk">
          {analysis ? <JsonViewer data={analysis.risk} /> : <p className="empty-state">Sem dados de risco.</p>}
        </Panel>
        <Panel title="Painel de Consenso" subtitle="consensus">
          {analysis ? <JsonViewer data={analysis.consensus} /> : <p className="empty-state">Sem dados de consenso.</p>}
        </Panel>
        <Panel title="Painel de Confianca" subtitle="confidence">
          {analysis ? <JsonViewer data={analysis.confidence} /> : <p className="empty-state">Sem dados de confianca.</p>}
        </Panel>
        <Panel title="Painel de Sinal" subtitle="signal">
          {analysis ? <JsonViewer data={analysis.signal} /> : <p className="empty-state">Sem dados de sinal.</p>}
        </Panel>
        <Panel title="Painel de Explicacao" subtitle="explanation">
          {analysis ? <JsonViewer data={analysis.explanation} /> : <p className="empty-state">Sem dados de explicacao.</p>}
        </Panel>
        <Panel title="Learning" subtitle="aprendizado continuo do stream">
          <div className="learning-metrics">
            <p><strong>Learning Score:</strong> {learning.learning_score}</p>
            <p><strong>Accuracy:</strong> {learning.accuracy}%</p>
            <p><strong>Samples:</strong> {learning.samples}</p>
            <p><strong>Memory Size:</strong> {Object.keys(learning.pattern_memory).length}</p>
            <p><strong>Adaptation:</strong> {learning.adaptation_level}</p>
            <p><strong>Stability:</strong> {learning.stability}</p>
          </div>
          <JsonViewer
            data={{
              learning_score: learning.learning_score,
              samples: learning.samples,
              accuracy: learning.accuracy,
              adaptation_level: learning.adaptation_level,
              stability: learning.stability,
              pattern_memory: learning.pattern_memory,
              trend_memory: learning.trend_memory,
            }}
          />
        </Panel>
        <Panel title="Persistent Storage" subtitle="memoria local do LearningEngine">
          <div className="learning-metrics">
            <p><strong>Storage Status:</strong> {storageInfo.status}</p>
            <p>
              <strong>Last Save:</strong>{" "}
              {storageInfo.last_save ? formatClock(new Date(storageInfo.last_save)) : "-"}
            </p>
            <p><strong>Total Records:</strong> {storageInfo.total_records}</p>
            <p><strong>Memory Usage:</strong> {storageInfo.memory_usage} bytes</p>
            <p><strong>Auto Save:</strong> {storageInfo.auto_save ? "on" : "off"}</p>
          </div>
          <div className="action-row">
            <button className="analyze-button" type="button" onClick={saveLearningNow}>
              Salvar Agora
            </button>
            <button className="analyze-button" type="button" onClick={clearLearningMemory}>
              Limpar Memoria
            </button>
          </div>
          {storageMessage ? <p className="status-label">{storageMessage}</p> : null}
          <JsonViewer data={storageInfo} />
        </Panel>
        <Panel title="Pattern Discovery" subtitle="descoberta automatica de padroes">
          <div className="learning-metrics">
            <p><strong>Total Patterns:</strong> {patternDiscovery.summary.total_patterns}</p>
            <p><strong>New Patterns:</strong> {patternDiscovery.summary.new_patterns}</p>
            <p><strong>High Confidence:</strong> {patternDiscovery.summary.high_confidence}</p>
            <p><strong>Discarded Patterns:</strong> {patternDiscovery.summary.discarded_patterns}</p>
            <p><strong>Discovery Progress:</strong> {scanProgress}%</p>
          </div>

          <div className="action-row">
            <button
              className="analyze-button"
              type="button"
              onClick={handleScanHistory}
              disabled={isScanningPatterns || learning.samples === 0}
            >
              {isScanningPatterns ? "Scanning..." : "Scan History"}
            </button>
            {isScanningPatterns ? <span className="spinner" aria-label="Scanning" /> : null}
          </div>

          <div className="progress-track" role="progressbar" aria-valuenow={scanProgress}>
            <div className="progress-fill" style={{ width: `${scanProgress}%` }} />
          </div>
          {scanMessage ? <p className="status-label">{scanMessage}</p> : null}

          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Occurrences</th>
                  <th>Confidence</th>
                  <th>Accuracy</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patternDiscovery.patterns.length ? (
                  patternDiscovery.patterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td>{pattern.pattern}</td>
                      <td>{pattern.occurrences}</td>
                      <td>{pattern.confidence}%</td>
                      <td>{pattern.accuracy}%</td>
                      <td>{pattern.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>Nenhum padrao descoberto ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Pattern Ranking" subtitle="classificacao automatica de padroes">
          <div className="learning-metrics">
            <p><strong>Top 10 Patterns:</strong> {rankingTop10.length}</p>
            <p><strong>Top Confidence:</strong> {topConfidence}%</p>
            <p><strong>Top Accuracy:</strong> {topAccuracy}%</p>
            <p><strong>Top Stable:</strong> {topStable}%</p>
            <p><strong>Top Recent:</strong> {topRecent}</p>
          </div>
          <ol className="top-patterns">
            {rankingTop10.map((pattern) => (
              <li key={`top-${pattern.id}`}>
                {pattern.pattern} ({pattern.rank})
              </li>
            ))}
          </ol>

          <div className="filters-row">
            <label><input type="checkbox" checked={filterElite} onChange={(e) => setFilterElite(e.target.checked)} /> Mostrar apenas Elite</label>
            <label><input type="checkbox" checked={filterHighConfidence} onChange={(e) => setFilterHighConfidence(e.target.checked)} /> Mostrar apenas Alta Confianca</label>
            <label><input type="checkbox" checked={filterActive} onChange={(e) => setFilterActive(e.target.checked)} /> Mostrar apenas Ativos</label>
            <label><input type="checkbox" checked={filterRecent} onChange={(e) => setFilterRecent(e.target.checked)} /> Mostrar apenas Recentes</label>
          </div>

          <div className="action-row">
            <label className="provider-select">
              Ordenar por
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "confidence" | "accuracy" | "occurrences" | "recent") }>
                <option value="score">Score</option>
                <option value="confidence">Confidence</option>
                <option value="accuracy">Accuracy</option>
                <option value="occurrences">Occurrences</option>
                <option value="recent">Last Seen</option>
              </select>
            </label>
            <label className="provider-select">
              Direcao
              <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as "asc" | "desc") }>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </label>
          </div>

          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Rank</th>
                  <th>Score</th>
                  <th>Confidence</th>
                  <th>Accuracy</th>
                  <th>Occurrences</th>
                  <th>Last Seen</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rankedPatterns.length ? (
                  rankedPatterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td>{pattern.pattern}</td>
                      <td>{pattern.rank}</td>
                      <td>{pattern.global_score}</td>
                      <td>{pattern.confidence}%</td>
                      <td>{pattern.accuracy}%</td>
                      <td>{pattern.occurrences}</td>
                      <td>{pattern.last_seen ? formatClock(new Date(pattern.last_seen)) : "-"}</td>
                      <td>{pattern.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>Nenhum padrao ranqueado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Strategy Center" subtitle="selecao automatica de estrategia em tempo real">
          <div className="learning-metrics">
            <p><strong>Current Strategy:</strong> {strategyResult.best_strategy}</p>
            <p><strong>Strategy Score:</strong> {strategyResult.strategy_score}</p>
            <p><strong>Expected Win Rate:</strong> {strategyResult.expected_win_rate}%</p>
            <p><strong>Expected Risk:</strong> {strategyResult.expected_risk}%</p>
            <p><strong>Confidence:</strong> {strategyResult.confidence}%</p>
            <p><strong>Expected Delay:</strong> {strategyResult.expected_delay}s</p>
            <p><strong>Mode:</strong> {strategyMode.toUpperCase()}</p>
          </div>

          <div className="action-row">
            <button className="analyze-button" type="button" onClick={handleAutoStrategy}>
              Auto Strategy
            </button>
            <button className="analyze-button" type="button" onClick={handleManualStrategy}>
              Manual Strategy
            </button>
            <label className="provider-select">
              Estrategia manual
              <select
                value={manualStrategy}
                onChange={(event) =>
                  setManualStrategy(
                    event.target.value as
                      | "Conservative"
                      | "Balanced"
                      | "Aggressive"
                      | "Adaptive"
                      | "Experimental"
                  )
                }
              >
                <option value="Conservative">Conservative</option>
                <option value="Balanced">Balanced</option>
                <option value="Aggressive">Aggressive</option>
                <option value="Adaptive">Adaptive</option>
                <option value="Experimental">Experimental</option>
              </select>
            </label>
            <button
              className="analyze-button"
              type="button"
              onClick={() => runStrategySelection(strategyMode, manualStrategy)}
              disabled={!patternRanking.ranked_patterns.length && !patternDiscovery.patterns.length}
            >
              Atualizar estrategia
            </button>
          </div>

          <div className="status-line">
            <p className="status-label"><strong>Recommendation:</strong> {strategyResult.recommendation}</p>
          </div>
          <p className="status-label"><strong>Reason:</strong> {strategyResult.reason}</p>

          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {strategyResult.strategy_scores.length ? (
                  strategyResult.strategy_scores.map((row) => (
                    <tr key={`strategy-score-${row.strategy}`}>
                      <td>{row.strategy}</td>
                      <td>{row.score}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>Sem scores de estrategia ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h4 className="status-label">Historico de estrategias</h4>
          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Mode</th>
                  <th>Strategy</th>
                  <th>Score</th>
                  <th>Win Rate</th>
                  <th>Risk</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {strategyHistory.length ? (
                  strategyHistory.map((item, index) => (
                    <tr key={`strategy-history-${item.selected_at}-${index}`}>
                      <td>{formatClock(new Date(item.selected_at))}</td>
                      <td>{item.mode}</td>
                      <td>{item.strategy}</td>
                      <td>{item.strategy_score}</td>
                      <td>{item.expected_win_rate}%</td>
                      <td>{item.expected_risk}%</td>
                      <td>{item.confidence}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>Nenhuma estrategia selecionada ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Performance Analytics" subtitle="monitoramento continuo do desempenho real da IA">
          <div className="learning-metrics">
            <p><strong>Overall Accuracy:</strong> {performanceAnalytics.overall_accuracy}%</p>
            <p><strong>Today's Accuracy:</strong> {performanceAnalytics.todays_accuracy}%</p>
            <p><strong>Last 100 Predictions:</strong> {performanceAnalytics.last_100_predictions}</p>
            <p><strong>Win Rate:</strong> {performanceAnalytics.win_rate}%</p>
            <p><strong>Loss Rate:</strong> {performanceAnalytics.loss_rate}%</p>
            <p><strong>Average Confidence:</strong> {performanceAnalytics.average_confidence}%</p>
            <p><strong>Average Risk:</strong> {performanceAnalytics.average_risk}%</p>
            <p><strong>Prediction Accuracy:</strong> {performanceAnalytics.prediction_accuracy}%</p>
            <p><strong>Strategy Accuracy:</strong> {performanceAnalytics.strategy_accuracy}%</p>
            <p><strong>Pattern Accuracy:</strong> {performanceAnalytics.pattern_accuracy}%</p>
            <p><strong>Learning Evolution:</strong> {performanceAnalytics.learning_evolution}%</p>
            <p><strong>Best Strategy:</strong> {performanceAnalytics.best_strategy}</p>
            <p><strong>Worst Strategy:</strong> {performanceAnalytics.worst_strategy}</p>
            <p><strong>Best Pattern:</strong> {performanceAnalytics.best_pattern}</p>
            <p><strong>Worst Pattern:</strong> {performanceAnalytics.worst_pattern}</p>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h4 className="status-label">Win/Loss Chart</h4>
              <div className="stacked-bar" aria-label="Win and loss distribution">
                <div className="stacked-win" style={{ width: `${winPercent}%` }} />
                <div className="stacked-loss" style={{ width: `${lossPercent}%` }} />
              </div>
              <p className="status-label">
                Wins: {performanceAnalytics.win_loss_chart.wins} | Losses: {performanceAnalytics.win_loss_chart.losses}
              </p>
            </div>

            <div className="chart-card">
              <h4 className="status-label">Accuracy Timeline</h4>
              <svg className="sparkline" viewBox="0 0 320 84" role="img" aria-label="Accuracy timeline">
                <polyline points={accuracySparkline} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" />
              </svg>
            </div>

            <div className="chart-card">
              <h4 className="status-label">Learning Curve</h4>
              <svg className="sparkline" viewBox="0 0 320 84" role="img" aria-label="Learning curve">
                <polyline points={learningSparkline} fill="none" stroke="var(--accent-lime)" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h4 className="status-label">Accuracy por hora</h4>
              <div className="bar-list">
                {performanceAnalytics.accuracy_by_hour.slice(0, 12).map((item) => (
                  <div className="bar-row" key={`hour-${item.key}`}>
                    <span className="bar-label">{item.key}h</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${item.accuracy}%` }} />
                    </div>
                    <span className="bar-value">{item.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h4 className="status-label">Accuracy por estrategia</h4>
              <div className="bar-list">
                {performanceAnalytics.accuracy_by_strategy.slice(0, 8).map((item) => (
                  <div className="bar-row" key={`strategy-${item.key}`}>
                    <span className="bar-label">{item.key}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${item.accuracy}%` }} />
                    </div>
                    <span className="bar-value">{item.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h4 className="status-label">Performance por padrao</h4>
              <div className="bar-list">
                {performanceAnalytics.performance_by_pattern.slice(0, 8).map((item) => (
                  <div className="bar-row" key={`pattern-${item.key}`}>
                    <span className="bar-label">{item.key}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${item.accuracy}%` }} />
                    </div>
                    <span className="bar-value">{item.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h4 className="status-label">Historico dos ultimos 100 resultados</h4>
          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Outcome</th>
                  <th>Strategy</th>
                  <th>Pattern</th>
                  <th>Prediction Acc.</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Learning</th>
                </tr>
              </thead>
              <tbody>
                {performanceAnalytics.last_results.length ? (
                  performanceAnalytics.last_results.map((item) => (
                    <tr key={item.id}>
                      <td>{formatClock(new Date(item.timestamp))}</td>
                      <td>{item.outcome}</td>
                      <td>{item.strategy}</td>
                      <td>{item.pattern}</td>
                      <td>{item.prediction_accuracy}%</td>
                      <td>{item.confidence}%</td>
                      <td>{item.risk}%</td>
                      <td>{item.learning_score}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>Sem resultados historicos ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </main>
  );
}

export default App;
