import { useEffect, useRef } from "react";
import type { LogEntry } from "../logger";
import type { SearchProgress } from "../searchTypes";

interface Props {
  logs: LogEntry[];
  progress: SearchProgress | null;
  searching: boolean;
  onClear: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SearchConsole({ logs, progress, searching, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, progress?.message]);

  return (
    <section className="panel console-panel">
      <div className="console-header">
        <h2>Search console</h2>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onClear}
          disabled={searching && logs.length === 0}
        >
          Clear
        </button>
      </div>

      {progress && searching && (
        <div className="progress-block">
          <div className="progress-labels">
            <span className="progress-phase">{progress.phase}</span>
            <span className="progress-pct">{Math.round(progress.percent)}%</span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, progress.percent)}%` }}
            />
          </div>
          <p className="progress-message">{progress.message}</p>
          {(progress.bestCoal !== undefined || progress.elapsedMs !== undefined) && (
            <p className="progress-meta">
              {progress.bestCoal !== undefined && (
                <span>Best: {progress.bestCoal.toLocaleString()} coal</span>
              )}
              {progress.bestWaypoints !== undefined && (
                <span>{progress.bestCoal !== undefined ? " · " : ""}
                  {progress.bestWaypoints} stops
                </span>
              )}
              {progress.elapsedMs !== undefined && (
                <span>
                  {(progress.bestCoal !== undefined || progress.bestWaypoints !== undefined) ? " · " : ""}
                  {(progress.elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="log-list" ref={scrollRef}>
        {logs.length === 0 && !searching && (
          <p className="log-empty">Logs appear here when you run a search.</p>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className={`log-line log-${entry.level}`}>
            <span className="log-time">{formatTime(entry.time)}</span>
            <span className="log-msg">{entry.message}</span>
            {entry.detail && (
              <span className="log-detail">{entry.detail}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
