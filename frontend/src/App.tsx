import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeLaboratory } from "./api/laboratory";
import { fetchHealth } from "./api/health";
import { JsonViewer } from "./components/JsonViewer";
import { Panel } from "./components/Panel";
import { StatusBadge } from "./components/StatusBadge";
import { liveDataService } from "./services/live-data/liveDataService";
import {
  LiveDataEvent,
  LiveDataProviderName,
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

function App() {
  const [health, setHealth] = useState<LaboratoryHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerName, setProviderName] = useState<LiveDataProviderName>(
    liveDataService.getProviderName()
  );
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

  const debounceTimerRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const pendingAutoAnalyzeRef = useRef(false);
  const lastAnalysisSignatureRef = useRef<string>("");

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
    []
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
    const unsubscribe = liveDataService.subscribe((events) => {
      setLiveEvents(events);
      setLiveConnected(liveDataService.isConnected());
      setProviderName(liveDataService.getProviderName());
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
  }, [scheduleAutoAnalyze]);

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
      </section>
    </main>
  );
}

export default App;
