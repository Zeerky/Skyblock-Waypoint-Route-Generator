import { useCallback, useEffect, useState } from "react";
import {
  createSavedRoute,
  loadSavedRoutes,
  persistRoutes,
  type SavedRoute,
} from "../routeHistory";
import type { RouteResult } from "../types";

export function useRouteHistory() {
  const [routes, setRoutes] = useState<SavedRoute[]>(() => loadSavedRoutes());

  useEffect(() => {
    persistRoutes(routes);
  }, [routes]);

  const addRoute = useCallback((result: RouteResult) => {
    if (result.waypoints.length === 0) return;
    const entry = createSavedRoute(result);
    setRoutes((prev) => [entry, ...prev]);
    return entry.id;
  }, []);

  const removeRoute = useCallback((id: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
  }, []);

  return { routes, addRoute, removeRoute, clearRoutes };
}
