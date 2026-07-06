export type LiveDataEvent = {
  timestamp: string;
  color: "red" | "black" | "white";
  number: number;
  white: boolean;
  sequence: string[];
};

export type LiveDataCallback = (events: LiveDataEvent[]) => void;

export interface LiveDataProvider {
  start(onEvent: (event: LiveDataEvent) => void): void;
  stop(): void;
}

export interface LiveDataServiceContract {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  getLatestEvents(): LiveDataEvent[];
  subscribe(callback: LiveDataCallback): () => void;
}