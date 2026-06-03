/**
 * One-off: remove "id" from each object in ore_clusters.json.
 * Usage: node scripts/strip-cluster-ids.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "ore_clusters.json");

const raw = readFileSync(path, "utf8");
const data = JSON.parse(raw);
if (!Array.isArray(data)) throw new Error("Expected array");

let stripped = 0;
for (const entry of data) {
  if (entry && typeof entry === "object" && "id" in entry) {
    delete entry.id;
    stripped++;
  }
}

writeFileSync(path, JSON.stringify(data, null, 4) + "\n", "utf8");
console.log(`Wrote ${data.length} clusters (${stripped} ids removed).`);
