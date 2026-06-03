import { ThrottledLogger } from "./logger";
import type { SearchProgress } from "./searchTypes";
import type { OreCluster, RouteParams, RouteResult } from "./types";

const MAX_NEIGHBORS_PER_NODE = 128;
const TWO_OPT_MAX_PASSES = 3;

export interface FindCallbacks {
  onProgress?: (p: SearchProgress) => void;
  onLog?: (level: "info" | "debug" | "success" | "warn", message: string, detail?: string, force?: boolean) => void;
  shouldCancel?: () => boolean;
}

export function distance3d(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function cellKey(cx: number, cy: number, cz: number): string {
  return `${cx}\0${cy}\0${cz}`;
}

function inBounds(
  c: OreCluster,
  bounds: RouteParams["bounds"],
): boolean {
  const [x, y, z] = c.center;
  if (bounds.minX !== null && x < bounds.minX) return false;
  if (bounds.maxX !== null && x > bounds.maxX) return false;
  if (bounds.minY !== null && y < bounds.minY) return false;
  if (bounds.maxY !== null && y > bounds.maxY) return false;
  if (bounds.minZ !== null && z < bounds.minZ) return false;
  if (bounds.maxZ !== null && z > bounds.maxZ) return false;
  return true;
}

export function filterClusters(
  clusters: OreCluster[],
  params: RouteParams,
): OreCluster[] {
  return clusters.filter((c) => {
    if (c.block_count < params.minBlockCount) return false;
    if (params.maxBlockCount !== null && c.block_count > params.maxBlockCount)
      return false;
    return inBounds(c, params.bounds);
  });
}

type NeighborIndex = Int32Array[];

function hasEdge(neighbors: NeighborIndex, a: number, b: number): boolean {
  const list = neighbors[a];
  for (let k = 0; k < list.length; k++) {
    if (list[k] === b) return true;
  }
  return false;
}

function buildSpatialNeighbors(
  clusters: OreCluster[],
  maxDistance: number,
  onProgress?: (built: number, total: number) => void,
  shouldCancel?: () => boolean,
): NeighborIndex {
  const cell = maxDistance;
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < clusters.length; i++) {
    const [x, y, z] = clusters[i].center;
    const key = cellKey(
      Math.floor(x / cell),
      Math.floor(y / cell),
      Math.floor(z / cell),
    );
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(i);
  }

  const neighbors: number[][] = clusters.map(() => []);
  const maxDistSq = maxDistance * maxDistance;
  const total = clusters.length;
  const reportEvery = Math.max(500, Math.floor(total / 40));

  for (let i = 0; i < total; i++) {
    if (shouldCancel?.()) throw new Error("Search cancelled");
    if (i > 0 && i % reportEvery === 0) {
      onProgress?.(i, total);
    }

    const [x, y, z] = clusters[i].center;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    const seen = new Set<number>();

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = buckets.get(cellKey(cx + dx, cy + dy, cz + dz));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const j = bucket[b];
            if (j === i || seen.has(j)) continue;
            const [jx, jy, jz] = clusters[j].center;
            const ddx = x - jx;
            const ddy = y - jy;
            const ddz = z - jz;
            if (ddx * ddx + ddy * ddy + ddz * ddz <= maxDistSq) {
              seen.add(j);
              neighbors[i].push(j);
            }
          }
        }
      }
    }

    if (neighbors[i].length > MAX_NEIGHBORS_PER_NODE) {
      neighbors[i].sort(
        (a, b) => clusters[b].block_count - clusters[a].block_count,
      );
      neighbors[i].length = MAX_NEIGHBORS_PER_NODE;
    }
  }

  onProgress?.(total, total);
  return neighbors.map((n) => Int32Array.from(n));
}

function pathCoal(clusters: OreCluster[], path: number[]): number {
  let coal = 0;
  for (const i of path) coal += clusters[i].block_count;
  return coal;
}

