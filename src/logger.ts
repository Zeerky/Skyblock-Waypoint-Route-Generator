export type LogLevel = "info" | "debug" | "success" | "warn" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  detail?: string;
  time: number;
}

let nextId = 0;

export function createLogEntry(
  level: LogLevel,
  message: string,
  detail?: string,
): LogEntry {
  return {
    id: ++nextId,
    level,
    message,
    detail,
    time: Date.now(),
  };
}

export class ThrottledLogger {
  private lastEmit = 0;
  private pending: LogEntry | null = null;

  constructor(
    private minIntervalMs: number,
    private onEmit: (entry: LogEntry) => void,
  ) {}

  log(level: LogLevel, message: string, detail?: string, force = false): void {
    const entry = createLogEntry(level, message, detail);
    if (force) {
      this.flush();
      this.onEmit(entry);
      this.lastEmit = Date.now();
      return;
    }
    this.pending = entry;
    const now = Date.now();
    if (now - this.lastEmit >= this.minIntervalMs) {
      this.flush();
      this.lastEmit = now;
    }
  }

  flush(): void {
    if (this.pending) {
      this.onEmit(this.pending);
      this.pending = null;
    }
  }
}
