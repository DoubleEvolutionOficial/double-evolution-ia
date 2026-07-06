import { LiveDataEvent, LiveDataProvider } from "../types";

const MAX_NUMBER = 14;

function resolveColor(value: number): "red" | "black" | "white" {
  if (value === 0) {
    return "white";
  }
  return value % 2 === 0 ? "black" : "red";
}

export class MockLiveDataProvider implements LiveDataProvider {
  private timer: number | null = null;
  private sequence: string[] = [];

  start(onEvent: (event: LiveDataEvent) => void): void {
    if (this.timer !== null) {
      return;
    }

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
      onEvent(event);
    }, 1500);
  }

  stop(): void {
    if (this.timer === null) {
      return;
    }
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private nextSequence(color: string): string[] {
    this.sequence = [...this.sequence, color].slice(-8);
    return [...this.sequence];
  }
}