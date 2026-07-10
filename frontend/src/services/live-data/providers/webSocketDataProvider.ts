import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
  LiveDataProviderStatus,
} from "../types";
import { getDoubleColor } from "../../../utils/doubleColor";

const MAX_BUFFER = 128;

type WebSocketProviderOptions = {
  url?: string;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
};

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return null;
}

function toColor(value: unknown): "red" | "black" | "white" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "red" || normalized === "black" || normalized === "white") {
    return normalized;
  }
  return null;
}

function toTimestamp(value: unknown): string | null {
  if (typeof value === "string") {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
  }

  return null;
}

function parseSocketIOMessage(raw: string): unknown {
  const payloadText = raw.slice(2).trim();
  if (!payloadText) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadText) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return null;
    }
    return parsed[1];
  } catch {
    return null;
  }
}

function parseRawMessage(raw: string): unknown {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  // Ignore Socket.IO heartbeat and control frames.
  if (text === "2" || text === "3" || text === "40" || text === "41") {
    return null;
  }

  if (text.startsWith("42")) {
    return parseSocketIOMessage(text);
  }

  if (text.startsWith("0") || text.startsWith("1")) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function collectCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.events)) {
    return record.events;
  }

  if (Array.isArray(record.data)) {
    return record.data;
  }

  if (record.data && typeof record.data === "object") {
    return [record.data];
  }

  return [record];
}

export class WebSocketDataProvider implements LiveDataProviderContract {
  private readonly callbacks = new Set<LiveDataCallback>();
  private readonly events: LiveDataEvent[] = [];

  private readonly url: string;
  private readonly reconnectIntervalMs: number;
  private readonly maxReconnectAttempts: number;

  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private connected = false;
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private sequence: string[] = [];
  private status: LiveDataProviderStatus = {
    state: "offline",
    message: "Desconectado",
    lastMessage: null,
    lastMessageAt: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: null,
  };

  constructor(options: WebSocketProviderOptions = {}) {
    this.url = options.url?.trim() ?? "";
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 12;
    this.status.maxReconnectAttempts = this.maxReconnectAttempts;
  }

  connect(): void {
    if (this.connected || this.shouldReconnect) {
      return;
    }

    if (!this.url) {
      this.connected = false;
      this.shouldReconnect = false;
      this.setStatus("not_configured", "WebSocket não configurado");
      return;
    }

    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.stopReconnectTimer();
    this.closeSocket();
    this.setStatus("offline", "Desconectado");
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatestEvents(): LiveDataEvent[] {
    return [...this.events];
  }

  getStatus(): LiveDataProviderStatus {
    return { ...this.status };
  }

  subscribe(callback: LiveDataCallback): () => void {
    this.callbacks.add(callback);
    callback(this.getLatestEvents());

    return () => {
      this.callbacks.delete(callback);
    };
  }

  private openSocket(): void {
    if (!this.url) {
      return;
    }

    this.stopReconnectTimer();
    this.closeSocket();

    this.setStatus(
      this.reconnectAttempts > 0 ? "reconnecting" : "offline",
      this.reconnectAttempts > 0
        ? `Reconectando (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        : "Conectando"
    );

    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect("Falha ao iniciar conexao WebSocket");
      return;
    }

    this.socket.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.setStatus("online", "Conectado");
    };

    this.socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      const parsed = parseRawMessage(event.data);
      if (!parsed) {
        return;
      }

      const candidates = collectCandidates(parsed);
      if (!candidates.length) {
        return;
      }

      let added = false;
      for (const candidate of candidates) {
        const normalized = this.normalizeEvent(candidate);
        if (!normalized) {
          continue;
        }

        this.events.push(normalized);
        added = true;
      }

      if (!added) {
        return;
      }

      if (this.events.length > MAX_BUFFER) {
        this.events.splice(0, this.events.length - MAX_BUFFER);
      }

      this.status.lastMessageAt = new Date().toISOString();
      this.status.lastMessage = event.data.slice(0, 180);
      this.emit();
    };

    this.socket.onerror = () => {
      this.connected = false;
      this.setStatus("offline", "Desconectado");
    };

    this.socket.onclose = () => {
      this.connected = false;
      this.socket = null;
      if (!this.shouldReconnect) {
        this.setStatus("offline", "Desconectado");
        return;
      }
      this.scheduleReconnect("Reconectando");
    };
  }

  private normalizeEvent(value: unknown): LiveDataEvent | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const event = value as Record<string, unknown>;

    // Required fields from incoming payload.
    if (!("timestamp" in event) || !("color" in event) || !("number" in event) || !("white" in event)) {
      return null;
    }

    const timestamp = toTimestamp(event.timestamp);
    const color = toColor(event.color);
    const number =
      typeof event.number === "number" ? event.number : Number.parseInt(String(event.number), 10);
    const white = toBoolean(event.white);

    if (!timestamp || !color || !Number.isFinite(number) || white === null) {
      return null;
    }

    if (!Number.isInteger(number) || number < 0 || number > 14) {
      return null;
    }

    const normalizedColor = getDoubleColor(number);
    if (color !== normalizedColor || white !== (normalizedColor === "white")) {
      return null;
    }

    this.sequence = [...this.sequence, normalizedColor].slice(-8);

    return {
      timestamp,
      color: normalizedColor,
      number,
      white: normalizedColor === "white",
      sequence: [...this.sequence],
    };
  }

  private scheduleReconnect(message: string): void {
    if (!this.shouldReconnect) {
      this.setStatus("offline", "Desconectado");
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.shouldReconnect = false;
      this.setStatus("offline", "Desconectado: limite de reconexao atingido");
      return;
    }

    this.reconnectAttempts += 1;
    this.setStatus(
      "reconnecting",
      `${message} em ${Math.round(this.reconnectIntervalMs / 1000)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.stopReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.openSocket();
    }, this.reconnectIntervalMs);
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    this.socket.close();
    this.socket = null;
  }

  private setStatus(state: LiveDataProviderStatus["state"], message: string): void {
    this.status = {
      ...this.status,
      state,
      message,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getLatestEvents();
    this.callbacks.forEach((callback) => callback(snapshot));
  }
}
