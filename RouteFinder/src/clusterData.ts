import type { OreCluster } from "./types";

const CENTER_KEYS = ["center", "centre", "pos", "position"] as const;

function entryLabel(index: number): string {
  return index >= 0 ? `Entry ${index}` : "Cluster data";
}

function readCenter(
  item: Record<string, unknown>,
  index: number,
): [number, number, number] {
  let raw: unknown;
  for (const key of CENTER_KEYS) {
    if (key in item) {
      raw = item[key];
      break;
    }
  }
  if (raw === undefined) {
    throw new Error(`${entryLabel(index)}: missing "center" ([x, y, z]).`);
  }
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error(`${entryLabel(index)}: "center" must be an array of three numbers.`);
  }
  const nums = raw.map((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(
        `${entryLabel(index)}: center[${i}] must be a finite number.`,
      );
    }
    return v;
  });
  return [nums[0], nums[1], nums[2]];
}

function readBlockCount(item: Record<string, unknown>, index: number): number {
  const raw = item.block_count ?? item.blockCount ?? item.blocks;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(
      `${entryLabel(index)}: "block_count" must be a finite number.`,
    );
  }
  if (raw < 1) {
    throw new Error(
      `${entryLabel(index)}: "block_count" must be at least 1.`,
    );
  }
  return raw;
}

/** Validate and normalize cluster JSON (ignores legacy \`id\` fields). */
export function parseClusterData(raw: unknown): OreCluster[] {
  if (!Array.isArray(raw)) {
    throw new Error("Cluster file must be a JSON array of cluster objects.");
  }
  if (raw.length === 0) {
    throw new Error("Cluster file is empty — add at least one cluster.");
  }

  const clusters: OreCluster[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${entryLabel(i)}: expected an object.`);
    }
    clusters.push({
      center: readCenter(item as Record<string, unknown>, i),
      block_count: readBlockCount(item as Record<string, unknown>, i),
    });
  }
  return clusters;
}

export const CLUSTER_JSON_EXAMPLE = `[
  {
    "center": [313, 94, 297],
    "block_count": 253
  },
  {
    "center": [317, 124, 294],
    "block_count": 244
  }
]`;
