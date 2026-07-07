import { DataProviderStatus, IDataProvider } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

export class WebSocketProvider implements IDataProvider {
  private currentStatus: DataProviderStatus = {
    id: "websocket",
    label: "WebSocket",
    state: "idle",
    availability: "coming_soon",
    message: "Estrutura WebSocket pronta (sem conexao real).",
    updatedAt: nowIso(),
  };

  connect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "connected",
      message: "WebSocket conectado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  disconnect(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopped",
      message: "WebSocket desconectado.",
      updatedAt: nowIso(),
    };
  }

  start(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "running",
      message: "WebSocket iniciado em modo estrutural.",
      updatedAt: nowIso(),
    };
  }

  pause(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "paused",
      message: "WebSocket pausado.",
      updatedAt: nowIso(),
    };
  }

  reset(): void {
    this.currentStatus = {
      ...this.currentStatus,
      state: "idle",
      message: "WebSocket resetado.",
      updatedAt: nowIso(),
    };
  }

  status(): DataProviderStatus {
    return { ...this.currentStatus };
  }
}
