import { createLogEntry } from "./logger";
import { findOptimalRoute } from "./routeFinder";
import type { WorkerRequest, WorkerResponse } from "./searchTypes";

let cancelRequested = false;

self.onmessage = (ev: MessageEvent<WorkerRequest | { type: "cancel" }>) => {
  if (ev.data.type === "cancel") {
    cancelRequested = true;
    return;
  }

  if (ev.data.type !== "find") return;
  cancelRequested = false;
  const { requestId, clusters, params } = ev.data;

  const post = (msg: WorkerResponse) => self.postMessage(msg);

  try {
    const result = findOptimalRoute(clusters, params, {
      shouldCancel: () => cancelRequested,
      onProgress: (progress) => {
        post({ type: "progress", requestId, progress });
      },
      onLog: (level, message, detail) => {
        post({ type: "log", requestId, entry: createLogEntry(level, message, detail) });
      },
    });
    post({ type: "result", requestId, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "Search cancelled") {
      post({
        type: "progress",
        requestId,
        progress: {
          phase: "cancelled",
          percent: 100,
          message: "Search cancelled",
        },
      });
      return;
    }
    post({ type: "error", requestId, message });
  }
};
