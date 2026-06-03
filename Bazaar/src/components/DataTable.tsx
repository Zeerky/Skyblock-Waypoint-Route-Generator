import { useMemo, useState } from "react";
import { sortRows } from "../bazaarData";
import { downloadCsv } from "../exportDownload";
import { formatNumber } from "../format";
import { DEFAULT_PAGE_SIZE } from "../types";
import type { Row } from "../types";
import { ColumnPicker } from "./ColumnPicker";

function isNumericCol(rows: Row[], col: string): boolean {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const v = rows[i][col];
    if (typeof v === "number" && Number.isFinite(v)) return true;
  }
  return false;
}

interface Props {
  rows: Row[];
  allColumns: string[];
  defaultVisible: string[];
  exportFilename: string;
}

export function DataTable({ rows, allColumns, defaultVisible, exportFilename }: Props) {
  const [visibleCols, setVisibleCols] = useState(() =>
    defaultVisible.filter((c) => allColumns.includes(c)).length
      ? defaultVisible.filter((c) => allColumns.includes(c))
      : allColumns.slice(0, 10),
  );
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showColumns, setShowColumns] = useState(false);

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    return sortRows(rows, sortCol, sortAsc);
  }, [rows, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    for (const c of visibleCols) {
      if (isNumericCol(rows, c)) set.add(c);
    }
    return set;
  }, [rows, visibleCols]);

  const onHeaderClick = (col: string) => {
    if (sortCol === col) setSortAsc((a) => !a);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
    setPage(1);
  };

  return (
    <section className="table-section">
      <div className="table-toolbar">
        <span className="table-count">{rows.length.toLocaleString()} rows</span>
        <label className="page-size-label">
          Rows/page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[25, 50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="table-toolbar-right">
          <button
            type="button"
            className="btn btn-sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className="page-indicator">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShowColumns(true)}>
            Columns…
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(sorted, visibleCols, exportFilename)}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th key={col}>
                  <button
                    type="button"
                    className={`th-btn${sortCol === col ? (sortAsc ? " sorted-asc" : " sorted-desc") : ""}`}
                    onClick={() => onHeaderClick(col)}
                  >
                    {col}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="empty-cell">
                  No rows match your filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={start + i}>
                  {visibleCols.map((col) => {
                    const v = row[col];
                    const text =
                      numericCols.has(col) && (typeof v === "number" || v !== null)
                        ? formatNumber(v)
                        : v === null || v === undefined
                          ? ""
                          : String(v);
                    return (
                      <td key={col} className={col === "product_id" ? "cell-id" : undefined}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showColumns && (
        <ColumnPicker
          allColumns={allColumns}
          visible={visibleCols}
          onChange={setVisibleCols}
          onClose={() => setShowColumns(false)}
        />
      )}
    </section>
  );
}
