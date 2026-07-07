import { DataProviderStatus, IDataProvider } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

export class CsvProvider implements IDataProvider {
  private currentStatus: DataProviderStatus = {
    id: "csv",
    label: "CSV",
    state: "idle",
    availability: "coming_soon",
    message: "Estrutura CSV pronta (sem leitura de arquivo).",
    updatedAt: nowIso(),
  };

  connect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "connected",
      message: "CSV conectado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  disconnect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopped",
      message: "CSV desconectado.",
      updatedAt: nowIso(),
    };
  }

  start(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "running",
      message: "CSV iniciado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  pause(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "paused",
      message: "CSV pausado.",
      updatedAt: nowIso(),
    };
  }

  reset(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "idle",
      message: "CSV resetado.",
      updatedAt: nowIso(),
    };
  }

  status(): DataProviderStatus {
    return { ...this.currentStatus };
  }
}
