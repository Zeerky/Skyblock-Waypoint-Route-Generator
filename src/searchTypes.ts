import type { LogEntry } from "./logger";
import type { RouteResult } from "./types";

export type SearchPhase =
  | "filter"
  | "neighbors"
  | "search"
  | "finalize"
  | "done"
  | "cancelled";

export interface SearchProgress {
  phase: SearchPhase;
  /** 0–100 overall progress */
  percent: number;
  message: string;
  current?: number;
  total?: number;
  bestCoal?: number;
  bestWaypoints?: number;
  elapsedMs?: number;
}

export type WorkerRequest = {
  type: "find";
  requestId: number;
  clusters: import("./types").OreCluster[];
  params: import("./types").RouteParams;
};

export type WorkerResponse =
  | { type: "progress"; requestId: number; progress: SearchProgress }
  | { type: "log"; requestId: number; entry: LogEntry }
  | { type: "result"; requestId: number; result: RouteResult }
  | { type: "error"; requestId: number; message: string };
