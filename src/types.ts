export interface OreCluster {
  id: number;
  center: [number, number, number];
  block_count: number;
}

export interface RouteParams {
  minBlockCount: number;
  maxBlockCount: number | null;
  maxDistance: number;
  minWaypoints: number;
  maxWaypoints: number;
  /** Try this many high-value clusters as route start points */
  startCandidates: number;
  /** Greedy neighbor pick: weight for block count vs distance slack */
  distanceWeight: number;
  startClusterId: number | null;
  endClusterId: number | null;
  /** Optional bounding box filter (inclusive); null = no limit */
  bounds: {
    minX: number | null;
    maxX: number | null;
    minY: number | null;
    maxY: number | null;
    minZ: number | null;
    maxZ: number | null;
  };
}

export interface RouteResult {
  waypoints: OreCluster[];
  totalCoal: number;
  totalDistance: number;
  params: RouteParams;
  filteredClusterCount: number;
  elapsedMs: number;
}

export const DEFAULT_PARAMS: RouteParams = {
  minBlockCount: 35,
  maxBlockCount: null,
  maxDistance: 20,
  minWaypoints: 10,
  maxWaypoints: 200,
  startCandidates: 25,
  distanceWeight: 0.15,
  startClusterId: null,
  endClusterId: null,
  bounds: {
    minX: null,
    maxX: null,
    minY: null,
    maxY: null,
    minZ: null,
    maxZ: null,
  },
};
