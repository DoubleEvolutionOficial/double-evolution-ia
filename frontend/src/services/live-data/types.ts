export type LiveDataEvent = {
  timestamp: string;
  color: "red" | "black" | "white";
  number: number;
  white: boolean;
  sequence: string[];
};

export type SimulatorSpeed = "lento" | "normal" | "rapido";

export type LiveDataCallback = (events: LiveDataEvent[]) => void;

export type LiveDataProviderName = "mock" | "manual" | "external" | "simulator";

export interface LiveDataProviderContract {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  getLatestEvents(): LiveDataEvent[];
  subscribe(callback: LiveDataCallback): () => void;
}

export interface LiveDataServiceContract extends LiveDataProviderContract {
  getProviderName(): LiveDataProviderName;
  setProvider(name: LiveDataProviderName): void;
  getAvailableProviders(): LiveDataProviderName[];
  pushManualEvent?(event: LiveDataEvent): void;
  setSimulatorSpeed?(speed: SimulatorSpeed): void;
  startSimulator?(): void;
  pauseSimulator?(): void;
  resetSimulator?(): void;
}