function greedyExtend(
  clusters: OreCluster[],
  neighbors: NeighborIndex,
  startIdx: number,
  params: RouteParams,
): number[] {
  const path: number[] = [startIdx];
  const visited = new Uint8Array(clusters.length);
  visited[startIdx] = 1;
  const maxDist = params.maxDistance;

  while (path.length < params.maxWaypoints) {
    const current = path[path.length - 1];
    const nbrs = neighbors[current];
    let best = -1;
    let bestScore = -Infinity;
    const [cx, cy, cz] = clusters[current].center;

    for (let k = 0; k < nbrs.length; k++) {
      const j = nbrs[k];
      if (visited[j]) continue;
      const [jx, jy, jz] = clusters[j].center;
      const ddx = cx - jx;
      const ddy = cy - jy;
      const ddz = cz - jz;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      const slack = maxDist - dist;
      const score =
        clusters[j].block_count + params.distanceWeight * slack;
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }

    if (best < 0) break;
    path.push(best);
    visited[best] = 1;
  }

  return path;
}

function pathToClusters(
  clusters: OreCluster[],
  path: number[],
): OreCluster[] {
  return path.map((i) => clusters[i]);
}

function totalRouteDistance(waypoints: OreCluster[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += distance3d(waypoints[i - 1].center, waypoints[i].center);
  }
  return total;
}

