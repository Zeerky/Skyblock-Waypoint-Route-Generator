import type { RouteResult } from "./types";

export interface SavedRoute {
  id: string;
  createdAt: number;
  label: string;
  result: RouteResult;
}

const STORAGE_KEY = "coal-route-finder-history";
const MAX_ROUTES = 100;

export function formatRouteLabel(result: RouteResult): string {
  const stops = result.waypoints.length;
  const coal = result.totalCoal.toLocaleString();
  const dist = result.totalDistance.toFixed(0);
  return `${coal} coal · ${stops} stops · ${dist} blk`;
}

export function loadSavedRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRoute[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistRoutes(routes: SavedRoute[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes.slice(0, MAX_ROUTES)));
}

export function createSavedRoute(result: RouteResult): SavedRoute {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    label: formatRouteLabel(result),
    result,
  };
}

export function formatRouteDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
