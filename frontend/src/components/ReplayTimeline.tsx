import { useEffect, useMemo, useRef, useState } from "react";
import { LiveDataEvent } from "../services/live-data/types";
import { getDoubleColor } from "../utils/doubleColor";

type ReplayTimelineProps = {
  events: LiveDataEvent[];
};

type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10 | 20;
type ReplayZoom = "small" | "normal" | "large";

type ReplayStats = {
  red: number;
  black: number;
  white: number;
  longestStreak: number;
  streakColor: "red" | "black" | "white" | "-";
  redPercent: string;
  blackPercent: string;
  whitePercent: string;
};

const SPEED_OPTIONS: ReplaySpeed[] = [0.5, 1, 2, 5, 10, 20];
const ZOOM_OPTIONS: ReplayZoom[] = ["small", "normal", "large"];

const ZOOM_CONFIG: Record<
  ReplayZoom,
  {
    size: number;
    label: string;
  }
> = {
  small: { size: 38, label: "Pequeno" },
  normal: { size: 52, label: "Normal" },
  large: { size: 66, label: "Grande" },
};

const GRID_GAP = 10;
const VIEWPORT_HEIGHT = 430;
const OVERSCAN_ROWS = 4;

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour12: false });
}

function buildReplayStats(events: LiveDataEvent[]): ReplayStats {
  if (!events.length) {
    return {
      red: 0,
      black: 0,
      white: 0,
      longestStreak: 0,
      streakColor: "-",
      redPercent: "0.0",
      blackPercent: "0.0",
      whitePercent: "0.0",
    };
  }

  let red = 0;
  let black = 0;
  let white = 0;

  let longestStreak = 0;
  let streakColor: ReplayStats["streakColor"] = "-";
  let currentStreak = 0;
  let currentColor: ReplayStats["streakColor"] = "-";

  for (const event of events) {
    const color = getDoubleColor(event.number);

    if (color === "red") {
      red += 1;
    }
    if (color === "black") {
      black += 1;
    }
    if (color === "white") {
      white += 1;
    }

    if (color === currentColor) {
      currentStreak += 1;
    } else {
      currentColor = color;
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      streakColor = currentColor;
    }
  }

  const total = events.length;

  return {
    red,
    black,
    white,
    longestStreak,
    streakColor,
    redPercent: ((red / total) * 100).toFixed(1),
    blackPercent: ((black / total) * 100).toFixed(1),
    whitePercent: ((white / total) * 100).toFixed(1),
  };
}

