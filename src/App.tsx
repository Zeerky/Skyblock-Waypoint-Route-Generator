import { useCallback, useEffect, useRef, useState } from "react";
import { ParameterPanel } from "./components/ParameterPanel";
import { RouteExportPanel } from "./components/RouteExportPanel";
import { RouteMap } from "./components/RouteMap";
import { RouteStats } from "./components/RouteStats";
import { RoutesPage } from "./components/RoutesPage";
import { SearchConsole } from "./components/SearchConsole";
import { useRouteHistory } from "./hooks/useRouteHistory";
import type { LogEntry } from "./logger";
import type { SearchProgress, WorkerRequest, WorkerResponse } from "./searchTypes";
import type { OreCluster, RouteResult } from "./types";
import { DEFAULT_PARAMS } from "./types";

type LoadState = "idle" | "loading" | "ready" | "error";
type AppPage = "finder" | "routes";

export default function App() {
  const [page, setPage] = useState<AppPage>("finder");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const { routes, addRoute, removeRoute, clearRoutes } = useRouteHistory();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clusterCount, setClusterCount] = useState(0);
  const clustersRef = useRef<OreCluster[]>([]);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetch("/ore_clusters.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load clusters (${r.status})`);
        return r.json() as Promise<OreCluster[]>;
      })
      .then((data) => {
        if (cancelled) return;
        clustersRef.current = data;
        setClusterCount(data.length);
        setLoadState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.postMessage({ type: "cancel" });
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (page === "routes" && !selectedRouteId && routes.length > 0) {
      setSelectedRouteId(routes[0].id);
    }
  }, [page, routes, selectedRouteId]);

  const saveResult = useCallback(
    (r: RouteResult) => {
      if (r.waypoints.length === 0) return;
      const id = addRoute(r);
      if (id) setSelectedRouteId(id);
    },
    [addRoute],
  );

  const cancelSearch = useCallback(() => {
    workerRef.current?.postMessage({ type: "cancel" });
    setSearching(false);
    setProgress((p) =>
      p
        ? { ...p, phase: "cancelled", percent: 100, message: "Cancelled" }
        : null,
    );
  }, []);

  const findRoute = useCallback(() => {
    if (loadState !== "ready" || searching) return;
    if (params.minWaypoints > params.maxWaypoints) {
      setSearchError("Min waypoints cannot exceed max waypoints.");
      return;
    }

    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setLogs([]);
    setProgress({
      phase: "filter",
      percent: 0,
      message: "Starting search…",
    });

    workerRef.current?.terminate();
    const worker = new Worker(
      new URL("./routeWorker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    const req: WorkerRequest = {
      type: "find",
      requestId,
      clusters: clustersRef.current,
      params,
    };
    worker.postMessage(req);

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.requestId !== requestId) return;

      if (ev.data.type === "progress") {
        setProgress(ev.data.progress);
        if (ev.data.progress.phase === "cancelled") {
          setSearching(false);
          worker.terminate();
          workerRef.current = null;
        }
        return;
      }

      if (ev.data.type === "log") {
        setLogs((prev) => [...prev, ev.data.entry].slice(-200));
        return;
      }

      if (ev.data.type === "error") {
        setSearchError(ev.data.message);
        setSearching(false);
        worker.terminate();
        workerRef.current = null;
        return;
      }

      const r = ev.data.result;
      if (r.waypoints.length === 0) {
        setSearchError(
          "No route found. Try lowering min coal, increasing max distance, or widening bounds.",
        );
      } else if (r.waypoints.length < params.minWaypoints) {
        setSearchError(
          `Only found ${r.waypoints.length} waypoints (need ${params.minWaypoints}). Relax constraints or lower min waypoints.`,
        );
        setResult(r);
        saveResult(r);
      } else {
        setResult(r);
        saveResult(r);
      }
      setSearching(false);
      setProgress(
        r.waypoints.length
          ? {
              phase: "done",
              percent: 100,
              message: `Complete — ${r.totalCoal} coal`,
              bestCoal: r.totalCoal,
              bestWaypoints: r.waypoints.length,
              elapsedMs: r.elapsedMs,
            }
          : null,
      );
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = () => {
      setSearchError("Route worker crashed. Check the browser console.");
      setSearching(false);
      worker.terminate();
      workerRef.current = null;
    };
  }, [loadState, searching, params, saveResult]);

  const handleRemoveRoute = (id: string) => {
    removeRoute(id);
    if (selectedRouteId === id) setSelectedRouteId(null);
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Coal Route Finder</h1>
          <p className="subtitle">
            Maximize coal along a path where each stop is within your max hop
            distance.
          </p>
        </div>
        <div className="header-right">
          <nav className="app-nav" aria-label="Main">
            <button
              type="button"
              className={`nav-tab${page === "finder" ? " active" : ""}`}
              onClick={() => setPage("finder")}
            >
              Finder
            </button>
            <button
              type="button"
              className={`nav-tab${page === "routes" ? " active" : ""}`}
              onClick={() => setPage("routes")}
            >
              My Routes
              {routes.length > 0 && (
                <span className="nav-badge">{routes.length}</span>
              )}
            </button>
          </nav>
          <div className="header-status">
            {loadState === "loading" && (
              <span className="badge">Loading clusters…</span>
            )}
            {loadState === "ready" && (
              <span className="badge ready">
                {clusterCount.toLocaleString()} clusters
              </span>
            )}
            {loadState === "error" && (
              <span className="badge error">{loadError}</span>
            )}
          </div>
        </div>
      </header>

      {page === "routes" ? (
        <RoutesPage
          routes={routes}
          selectedId={selectedRouteId}
          onSelect={setSelectedRouteId}
          onRemove={handleRemoveRoute}
          onClearAll={() => {
            clearRoutes();
            setSelectedRouteId(null);
          }}
        />
      ) : (
        <main className="layout">
          <aside className="sidebar">
            <ParameterPanel
              params={params}
              onChange={setParams}
              disabled={loadState !== "ready" || searching}
            />
            <div className="actions">
              <button
                type="button"
                className="btn primary"
                disabled={loadState !== "ready" || searching}
                onClick={findRoute}
              >
                {searching ? "Searching…" : "Find best route"}
              </button>
              {searching && (
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={cancelSearch}
                >
                  Cancel
                </button>
              )}
              {searchError && <p className="error-text">{searchError}</p>}
            </div>
          </aside>

          <div className="main-column">
            <SearchConsole
              logs={logs}
              progress={progress}
              searching={searching}
              onClear={() => {
                setLogs([]);
                if (!searching) setProgress(null);
              }}
            />
            <RouteStats result={result} />
            <RouteMap result={result} />
            {result && result.waypoints.length > 0 && (
              <>
                <p className="saved-hint">
                  Saved to{" "}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setPage("routes")}
                  >
                    My Routes
                  </button>
                </p>
                <RouteExportPanel result={result} />
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
