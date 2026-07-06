import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
} from "../types";
import { MockDataProvider } from "./mockLiveDataProvider";

const MAX_BUFFER = 64;

type ExternalProviderOptions = {
  url?: string;
  pollIntervalMs?: number;
  fallbackProvider?: LiveDataProviderContract;
};

function isValidLiveDataEvent(value: unknown): value is LiveDataEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;
  const color = event.color;
  if (typeof event.timestamp !== "string") {
    return false;
  }
  if (color !== "red" && color !== "black" && color !== "white") {
    return false;
  }
  if (typeof event.number !== "number") {
    return false;
  }
  if (typeof event.white !== "boolean") {
    return false;
  }
  if (!Array.isArray(event.sequence) || !event.sequence.every((item) => typeof item === "string")) {
    return false;
  }

  return true;
}

function extractEvents(payload: unknown): LiveDataEvent[] {
  if (Array.isArray(payload)) {
    return payload.filter(isValidLiveDataEvent);
  }

  if (payload && typeof payload === "object") {
    const maybeEvents = (payload as { events?: unknown }).events;
    if (Array.isArray(maybeEvents)) {
      return maybeEvents.filter(isValidLiveDataEvent);
    }
  }

  return [];
}

export class ExternalDataProvider implements LiveDataProviderContract {
  private readonly url: string;
  private readonly pollIntervalMs: number;
  private readonly fallbackProvider: LiveDataProviderContract;
  private readonly callbacks = new Set<LiveDataCallback>();
  private readonly events: LiveDataEvent[] = [];

  private connected = false;
  private fallbackMode = false;
  private timer: number | null = null;
  private fallbackUnsubscribe: (() => void) | null = null;
  private warnedMissingUrl = false;

  constructor(options: ExternalProviderOptions = {}) {
    this.url = options.url ?? "";
    this.pollIntervalMs = options.pollIntervalMs ?? 2500;
    this.fallbackProvider = options.fallbackProvider ?? new MockDataProvider();
  }

  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;

    if (!this.url) {
      this.activateFallback("ExternalDataProvider sem URL configurada");
      return;
    }

    void this.pollOnce();
    this.timer = window.setInterval(() => {
      void this.pollOnce();
    }, this.pollIntervalMs);
  }

  disconnect(): void {
    this.connected = false;
    this.stopPolling();
    this.deactivateFallback();
    this.emit();
  }

  isConnected(): boolean {
    if (!this.connected) {
      return false;
    }
    if (this.fallbackMode) {
      return this.fallbackProvider.isConnected();
    }
    return true;
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

  private async pollOnce(): Promise<void> {
    if (!this.connected || this.fallbackMode) {
      return;
    }

    try {
      const response = await fetch(this.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`ExternalDataProvider indisponivel (${response.status})`);
      }

      const payload = (await response.json()) as unknown;
      const externalEvents = extractEvents(payload);
      if (!externalEvents.length) {
        throw new Error("ExternalDataProvider recebeu payload sem eventos validos");
      }

      this.events.splice(0, this.events.length, ...externalEvents.slice(-MAX_BUFFER));
      this.emit();
    } catch (error) {
      this.activateFallback(
        error instanceof Error
          ? error.message
          : "ExternalDataProvider indisponivel"
      );
    }
  }

  private activateFallback(reason: string): void {
    if (!this.connected) {
      return;
    }

    if (!this.warnedMissingUrl || !this.fallbackMode) {
      console.warn(reason);
      this.warnedMissingUrl = true;
    }

    if (this.fallbackMode) {
      return;
    }

    this.stopPolling();
    this.fallbackMode = true;
    this.fallbackProvider.connect();
    this.fallbackUnsubscribe = this.fallbackProvider.subscribe((events) => {
      this.events.splice(0, this.events.length, ...events.slice(-MAX_BUFFER));
      this.emit();
    });
    this.emit();
  }

  private deactivateFallback(): void {
    if (!this.fallbackMode) {
      return;
    }

    this.fallbackMode = false;
    this.fallbackProvider.disconnect();

    if (this.fallbackUnsubscribe) {
      this.fallbackUnsubscribe();
      this.fallbackUnsubscribe = null;
    }
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}