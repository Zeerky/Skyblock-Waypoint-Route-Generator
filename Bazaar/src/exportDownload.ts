import { exportCsv } from "./bazaarData";
import type { Row } from "./types";

export function downloadCsv(rows: Row[], columns: string[], filename: string): void {
  const blob = new Blob([exportCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
