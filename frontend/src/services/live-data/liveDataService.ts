import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProvider,
  LiveDataServiceContract,
} from "./types";
import { MockLiveDataProvider } from "./providers/mockLiveDataProvider";

const MAX_BUFFER = 64;

export class LiveDataService implements LiveDataServiceContract {
  private readonly provider: LiveDataProvider;
  private readonly callbacks = new Set<LiveDataCallback>();
  private readonly events: LiveDataEvent[] = [];
  private connected = false;

  constructor(provider: LiveDataProvider = new MockLiveDataProvider()) {
    this.provider = provider;
  }

  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;
    this.provider.start((event) => {
      this.events.push(event);
      if (this.events.length > MAX_BUFFER) {
        this.events.splice(0, this.events.length - MAX_BUFFER);
      }
      this.emit();
    });
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.provider.stop();
    this.emit();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatestEvents(): LiveDataEvent[] {
    return [...this.events];
  }

  subscribe(callback: LiveDataCallback): () => void {
    this.callbacks.add(callback);
    callback(this.getLatestEvents());
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}

export const liveDataService = new LiveDataService();