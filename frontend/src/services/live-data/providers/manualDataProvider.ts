import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
} from "../types";

const MAX_BUFFER = 64;

export class ManualDataProvider implements LiveDataProviderContract {
  private connected = false;
  private readonly events: LiveDataEvent[] = [];
  private readonly callbacks = new Set<LiveDataCallback>();

  connect(): void {
    this.connected = true;
    this.emit();
  }

  disconnect(): void {
    this.connected = false;
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

  pushEvent(event: LiveDataEvent): void {
    if (!this.connected) {
      return;
    }

    this.events.push(event);
    if (this.events.length > MAX_BUFFER) {
      this.events.splice(0, this.events.length - MAX_BUFFER);
    }
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}