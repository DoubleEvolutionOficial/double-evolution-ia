import { useEffect, useMemo, useRef, useState } from "react";
import { LiveDataEvent } from "../services/live-data/types";

type StonesGridProps = {
  events: LiveDataEvent[];
};

type StoneFutureMarkers = {
  entry?: boolean;
  result?: "win" | "loss" | "white";
  decision?: string;
  pattern?: string;
};

type StoneViewModel = {
  id: string;
  event: LiveDataEvent;
  minute: string;
  time: string;
  sequenceLabel: string;
  markers: StoneFutureMarkers;
};

const STONES_PER_ROW = 14;

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour12: false });
}

function formatMinute(timestamp: string): string {
  const minute = new Date(timestamp).getMinutes();
  return String(minute).padStart(2, "0");
}

export function StonesGrid({ events }: StonesGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [followNewest, setFollowNewest] = useState(true);

  const stones = useMemo<StoneViewModel[]>(() => {
    return events.map((event, index) => ({
      id: `${event.timestamp}-${event.number}-${index}`,
      event,
      minute: formatMinute(event.timestamp),
      time: formatTime(event.timestamp),
      sequenceLabel: event.sequence.join(" > "),
      // Reserved markers for future IA integrations.
      markers: {},
    }));
  }, [events]);

  const rows = useMemo(() => {
    const grouped: StoneViewModel[][] = [];
    for (let index = 0; index < stones.length; index += STONES_PER_ROW) {
      grouped.push(stones.slice(index, index + STONES_PER_ROW));
    }
    return grouped;
  }, [stones]);

  const minutesHeader = useMemo(() => {
    return Array.from({ length: STONES_PER_ROW }, (_, colIndex) => {
      for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
        const stone = rows[rowIndex][colIndex];
        if (stone) {
          return stone.minute;
        }
      }
      return "--";
    });
  }, [rows]);

  const newestIds = useMemo(() => {
    return new Set(stones.slice(-STONES_PER_ROW).map((stone) => stone.id));
  }, [stones]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !followNewest) {
      return;
    }

    node.scrollTo({
      left: node.scrollWidth,
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [events.length, followNewest]);

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const distanceToRight = node.scrollWidth - node.clientWidth - node.scrollLeft;
    const distanceToBottom = node.scrollHeight - node.clientHeight - node.scrollTop;
    const isNearNewest = distanceToRight < 120 && distanceToBottom < 120;
    setFollowNewest(isNearNewest);
  }

  return (
    <section className="stones-professional-grid" aria-label="Professional stones grid">
      <header className="stones-grid-topbar">
        <div>
          <h4>Historico Profissional</h4>
          <p>Grid com rolagem dupla, minutos no topo e foco automatico na regiao recente.</p>
        </div>
        <div className="stones-grid-state">
          <span>{events.length} eventos</span>
          <span>{followNewest ? "Auto-follow ativo" : "Auto-follow pausado"}</span>
        </div>
      </header>

      <div className="stones-grid-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div
          className="stones-grid-board"
          style={{
            gridTemplateColumns: `repeat(${STONES_PER_ROW}, minmax(104px, 104px))`,
          }}
        >
          {minutesHeader.map((minute, index) => (
            <div className="minute-head-cell" key={`minute-${index}`}>
              <span>Min</span>
              <strong>{minute}</strong>
            </div>
          ))}

          {rows.map((row, rowIndex) =>
            Array.from({ length: STONES_PER_ROW }, (_, colIndex) => {
              const stone = row[colIndex];
              if (!stone) {
                return <div className="stone-card stone-card-empty" key={`empty-${rowIndex}-${colIndex}`} />;
              }

              const colorClass = `stone-circle-${stone.event.color}`;
              const animatedClass = newestIds.has(stone.id) ? "stone-card-new" : "";

              return (
                <article
                  className={`stone-card ${animatedClass}`}
                  key={stone.id}
                  data-tooltip={`Numero: ${stone.event.number}\nCor: ${stone.event.color}\nTimestamp: ${stone.event.timestamp}\nSequencia: ${stone.sequenceLabel}`}
                >
                  <div className={`stone-circle ${colorClass}`}>
                    <span>{stone.event.number}</span>
                  </div>
                  <p className="stone-meta-color">{stone.event.color}</p>
                  <p className="stone-meta-time">{stone.time}</p>

                  <div className="stone-future-markers" aria-hidden="true">
                    <span data-slot="entry">entry</span>
                    <span data-slot="result">result</span>
                    <span data-slot="decision">ia</span>
                    <span data-slot="pattern">pattern</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
