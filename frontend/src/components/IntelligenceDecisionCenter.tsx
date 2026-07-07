type EngineIndicator = {
  name: string;
  value: number;
};

type IntelligenceDecisionCenterProps = {
  status: "Observando" | "Preparando Entrada" | "Entrada Confirmada" | "Aguardar";
  suggestedColor: "Preto" | "Vermelho" | "Branco";
  confidence: number;
  riskLabel: "Muito baixo" | "Baixo" | "Médio" | "Alto" | "Muito alto";
  engineIndicators: EngineIndicator[];
  justifications: string[];
  streamStatus: "online" | "offline";
};

function statusTone(status: IntelligenceDecisionCenterProps["status"]): "safe" | "watch" | "wait" {
  if (status === "Entrada Confirmada") {
    return "safe";
  }
  if (status === "Preparando Entrada" || status === "Observando") {
    return "watch";
  }
  return "wait";
}

function colorIcon(color: IntelligenceDecisionCenterProps["suggestedColor"]): string {
  if (color === "Preto") {
    return "⚫";
  }
  if (color === "Vermelho") {
    return "🔴";
  }
  return "⚪";
}

function riskTone(risk: IntelligenceDecisionCenterProps["riskLabel"]): "safe" | "watch" | "wait" {
  if (risk === "Muito baixo" || risk === "Baixo") {
    return "safe";
  }
  if (risk === "Médio") {
    return "watch";
  }
  return "wait";
}

export function IntelligenceDecisionCenter({
  status,
  suggestedColor,
  confidence,
  riskLabel,
  engineIndicators,
  justifications,
  streamStatus,
}: IntelligenceDecisionCenterProps) {
  const confidencePercent = Math.max(0, Math.min(100, confidence));

  return (
    <section className="intelligence-center" aria-label="Centro de Decisao da IA">
      <header className="intelligence-header">
        <div>
          <h3>Centro de Decisao da IA</h3>
          <p>Painel premium com leitura contextual em tempo real.</p>
        </div>
        <span className={`intelligence-stream intelligence-stream-${streamStatus}`}>{streamStatus}</span>
      </header>

      <article className="decision-hero">
        <div className="decision-hero-main">
          <div className="decision-block">
            <span className="decision-label">Status</span>
            <strong className={`decision-status decision-status-${statusTone(status)}`}>{status}</strong>
          </div>

          <div className="decision-block">
            <span className="decision-label">Cor sugerida</span>
            <strong className="decision-color">
              <span aria-hidden="true">{colorIcon(suggestedColor)}</span>
              {suggestedColor}
            </strong>
          </div>

          <div className="decision-block">
            <span className="decision-label">Risco</span>
            <strong className={`decision-risk decision-risk-${riskTone(riskLabel)}`}>{riskLabel}</strong>
          </div>
        </div>

        <div className="decision-confidence">
          <div className="decision-confidence-line">
            <span>Confianca</span>
            <strong>{confidencePercent.toFixed(1)}%</strong>
          </div>
          <div className="decision-confidence-track" role="progressbar" aria-valuenow={confidencePercent}>
            <div className="decision-confidence-fill" style={{ width: `${confidencePercent}%` }} />
          </div>
        </div>
      </article>

      {engineIndicators.length ? (
        <article className="engines-panel" aria-label="Motores da IA">
          <h4>Motores da IA</h4>
          <div className="engines-grid">
            {engineIndicators.map((indicator) => {
              const value = Math.max(0, Math.min(100, indicator.value));
              return (
                <div className="engine-item" key={indicator.name}>
                  <div className="engine-item-head">
                    <span>{indicator.name}</span>
                    <strong>{value.toFixed(0)}%</strong>
                  </div>
                  <div className="engine-track">
                    <div className="engine-fill" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ) : null}

      <article className="justifications-panel" aria-label="Justificativa amigavel">
        <h4>Justificativa</h4>
        <div className="justification-list">
          {justifications.map((item) => (
            <span className="justification-pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}
