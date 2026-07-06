import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
} from "../types";

export class FutureExternalDataProvider implements LiveDataProviderContract {
  private connected = false;
  private readonly callbacks = new Set<LiveDataCallback>();
  private readonly events: LiveDataEvent[] = [];

  connect(): void {
    // Placeholder for future external transport implementation.
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

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}