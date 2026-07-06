import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
} from "../types";

const MAX_NUMBER = 14;

function resolveColor(value: number): "red" | "black" | "white" {
  if (value === 0) {
    return "white";
  }
  return value % 2 === 0 ? "black" : "red";
}

const MAX_BUFFER = 64;

export class MockDataProvider implements LiveDataProviderContract {
  private timer: number | null = null;
  private sequence: string[] = [];
  private connected = false;
  private readonly events: LiveDataEvent[] = [];
  private readonly callbacks = new Set<LiveDataCallback>();

  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;

    this.timer = window.setInterval(() => {
      const number = Math.floor(Math.random() * (MAX_NUMBER + 1));
      const color = resolveColor(number);
      const event: LiveDataEvent = {
        timestamp: new Date().toISOString(),
        color,
        number,
        white: color === "white",
        sequence: this.nextSequence(color),
      };

      this.events.push(event);
      if (this.events.length > MAX_BUFFER) {
        this.events.splice(0, this.events.length - MAX_BUFFER);
      }

      this.emit();
    }, 1500);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
    }
    this.timer = null;
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

  private nextSequence(color: string): string[] {
    this.sequence = [...this.sequence, color].slice(-8);
    return [...this.sequence];
  }

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}