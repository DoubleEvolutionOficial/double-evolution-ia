export type LiveDataEvent = {
  timestamp: string;
  color: "red" | "black" | "white";
  number: number;
  white: boolean;
  sequence: string[];
};

export type SimulatorSpeed = "lento" | "normal" | "rapido";

export type LiveProviderConnectionState =
  | "online"
  | "offline"
  | "reconnecting"
  | "not_configured";

export type LiveDataProviderStatus = {
  state: LiveProviderConnectionState;
  message: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number | null;
};

export type LiveDataCallback = (events: LiveDataEvent[]) => void;

export type LiveDataProviderName =
  | "mock"
  | "manual"
  | "external"
  | "simulator"
  | "websocket";

export interface LiveDataProviderContract {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  getLatestEvents(): LiveDataEvent[];
  subscribe(callback: LiveDataCallback): () => void;
  getStatus?(): LiveDataProviderStatus;
}

export interface LiveDataServiceContract extends LiveDataProviderContract {
  getProviderName(): LiveDataProviderName;
  setProvider(name: LiveDataProviderName): void;
  getAvailableProviders(): LiveDataProviderName[];
  getProviderStatus(): LiveDataProviderStatus;
  pushManualEvent?(event: LiveDataEvent): void;
  setSimulatorSpeed?(speed: SimulatorSpeed): void;
  startSimulator?(): void;
  pauseSimulator?(): void;
  resetSimulator?(): void;
}