/**
 * Copy default bazaar snapshot into public/ for Vite if missing.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "bazaar_out", "bazaar_raw.json");
const destDir = join(root, "public");
const dest = join(destDir, "bazaar_raw.json");

if (!existsSync(src)) {
  console.warn("ensure-data: bazaar_out/bazaar_raw.json not found — app will need an upload.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
if (!existsSync(dest)) {
  copyFileSync(src, dest);
  console.log("ensure-data: copied bazaar_raw.json → public/");
}