function twoOptImprove(
  clusters: OreCluster[],
  neighbors: NeighborIndex,
  path: number[],
  params: RouteParams,
): number[] {
  if (path.length < 4) return path;

  let best = path.slice();
  let passes = 0;

  while (passes < TWO_OPT_MAX_PASSES) {
    let improved = false;
    passes++;

    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const a = best[i - 1];
        const b = best[i];
        const c = best[j];
        const d = j + 1 < best.length ? best[j + 1] : -1;

        if (d >= 0 && hasEdge(neighbors, a, c) && hasEdge(neighbors, b, d)) {
          const segment = best.slice(i, j + 1).reverse();
          const candidate = [
            ...best.slice(0, i),
            ...segment,
            ...best.slice(j + 1),
          ];
          if (candidate.length > params.maxWaypoints) continue;

          if (pathCoal(clusters, candidate) >= pathCoal(clusters, best)) {
            best = candidate;
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }

  return best;
}

function buildAnchoredPath(
  clusters: OreCluster[],
  neighbors: NeighborIndex,
  params: RouteParams,
  startIdx: number,
  endIdx: number | null,
): number[] {
  if (endIdx === null || endIdx === startIdx) {
    return greedyExtend(clusters, neighbors, startIdx, params);
  }

  const forward = greedyExtend(clusters, neighbors, startIdx, params);
  const visited = new Uint8Array(clusters.length);
  for (const i of forward) visited[i] = 1;

  if (visited[endIdx]) {
    const endPos = forward.indexOf(endIdx);
    return forward.slice(0, endPos + 1);
  }

  const backward: number[] = [endIdx];
  visited[endIdx] = 1;
  const tail = clusters[forward[forward.length - 1]];

  while (backward.length + forward.length <= params.maxWaypoints) {
    const current = backward[backward.length - 1];
    const nbrs = neighbors[current];
    let best = -1;
    let bestScore = -Infinity;

    for (let k = 0; k < nbrs.length; k++) {
      const j = nbrs[k];
      if (visited[j]) continue;
      const distToTail = distance3d(
        clusters[j].center,
        tail.center,
      );
      const score =
        clusters[j].block_count -
        params.distanceWeight * Math.max(0, distToTail - params.maxDistance);
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }
    if (best < 0) break;
    backward.push(best);
    visited[best] = 1;
  }

  backward.reverse();
  const bridgeEnd = backward[backward.length - 1];
  const bridgeStart = forward[forward.length - 1];
  if (
    distance3d(clusters[bridgeEnd].center, clusters[bridgeStart].center) >
    params.maxDistance
  ) {
    return forward;
  }

  return [...backward.slice(0, -1), ...forward];
}

function trimPath(
  clusters: OreCluster[],
  path: number[],
  maxLen: number,
): number[] {
  if (path.length <= maxLen) return path;
  const scores = path.map((i) => clusters[i].block_count);
  const keep = new Set<number>();
  keep.add(0);
  keep.add(path.length - 1);
  const indices = scores
    .map((v, i) => ({ i, v }))
    .sort((a, b) => b.v - a.v);
  for (const { i } of indices) {
    if (keep.size >= maxLen) break;
    keep.add(i);
  }
  return [...keep].sort((a, b) => a - b).map((i) => path[i]);
}

function tryGrowPath(
  clusters: OreCluster[],
  neighbors: NeighborIndex,
  path: number[],
  params: RouteParams,
): number[] {
  if (path.length === 0) return path;
  const visited = new Uint8Array(clusters.length);
  for (const i of path) visited[i] = 1;

  let result = path.slice();

  while (result.length < params.minWaypoints && result.length < params.maxWaypoints) {
    const head = result[0];
    const tail = result[result.length - 1];
    let bestHead = -1;
    let bestTail = -1;
    let bestHeadScore = -Infinity;
    let bestTailScore = -Infinity;

    const headN = neighbors[head];
    for (let k = 0; k < headN.length; k++) {
      const j = headN[k];
      if (visited[j]) continue;
      if (clusters[j].block_count > bestHeadScore) {
        bestHeadScore = clusters[j].block_count;
        bestHead = j;
      }
    }
    const tailN = neighbors[tail];
    for (let k = 0; k < tailN.length; k++) {
      const j = tailN[k];
      if (visited[j]) continue;
      if (clusters[j].block_count > bestTailScore) {
        bestTailScore = clusters[j].block_count;
        bestTail = j;
      }
    }

    if (bestHead < 0 && bestTail < 0) break;
    if (bestTailScore >= bestHeadScore && bestTail >= 0) {
      result.push(bestTail);
      visited[bestTail] = 1;
    } else if (bestHead >= 0) {
      result.unshift(bestHead);
      visited[bestHead] = 1;
    } else break;
  }

  return result;
}

function phasePercent(
  phase: SearchProgress["phase"],
  sub = 0,
): number {
  const bases: Record<SearchProgress["phase"], number> = {
    filter: 0,
    neighbors: 15,
    search: 25,
    finalize: 95,
    done: 100,
    cancelled: 100,
  };
  const spans: Record<SearchProgress["phase"], number> = {
    filter: 15,
    neighbors: 10,
    search: 70,
    finalize: 5,
    done: 0,
    cancelled: 0,
  };
  return Math.min(100, bases[phase] + sub * spans[phase]);
}

export function findOptimalRoute(
  allClusters: OreCluster[],
  params: RouteParams,
  callbacks: FindCallbacks = {},
): RouteResult {
  const t0 = performance.now();
  const throttledLog = callbacks.onLog
    ? new ThrottledLogger(300, (e) =>
        callbacks.onLog!(
          e.level as "info" | "debug" | "success" | "warn",
          e.message,
          e.detail,
        ),
      )
    : null;

  const emit = (progress: SearchProgress) => {
    progress.elapsedMs = performance.now() - t0;
    callbacks.onProgress?.(progress);
  };

  const checkCancel = () => {
    if (callbacks.shouldCancel?.()) {
      throw new Error("Search cancelled");
    }
  };

  emit({
    phase: "filter",
    percent: phasePercent("filter", 0),
    message: "Filtering clusters…",
  });
  throttledLog?.log("info", "Filtering clusters by block count and bounds", undefined, true);

  checkCancel();
  const clusters = filterClusters(allClusters, params);

  throttledLog?.log(
    "success",
    `Kept ${clusters.length.toLocaleString()} of ${allClusters.length.toLocaleString()} clusters`,
    `min coal ≥ ${params.minBlockCount}`,
    true,
  );

  emit({
    phase: "filter",
    percent: phasePercent("filter", 1),
    message: `${clusters.length.toLocaleString()} clusters match filters`,
  });

  if (clusters.length === 0) {
    return {
      waypoints: [],
      totalCoal: 0,
      totalDistance: 0,
      params,
      filteredClusterCount: 0,
      elapsedMs: performance.now() - t0,
    };
  }

  emit({
    phase: "neighbors",
    percent: phasePercent("neighbors", 0),
    message: "Building neighbor graph…",
  });
  throttledLog?.log(
    "info",
    "Building spatial neighbor index",
    `max hop ${params.maxDistance} blocks, cap ${MAX_NEIGHBORS_PER_NODE} neighbors/node`,
    true,
  );

  checkCancel();
  let avgNeighbors = 0;
  const neighbors = buildSpatialNeighbors(
    clusters,
    params.maxDistance,
    (built, total) => {
      emit({
        phase: "neighbors",
        percent: phasePercent("neighbors", built / total),
        message: `Indexing neighbors… ${built.toLocaleString()} / ${total.toLocaleString()}`,
        current: built,
        total,
      });
    },
    () => callbacks.shouldCancel?.() ?? false,
  );

  for (let i = 0; i < neighbors.length; i++) avgNeighbors += neighbors[i].length;
  avgNeighbors /= neighbors.length;

  throttledLog?.log(
    "success",
    "Neighbor graph ready",
    `avg ${avgNeighbors.toFixed(1)} neighbors per cluster`,
    true,
  );

  const startSet = new Set<number>();
  const startIndices: number[] = [];
  if (params.startClusterIndex !== null) {
    const idx = params.startClusterIndex;
    if (idx >= 0 && idx < clusters.length) {
      startIndices.push(idx);
      startSet.add(idx);
    }
  }

  const sortedByValue = clusters
    .map((c, i) => ({ i, v: c.block_count }))
    .sort((a, b) => b.v - a.v);

  for (const { i } of sortedByValue) {
    if (startIndices.length >= params.startCandidates) break;
    if (!startSet.has(i)) {
      startIndices.push(i);
      startSet.add(i);
    }
  }

  const endIdx =
    params.endClusterIndex !== null &&
    params.endClusterIndex >= 0 &&
    params.endClusterIndex < clusters.length
      ? params.endClusterIndex
      : null;

  const totalStarts = startIndices.length;
  emit({
    phase: "search",
    percent: phasePercent("search", 0),
    message: `Searching ${totalStarts} start points…`,
    current: 0,
    total: totalStarts,
  });
  throttledLog?.log(
    "info",
    `Trying ${totalStarts} route starts`,
    `max ${params.maxWaypoints} waypoints per route`,
    true,
  );

  let bestPath: number[] = [];
  let bestCoal = -1;
  const progressStride = Math.max(1, Math.floor(totalStarts / 25));

  for (let s = 0; s < startIndices.length; s++) {
    checkCancel();
    const startIdx = startIndices[s];

    let path = buildAnchoredPath(
      clusters,
      neighbors,
      params,
      startIdx,
      endIdx,
    );

    if (path.length >= 4 && params.maxWaypoints > 3) {
      path = twoOptImprove(clusters, neighbors, path, params);
    }

    if (path.length < params.minWaypoints) {
      const grown = tryGrowPath(clusters, neighbors, path, params);
      if (grown.length > path.length) path = grown;
    }

    if (path.length > params.maxWaypoints) {
      path = trimPath(clusters, path, params.maxWaypoints);
    }

    const coal = path.reduce((sum, i) => sum + clusters[i].block_count, 0);
    const improved = coal > bestCoal;
    if (improved && path.length >= Math.min(params.minWaypoints, 1)) {
      bestCoal = coal;
      bestPath = path;
      throttledLog?.log(
        "debug",
        `New best: ${coal} coal, ${path.length} stops`,
        `start @ ${clusters[startIdx].center.join(", ")}`,
      );
    }

    if (s % progressStride === 0 || s === totalStarts - 1) {
      emit({
        phase: "search",
        percent: phasePercent("search", (s + 1) / totalStarts),
        message: `Start ${s + 1} / ${totalStarts}${improved ? " — new best" : ""}`,
        current: s + 1,
        total: totalStarts,
        bestCoal: bestCoal > 0 ? bestCoal : undefined,
        bestWaypoints: bestPath.length > 0 ? bestPath.length : undefined,
      });
    }
  }

  emit({
    phase: "finalize",
    percent: phasePercent("finalize", 0),
    message: "Finalizing route…",
  });

  if (bestPath.length < params.minWaypoints && bestPath.length > 0) {
    bestPath = tryGrowPath(clusters, neighbors, bestPath, params);
  }

  const waypoints = pathToClusters(clusters, bestPath);
  const result: RouteResult = {
    waypoints,
    totalCoal: waypoints.reduce((sum, w) => sum + w.block_count, 0),
    totalDistance: totalRouteDistance(waypoints),
    params,
    filteredClusterCount: clusters.length,
    elapsedMs: performance.now() - t0,
  };

  throttledLog?.flush();
  throttledLog?.log(
    "success",
    `Done in ${result.elapsedMs.toFixed(0)} ms`,
    `${result.waypoints.length} waypoints, ${result.totalCoal} coal`,
    true,
  );

  emit({
    phase: "done",
    percent: 100,
    message: result.waypoints.length
      ? `Route found — ${result.totalCoal} coal`
      : "No route found",
    bestCoal: result.totalCoal,
    bestWaypoints: result.waypoints.length,
  });

  return result;
}

export function formatRouteExport(result: RouteResult): string {
  return result.waypoints
    .map((w) => `${w.center[0]} ${w.center[1]} ${w.center[2]}`)
    .join("\n");
}
