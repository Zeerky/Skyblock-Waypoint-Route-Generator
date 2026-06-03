import { toIso8601 } from "./format";
import type { BazaarDataset, BazaarMeta, Row } from "./types";
import { BAZAAR_TAX } from "./types";

const KNOWN_PRODUCT_ORDER = [
  "product_id",
  "productId",
  "sellPrice",
  "sellVolume",
  "sellMovingWeek",
  "sellOrders",
  "buyPrice",
  "buyVolume",
  "buyMovingWeek",
  "buyOrders",
  "midPrice",
  "profit",
];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeProduct(productId: string, quick: Record<string, unknown>): Row {
  const row: Row = { product_id: productId };
  for (const [k, v] of Object.entries(quick)) {
    const n = num(v);
    row[k] = n !== null ? n : v === null || v === undefined ? null : String(v);
  }
  const buy = num(row.buyPrice);
  const sell = num(row.sellPrice);
  if (buy !== null && sell !== null) {
    row.midPrice = (buy + sell) / 2;
  }
  if (buy !== null && sell !== null) {
    row.profit = buy - sell;
  } else {
    row.profit = null;
  }
  return row;
}

export function parseBazaarPayload(raw: unknown, fetchedAtIso?: string): BazaarDataset {
  if (!raw || typeof raw !== "object") {
    throw new Error("Bazaar data must be a JSON object.");
  }
  const payload = raw as Record<string, unknown>;
  if (!payload.success) {
    throw new Error("API response has success=false.");
  }
  const productsObj = payload.products;
  if (!productsObj || typeof productsObj !== "object" || Array.isArray(productsObj)) {
    throw new Error('Missing "products" object in bazaar data.');
  }

  const products: Row[] = [];
  for (const [pid, p] of Object.entries(productsObj as Record<string, Record<string, unknown>>)) {
    const qs = p.quick_status;
    if (!qs || typeof qs !== "object") continue;
    products.push(normalizeProduct(pid, qs as Record<string, unknown>));
  }

  const lastMs = num(payload.lastUpdated);
  const meta: BazaarMeta = {
    success: true,
    lastUpdatedMs: lastMs,
    lastUpdatedIso: lastMs !== null ? toIso8601(lastMs) : "",
    fetchedAtIso: fetchedAtIso ?? new Date().toISOString(),
    elapsedSeconds: null,
  };

  return { meta, products };
}

export function orderColumns(rows: Row[], preferred: string[]): string[] {
  if (rows.length === 0) return preferred;
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) keys.add(k);
  }
  const left = preferred.filter((k) => keys.has(k));
  const rest = [...keys].filter((k) => !left.includes(k)).sort();
  return [...left, ...rest];
}

export function defaultProductColumns(rows: Row[]): string[] {
  return orderColumns(rows, KNOWN_PRODUCT_ORDER);
}

export function applyProductFilters(
  rows: Row[],
  filters: import("./types").ProductFilters,
): Row[] {
  let df = rows.map((r) => ({ ...r }));

  if (filters.calculateTax) {
    df = df.map((r) => {
      const buy = num(r.buyPrice);
      const sell = num(r.sellPrice);
      if (buy !== null && sell !== null) {
        return { ...r, profit: (buy - sell) * (1 - BAZAAR_TAX) };
      }
      return r;
    });
  }

  if (filters.hideShard) {
    df = df.filter((r) => !String(r.product_id ?? "").startsWith("SHARD_"));
  }
  if (filters.hideEnchantment) {
    df = df.filter((r) => !String(r.product_id ?? "").startsWith("ENCHANTMENT_"));
  }

  const q = filters.productQuery.trim().toLowerCase();
  if (q) {
    df = df.filter((r) =>
      String(r.product_id ?? "").toLowerCase().includes(q),
    );
  }

  for (const [col, { min, max }] of Object.entries(filters.ranges)) {
    const vmin = min.trim() === "" ? null : Number(min);
    const vmax = max.trim() === "" ? null : Number(max);
    if (vmin !== null && Number.isFinite(vmin)) {
      df = df.filter((r) => {
        const v = num(r[col]);
        return v !== null && v >= vmin;
      });
    }
    if (vmax !== null && Number.isFinite(vmax)) {
      df = df.filter((r) => {
        const v = num(r[col]);
        return v !== null && v <= vmax;
      });
    }
  }

  return df;
}

export function sortRows(rows: Row[], col: string, asc: boolean): Row[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    const an = num(av);
    const bn = num(bv);
    if (an !== null && bn !== null) {
      return asc ? an - bn : bn - an;
    }
    const as = String(av ?? "");
    const bs = String(bv ?? "");
    return asc ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return copy;
}

export function exportCsv(rows: Row[], columns: string[]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return "";
          return escape(String(v));
        })
        .join(","),
    );
  }
  return lines.join("\n");
}

export const BAZAAR_API_URL = "https://api.hypixel.net/v2/skyblock/bazaar";

export async function fetchBazaarFromApi(apiKey: string): Promise<unknown> {
  const t0 = performance.now();
  const res = await fetch(BAZAAR_API_URL, {
    headers: { "API-Key": apiKey.trim() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hypixel API HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const data: unknown = await res.json();
  const elapsed = (performance.now() - t0) / 1000;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    (data as Record<string, unknown>)._elapsedSeconds = elapsed;
  }
  return data;
}
