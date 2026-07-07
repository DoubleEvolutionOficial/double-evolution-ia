import { RealisticSimulatorProvider } from "../../live-data/providers/realisticSimulatorProvider";
import { DataProviderStatus, IDataProvider } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

export class SimulatorProvider implements IDataProvider {
  private readonly simulator = new RealisticSimulatorProvider();

  private currentStatus: DataProviderStatus = {
    id: "simulator",
    label: "Simulator",
    state: "idle",
    availability: "available",
    message: "Pronto para iniciar simulacao.",
    updatedAt: nowIso(),
  };

  connect(): void {
    this.simulator.connect();
    this.currentStatus = {
      ...this.currentStatus,
      state: "connected",
      message: "Simulator conectado.",
      updatedAt: nowIso(),
    };
  }

  disconnect(): void {
    this.simulator.disconnect();
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopped",
      message: "Simulator desconectado.",
      updatedAt: nowIso(),
    };
  }

  start(): void {
    if (!this.simulator.isConnected()) {
      this.simulator.connect();
    }
    this.simulator.start();
    this.currentStatus = {
      ...this.currentStatus,
      state: "running",
      message: "Simulator em execucao.",
      updatedAt: nowIso(),
    };
  }

  pause(): void {
    this.simulator.pause();
    this.currentStatus = {
      ...this.currentStatus,
      state: "paused",
      message: "Simulator pausado.",
      updatedAt: nowIso(),
    };
  }

  reset(): void {
    this.simulator.reset();
    this.currentStatus = {
      ...this.currentStatus,
      state: this.simulator.isConnected() ? "connected" : "idle",
      message: "Simulator resetado.",
      updatedAt: nowIso(),
    };
  }

  status(): DataProviderStatus {
    return { ...this.currentStatus };
  }
}
