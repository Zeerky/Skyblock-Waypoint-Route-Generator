import { formatRouteExport } from "./routeFinder";
import type { RouteResult } from "./types";

export function downloadRoute(result: RouteResult, filename?: string): void {
  const text = formatRouteExport(result);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `coal_route_${result.totalCoal}ore_${result.waypoints.length}wp.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyRouteToClipboard(result: RouteResult): Promise<void> {
  await navigator.clipboard.writeText(formatRouteExport(result));
}
