export function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  let s = num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s;
}

export function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function toIso8601(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}