export function ReplayTimeline({ events }: ReplayTimelineProps) {
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState<ReplayZoom>("normal");
  const [cursor, setCursor] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(960);
  const [scrollTop, setScrollTop] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lastLengthRef = useRef(0);

  const total = events.length;
  const safeCursor = total ? Math.max(0, Math.min(cursor, total - 1)) : 0;
  const visibleEvents = useMemo(() => {
    if (!total) {
      return [];
    }
    return events.slice(0, safeCursor + 1);
  }, [events, safeCursor, total]);

  useEffect(() => {
    const prevLength = lastLengthRef.current;

    if (!total) {
      setCursor(0);
      setIsPlaying(false);
      lastLengthRef.current = 0;
      return;
    }

    if (prevLength === 0) {
      setCursor(total - 1);
      lastLengthRef.current = total;
      return;
    }

    const wasAtEnd = safeCursor >= prevLength - 1;
    if (!isPlaying && wasAtEnd && total > prevLength) {
      setCursor(total - 1);
    } else {
      setCursor((previous) => Math.min(previous, total - 1));
    }

    lastLengthRef.current = total;
  }, [isPlaying, safeCursor, total]);

  useEffect(() => {
    if (!isPlaying || total <= 1) {
      return;
    }

    const tickMs = Math.max(30, Math.round(500 / speed));
    const timer = window.setInterval(() => {
      setCursor((previous) => {
        if (previous >= total - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, tickMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, speed, total]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setViewportWidth(entry.contentRect.width);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const stoneSize = ZOOM_CONFIG[zoom].size;
  const itemWidth = stoneSize + 20;
  const rowHeight = stoneSize + 56;

  const columnCount = Math.max(5, Math.floor((viewportWidth + GRID_GAP) / (itemWidth + GRID_GAP)));
  const rowCount = Math.ceil(visibleEvents.length / columnCount);

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  const endRow = Math.max(
    startRow,
    Math.min(rowCount - 1, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / rowHeight) + OVERSCAN_ROWS)
  );

  const startIndex = startRow * columnCount;
  const endIndex = Math.min(visibleEvents.length, (endRow + 1) * columnCount);
  const virtualItems = visibleEvents.slice(startIndex, endIndex);

  const stats = useMemo(() => buildReplayStats(visibleEvents), [visibleEvents]);
  const recent = useMemo(() => visibleEvents.slice(-14).reverse(), [visibleEvents]);

  function handlePlay(): void {
    if (!total) {
      return;
    }

    if (safeCursor >= total - 1) {
      setCursor(0);
    }

    setIsPlaying(true);
  }

  function handlePause(): void {
    setIsPlaying(false);
  }

  function handleRestart(): void {
    setIsPlaying(false);
    setCursor(0);
  }

  return (
    <section className="replay-shell" aria-label="Replay timeline profissional">
      <div className="replay-toolbar">
        <div className="replay-toolbar-group">
          <button type="button" className="replay-control" onClick={handlePlay} disabled={!total}>
            ▶ Play
          </button>
          <button type="button" className="replay-control" onClick={handlePause} disabled={!isPlaying}>
            ⏸ Pause
          </button>
          <button type="button" className="replay-control" onClick={handleRestart} disabled={!total}>
            ⏮ Reiniciar
          </button>
        </div>

        <div className="replay-toolbar-group replay-speed-group">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`replay-pill ${speed === option ? "replay-pill-active" : ""}`}
              onClick={() => setSpeed(option)}
            >
              {option}x
            </button>
          ))}
        </div>

        <div className="replay-toolbar-group replay-zoom-group">
          {ZOOM_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`replay-pill ${zoom === option ? "replay-pill-active" : ""}`}
              onClick={() => setZoom(option)}
            >
              {ZOOM_CONFIG[option].label}
            </button>
          ))}
        </div>
      </div>

      <div className="replay-slider-wrap">
        <input
          className="replay-slider"
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={safeCursor}
          onChange={(event) => {
            setCursor(Number(event.target.value));
            setIsPlaying(false);
          }}
          disabled={!total}
        />
        <div className="replay-slider-meta">
          <span>Posicao: {total ? safeCursor + 1 : 0}</span>
          <span>Historico: {total}/500</span>
          <span>Status: {isPlaying ? "reproduzindo" : "pausado"}</span>
        </div>
      </div>

      <div className="replay-strip" aria-label="ultimos eventos do replay">
        {recent.length ? (
          recent.map((event, index) => (
            <article key={`${event.timestamp}-${index}`} className="replay-strip-pill">
              <span className={`replay-strip-dot replay-strip-dot-${event.color}`} />
              <strong>{event.number}</strong>
              <small>{formatTime(event.timestamp)}</small>
            </article>
          ))
        ) : (
          <p className="replay-empty">Sem historico para replay ainda.</p>
        )}
      </div>

      <div className="replay-content">
        <div
          className="replay-viewport"
          ref={viewportRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ height: `${VIEWPORT_HEIGHT}px` }}
        >
          <div className="replay-virtual-space" style={{ height: `${rowCount * rowHeight}px` }}>
            {virtualItems.map((event, localIndex) => {
              const absoluteIndex = startIndex + localIndex;
              const row = Math.floor(absoluteIndex / columnCount);
              const col = absoluteIndex % columnCount;
              const x = col * (itemWidth + GRID_GAP);
              const y = row * rowHeight;
              const isNewest = absoluteIndex === visibleEvents.length - 1;

              return (
                <article
                  key={`${event.timestamp}-${event.color}-${absoluteIndex}`}
                  className={`replay-stone-card ${isNewest ? "replay-stone-enter" : ""}`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                    width: `${itemWidth}px`,
                  }}
                >
                  <span className="replay-position">#{absoluteIndex + 1}</span>
                  <div
                    className={`replay-stone replay-stone-${event.color}`}
                    style={{ width: `${stoneSize}px`, height: `${stoneSize}px` }}
                  >
                    <strong>{event.number}</strong>
                  </div>
                  <small>{formatTime(event.timestamp)}</small>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="replay-stats">
          <h4>Estatisticas do Replay</h4>
          <div className="replay-stats-grid">
            <div className="replay-stat-card replay-stat-red">
              <span>Vermelhos</span>
              <strong>{stats.red}</strong>
              <small>{stats.redPercent}%</small>
            </div>
            <div className="replay-stat-card replay-stat-black">
              <span>Pretos</span>
              <strong>{stats.black}</strong>
              <small>{stats.blackPercent}%</small>
            </div>
            <div className="replay-stat-card replay-stat-white">
              <span>Brancos</span>
              <strong>{stats.white}</strong>
              <small>{stats.whitePercent}%</small>
            </div>
            <div className="replay-stat-card">
              <span>Maior sequencia</span>
              <strong>{stats.longestStreak}</strong>
              <small>{stats.streakColor === "-" ? "-" : stats.streakColor}</small>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
