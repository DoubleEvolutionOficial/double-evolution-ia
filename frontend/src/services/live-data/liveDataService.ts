import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderName,
  LiveDataProviderContract,
  LiveDataServiceContract,
  SimulatorSpeed,
} from "./types";
import { MockDataProvider } from "./providers/mockLiveDataProvider";
import { ManualDataProvider } from "./providers/manualDataProvider";
import { ExternalDataProvider } from "./providers/externalDataProvider";
import { RealisticSimulatorProvider } from "./providers/realisticSimulatorProvider";

type ProviderMap = Record<LiveDataProviderName, LiveDataProviderContract>;

export class LiveDataService implements LiveDataServiceContract {
  private readonly providers: ProviderMap;
  private currentProviderName: LiveDataProviderName;
  private currentProvider: LiveDataProviderContract;
  private currentProviderUnsubscribe: (() => void) | null = null;
  private readonly callbacks = new Set<LiveDataCallback>();

  constructor(
    providers: Partial<ProviderMap> = {},
    initialProviderName: LiveDataProviderName = "mock"
  ) {
    const manualProvider = providers.manual ?? new ManualDataProvider();
    this.providers = {
      mock: providers.mock ?? new MockDataProvider(),
      manual: manualProvider,
      external:
        providers.external ??
        new ExternalDataProvider({
          url: import.meta.env.VITE_EXTERNAL_DATA_URL,
        }),
      simulator: providers.simulator ?? new RealisticSimulatorProvider(),
    };

    this.currentProviderName = initialProviderName;
    this.currentProvider = this.providers[this.currentProviderName];
    this.bindProvider();
  }

  connect(): void {
    this.currentProvider.connect();
  }

  disconnect(): void {
    this.currentProvider.disconnect();
  }

  isConnected(): boolean {
    return this.currentProvider.isConnected();
  }

  getLatestEvents(): LiveDataEvent[] {
    return this.currentProvider.getLatestEvents();
  }

  subscribe(callback: LiveDataCallback): () => void {
    this.callbacks.add(callback);
    callback(this.getLatestEvents());

    return () => {
      this.callbacks.delete(callback);
    };
  }

  getProviderName(): LiveDataProviderName {
    return this.currentProviderName;
  }

  getAvailableProviders(): LiveDataProviderName[] {
    return ["mock", "manual", "external", "simulator"];
  }

  setProvider(name: LiveDataProviderName): void {
    if (name === this.currentProviderName) {
      return;
    }

    const wasConnected = this.currentProvider.isConnected();
    this.currentProvider.disconnect();

    if (this.currentProviderUnsubscribe) {
      this.currentProviderUnsubscribe();
      this.currentProviderUnsubscribe = null;
    }

    this.currentProviderName = name;
    this.currentProvider = this.providers[name];
    this.bindProvider();

    if (wasConnected) {
      this.currentProvider.connect();
    }

    this.emit();
  }

  pushManualEvent(event: LiveDataEvent): void {
    const manualProvider = this.providers.manual;
    if (manualProvider instanceof ManualDataProvider) {
      manualProvider.pushEvent(event);
    }
  }

  setSimulatorSpeed(speed: SimulatorSpeed): void {
    const simulator = this.providers.simulator;
    if (simulator instanceof RealisticSimulatorProvider) {
      simulator.setSpeed(speed);
    }
  }

  startSimulator(): void {
    const simulator = this.providers.simulator;
    if (simulator instanceof RealisticSimulatorProvider) {
      simulator.start();
    }
  }

  pauseSimulator(): void {
    const simulator = this.providers.simulator;
    if (simulator instanceof RealisticSimulatorProvider) {
      simulator.pause();
    }
  }

  resetSimulator(): void {
    const simulator = this.providers.simulator;
    if (simulator instanceof RealisticSimulatorProvider) {
      simulator.reset();
      this.emit(simulator.getLatestEvents());
    }
  }

  private bindProvider(): void {
    this.currentProviderUnsubscribe = this.currentProvider.subscribe((events) => {
      this.emit(events);
    });
  }

  private emit(eventsOverride?: LiveDataEvent[]): void {
    const snapshot = eventsOverride ?? this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}

export const liveDataService = new LiveDataService();