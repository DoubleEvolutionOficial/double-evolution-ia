import { CsvProvider } from "./providers/csvProvider";
import { ReplayProvider } from "./providers/replayProvider";
import { SimulatorProvider } from "./providers/simulatorProvider";
import { WebSocketProvider } from "./providers/webSocketProvider";
import {
  DataProviderStatus,
  IDataProvider,
  ManagedProviderId,
  ProviderManagerCallback,
  ProviderManagerSnapshot,
} from "./types";

type ProviderRegistry = Record<ManagedProviderId, IDataProvider>;

export class ProviderManager {
  private readonly providers: ProviderRegistry;
  private readonly callbacks = new Set<ProviderManagerCallback>();
  private activeProvider: ManagedProviderId;

  constructor(initialProvider: ManagedProviderId = "simulator") {
    this.providers = {
      simulator: new SimulatorProvider(),
      replay: new ReplayProvider(),
      csv: new CsvProvider(),
      websocket: new WebSocketProvider(),
    };

    this.activeProvider = initialProvider;
  }

  setActiveProvider(id: ManagedProviderId): void {
    if (id === this.activeProvider) {
      return;
    }

    this.providers[this.activeProvider].disconnect();
    this.activeProvider = id;
    this.providers[this.activeProvider].connect();
    this.emit();
  }

  getActiveProvider(): ManagedProviderId {
    return this.activeProvider;
  }

  getProviderStatus(id: ManagedProviderId): DataProviderStatus {
    return this.providers[id].status();
  }

  getAllStatuses(): Record<ManagedProviderId, DataProviderStatus> {
    return {
      simulator: this.providers.simulator.status(),
      replay: this.providers.replay.status(),
      csv: this.providers.csv.status(),
      websocket: this.providers.websocket.status(),
    };
  }

  connect(): void {
    this.providers[this.activeProvider].connect();
    this.emit();
  }

  disconnect(): void {
    this.providers[this.activeProvider].disconnect();
    this.emit();
  }

  start(): void {
    this.providers[this.activeProvider].start();
    this.emit();
  }

  pause(): void {
    this.providers[this.activeProvider].pause();
    this.emit();
  }

  reset(): void {
    this.providers[this.activeProvider].reset();
    this.emit();
  }

  subscribe(callback: ProviderManagerCallback): () => void {
    this.callbacks.add(callback);
    callback(this.snapshot());

    return () => {
      this.callbacks.delete(callback);
    };
  }

  private snapshot(): ProviderManagerSnapshot {
    const providers = this.getAllStatuses();
    return {
      activeProvider: this.activeProvider,
      activeStatus: providers[this.activeProvider],
      providers,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}

export const providerManager = new ProviderManager();
