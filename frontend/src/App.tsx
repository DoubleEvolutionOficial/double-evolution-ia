import { useMemo, useState } from "react";
import { analyzeLaboratory } from "./api/laboratory";
import { fetchHealth } from "./api/health";
import { JsonViewer } from "./components/JsonViewer";
import { Panel } from "./components/Panel";
import { StatusBadge } from "./components/StatusBadge";
import {
  LaboratoryAnalyzeResponse,
  LaboratoryEvent,
  LaboratoryHealth,
} from "./types/laboratory";
import "./App.css";

const SAMPLE_EVENTS: LaboratoryEvent[] = [
  {
    timestamp: "2026-07-05T10:00:00Z",
    hour: 10,
    minute: 0,
    side: "left",
    distance: 12,
    classification: "DEVEDOR",
    confidence: 84,
    score: 2.5,
    triggered_rules: ["REG-002"],
    recommendation: "Revisar",
  },
  {
    timestamp: "2026-07-05T10:01:00Z",
    hour: 10,
    minute: 1,
    side: "left",
    distance: 11,
    classification: "DEVEDOR",
    confidence: 83,
    score: 2.4,
    triggered_rules: ["REG-002"],
    recommendation: "Revisar",
  },
  {
    timestamp: "2026-07-05T10:02:00Z",
    hour: 10,
    minute: 2,
    side: "right",
    distance: 10,
    classification: "PAGADOR",
    confidence: 82,
    score: 2.3,
    triggered_rules: ["REG-003"],
    recommendation: "Aprovar",
  },
];

function App() {
  const [health, setHealth] = useState<LaboratoryHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyInput, setHistoryInput] = useState(
    JSON.stringify(SAMPLE_EVENTS, null, 2)
  );
  const [analysis, setAnalysis] = useState<LaboratoryAnalyzeResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const parsedEvents = useMemo(() => {
    try {
      const parsed = JSON.parse(historyInput) as LaboratoryEvent[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [historyInput]);

  async function handleCheckHealth() {
    setIsCheckingHealth(true);
    setError(null);
    try {
      const status = await fetchHealth();
      setHealth(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar status");
    } finally {
      setIsCheckingHealth(false);
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError(null);
    try {
      const events = JSON.parse(historyInput) as LaboratoryEvent[];
      if (!Array.isArray(events)) {
        throw new Error("O histórico deve ser um array JSON de eventos");
      }
      const result = await analyzeLaboratory({ events });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar histórico");
    } finally {
      setIsAnalyzing(false);
    }
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
        <StatusBadge status={health?.status ?? "offline"} />
      </header>

      <section className="actions">
        <Panel
          title="Area de Historico"
          subtitle="Cole um array JSON com eventos para executar a analise"
        >
          <textarea
            className="history-editor"
            value={historyInput}
            onChange={(event) => setHistoryInput(event.target.value)}
          />
          <div className="action-row">
            <button
              className="analyze-button"
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analisando..." : "Analisar"}
            </button>
            <span>{parsedEvents.length} eventos detectados</span>
          </div>
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
            <StatusBadge status={health?.status ?? "offline"} />
          </div>
          {health ? <JsonViewer data={health} /> : <p className="empty-state">Sem status consultado.</p>}
          {error ? <p className="error-text">{error}</p> : null}
        </Panel>
      </section>

      <section className="panel-grid">
        <Panel title="Painel de Estatisticas" subtitle="statistics">
          {analysis ? <JsonViewer data={analysis.statistics} /> : <p className="empty-state">Execute uma analise para exibir dados.</p>}
        </Panel>
        <Panel title="Padroes e Regime" subtitle="patterns e regime">
          {analysis ? <JsonViewer data={{ patterns: analysis.patterns, regime: analysis.regime }} /> : <p className="empty-state">Sem dados de padroes e regime.</p>}
        </Panel>
        <Panel title="Painel de Tendencia" subtitle="trend e seasonality">
          {analysis ? <JsonViewer data={{ trend: analysis.trend, seasonality: analysis.seasonality }} /> : <p className="empty-state">Sem dados de tendencia.</p>}
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
