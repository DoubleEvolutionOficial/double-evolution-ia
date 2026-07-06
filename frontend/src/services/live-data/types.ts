export type LiveDataEvent = {
  timestamp: string;
  color: "red" | "black" | "white";
  number: number;
  white: boolean;
  sequence: string[];
};

export type LiveDataCallback = (events: LiveDataEvent[]) => void;

export interface LiveDataProviderContract {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  getLatestEvents(): LiveDataEvent[];
  subscribe(callback: LiveDataCallback): () => void;
}

export interface LiveDataServiceContract extends LiveDataProviderContract {}