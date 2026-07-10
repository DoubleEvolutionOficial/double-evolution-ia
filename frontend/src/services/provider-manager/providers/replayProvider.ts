import { DataProviderStatus, IDataProvider } from "../types";
import { getDoubleColor } from "../../../utils/doubleColor";

function nowIso(): string {
  return new Date().toISOString();
}

export class ReplayProvider implements IDataProvider {
  private readonly replayReferenceColor = getDoubleColor(0);

  private currentStatus: DataProviderStatus = {
    id: "replay",
    label: "Replay",
    state: "idle",
    availability: "coming_soon",
    message: `Estrutura de Replay pronta (sem carga de arquivos). Cor de referencia para numero 0: ${this.replayReferenceColor}.`,
    updatedAt: nowIso(),
  };

  connect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "connected",
      message: "Replay conectado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  disconnect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopped",
      message: "Replay desconectado.",
      updatedAt: nowIso(),
    };
  }

  start(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "running",
      message: "Replay iniciado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  pause(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "paused",
      message: "Replay pausado.",
      updatedAt: nowIso(),
    };
  }

  reset(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "idle",
      message: "Replay resetado.",
      updatedAt: nowIso(),
    };
  }

  status(): DataProviderStatus {
    return { ...this.currentStatus };
  }
}
