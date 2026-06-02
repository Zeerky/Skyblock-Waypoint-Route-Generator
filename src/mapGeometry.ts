import type { OreCluster } from "./types";

export interface ScreenPoint {
  sx: number;
  sy: number;
  wp: OreCluster;
  index: number;
  radius: number;
}

export interface PathSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  cumStart: number;
}

export interface RouteMapLayout {
  width: number;
  height: number;
  points: ScreenPoint[];
  segments: PathSegment[];
  totalLength: number;
}

export function buildRouteMapLayout(
  waypoints: OreCluster[],
  width: number,
  height: number,
  pad = 28,
): RouteMapLayout | null {
  if (waypoints.length === 0 || width < 1 || height < 1) return null;

  const xs = waypoints.map((p) => p.center[0]);
  const zs = waypoints.map((p) => p.center[2]);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minZ = Math.min(...zs);
  let maxZ = Math.max(...zs);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minZ === maxZ) {
    minZ -= 1;
    maxZ += 1;
  }

  const toScreen = (x: number, z: number) => {
    const sx = pad + ((x - minX) / (maxX - minX)) * (width - pad * 2);
    const sy = pad + ((z - minZ) / (maxZ - minZ)) * (height - pad * 2);
    return [sx, sy] as const;
  };

  const maxBlocks = Math.max(...waypoints.map((p) => p.block_count));
  const points: ScreenPoint[] = waypoints.map((wp, index) => {
    const [sx, sy] = toScreen(wp.center[0], wp.center[2]);
    const radius = 3 + (wp.block_count / maxBlocks) * 5;
    return { sx, sy, wp, index, radius };
  });

  const segments: PathSegment[] = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const x1 = points[i - 1].sx;
    const y1 = points[i - 1].sy;
    const x2 = points[i].sx;
    const y2 = points[i].sy;
    const length = Math.hypot(x2 - x1, y2 - y1);
    segments.push({
      x1,
      y1,
      x2,
      y2,
      length,
      cumStart: totalLength,
    });
    totalLength += length;
  }

  return { width, height, points, segments, totalLength };
}

/** Position and unit tangent at distance `d` along the polyline. */
export function pointAtDistance(
  layout: RouteMapLayout,
  d: number,
): { x: number; y: number; tx: number; ty: number } | null {
  if (layout.totalLength <= 0) {
    const p = layout.points[0];
    return p ? { x: p.sx, y: p.sy, tx: 1, ty: 0 } : null;
  }

  let dist = ((d % layout.totalLength) + layout.totalLength) % layout.totalLength;

  for (const seg of layout.segments) {
    if (dist <= seg.length || seg === layout.segments[layout.segments.length - 1]) {
      const t = seg.length > 0 ? Math.min(1, dist / seg.length) : 0;
      const x = seg.x1 + (seg.x2 - seg.x1) * t;
      const y = seg.y1 + (seg.y2 - seg.y1) * t;
      const tx = seg.x2 - seg.x1;
      const ty = seg.y2 - seg.y1;
      const len = Math.hypot(tx, ty) || 1;
      return { x, y, tx: tx / len, ty: ty / len };
    }
    dist -= seg.length;
  }

  const last = layout.points[layout.points.length - 1];
  return { x: last.sx, y: last.sy, tx: 1, ty: 0 };
}

export function findHoveredPoint(
  layout: RouteMapLayout,
  mx: number,
  my: number,
  padding = 6,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;

  for (const p of layout.points) {
    const d = Math.hypot(mx - p.sx, my - p.sy);
    const hit = p.radius + padding;
    if (d <= hit && d < bestDist) {
      bestDist = d;
      best = p.index;
    }
  }
  return best;
}
