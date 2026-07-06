import {
  LiveDataCallback,
  LiveDataEvent,
  LiveDataProviderContract,
  SimulatorSpeed,
} from "../types";

const MAX_BUFFER = 128;

const SPEED_INTERVAL: Record<SimulatorSpeed, number> = {
  lento: 2400,
  normal: 1200,
  rapido: 450,
};

const COLOR_TRANSITIONS: Record<"red" | "black" | "white", Array<["red" | "black" | "white", number]>> = {
  red: [
    ["red", 0.38],
    ["black", 0.57],
    ["white", 0.05],
  ],
  black: [
    ["red", 0.58],
    ["black", 0.37],
    ["white", 0.05],
  ],
  white: [
    ["red", 0.52],
    ["black", 0.44],
    ["white", 0.04],
  ],
};

export class RealisticSimulatorProvider implements LiveDataProviderContract {
  private readonly callbacks = new Set<LiveDataCallback>();
  private readonly events: LiveDataEvent[] = [];
  private connected = false;
  private running = false;
  private timer: number | null = null;
  private speed: SimulatorSpeed = "normal";
  private sequence: string[] = [];

  connect(): void {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.start();
    this.emit();
  }

  disconnect(): void {
    this.connected = false;
    this.running = false;
    this.stopTimer();
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

  setSpeed(speed: SimulatorSpeed): void {
    if (speed === this.speed) {
      return;
    }

    this.speed = speed;
    if (this.connected && this.running) {
      this.restartTimer();
    }
  }

  start(): void {
    if (!this.connected) {
      return;
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.restartTimer();
    this.emit();
  }

  pause(): void {
    this.running = false;
    this.stopTimer();
    this.emit();
  }

  reset(): void {
    this.events.splice(0, this.events.length);
    this.sequence = [];
    this.emit();
  }

  private restartTimer(): void {
    this.stopTimer();

    this.timer = window.setInterval(() => {
      this.pushSimulatedEvent();
    }, SPEED_INTERVAL[this.speed]);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pushSimulatedEvent(): void {
    if (!this.connected || !this.running) {
      return;
    }

    const previousColor = this.events[this.events.length - 1]?.color ?? "black";
    const color = this.nextColor(previousColor);
    const number = this.numberFromColor(color);

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
  }

  private nextColor(previous: "red" | "black" | "white"): "red" | "black" | "white" {
    const roll = Math.random();
    const transitions = COLOR_TRANSITIONS[previous];
    let acc = 0;

    for (const [color, probability] of transitions) {
      acc += probability;
      if (roll <= acc) {
        return color;
      }
    }

    return "black";
  }

  private numberFromColor(color: "red" | "black" | "white"): number {
    if (color === "white") {
      return 0;
    }

    const candidates: number[] = [];
    for (let i = 1; i <= 14; i += 1) {
      const candidateColor = i % 2 === 0 ? "black" : "red";
      if (candidateColor === color) {
        candidates.push(i);
      }
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index] ?? (color === "red" ? 1 : 2);
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
