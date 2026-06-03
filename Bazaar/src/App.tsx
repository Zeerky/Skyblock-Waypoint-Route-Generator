import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyProductFilters,
  defaultProductColumns,
  fetchBazaarFromApi,
  parseBazaarPayload,
} from "./bazaarData";
import { DataSourcePanel } from "./components/DataSourcePanel";
import { DataTable } from "./components/DataTable";
import { FilterPanel } from "./components/FilterPanel";
import { defaultProductFilters } from "./filterDefaults";
import type { BazaarDataset } from "./types";
import { PREFERRED_PRODUCT_COLS, PRODUCT_NUMERIC_COLS } from "./types";

const DEFAULT_SNAPSHOT = "bazaar_raw.json";
const API_KEY_STORAGE = "bazaar-viewer-api-key";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState(DEFAULT_SNAPSHOT);
  const [customData, setCustomData] = useState(false);
  const [dataset, setDataset] = useState<BazaarDataset | null>(null);
  const [productFilters, setProductFilters] = useState(defaultProductFilters);
  const [apiKey, setApiKey] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(API_KEY_STORAGE) ?? "" : "",
  );
  const [refreshing, setRefreshing] = useState(false);

  const applyDataset = useCallback((data: BazaarDataset, label: string, custom: boolean) => {
    setDataset(data);
    setSourceLabel(label);
    setCustomData(custom);
    setLoadState("ready");
    setLoadError(null);
  }, []);

  const loadFromPayload = useCallback(
    (raw: unknown, label: string, custom: boolean, fetchedAt?: string) => {
      const elapsed =
        raw && typeof raw === "object" && "_elapsedSeconds" in (raw as object)
          ? Number((raw as Record<string, unknown>)._elapsedSeconds)
          : null;
      const parsed = parseBazaarPayload(raw, fetchedAt);
      if (elapsed !== null && Number.isFinite(elapsed)) {
        parsed.meta.elapsedSeconds = elapsed;
      }
      applyDataset(parsed, label, custom);
    },
    [applyDataset],
  );

  const loadDefault = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    const url = `${import.meta.env.BASE_URL}${DEFAULT_SNAPSHOT}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
      const raw: unknown = await res.json();
      loadFromPayload(raw, DEFAULT_SNAPSHOT, false);
    } catch (e) {
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : String(e));
      setDataset(null);
    }
  }, [loadFromPayload]);

  useEffect(() => {
    void loadDefault();
  }, [loadDefault]);

  useEffect(() => {
    if (apiKey) sessionStorage.setItem(API_KEY_STORAGE, apiKey);
    else sessionStorage.removeItem(API_KEY_STORAGE);
  }, [apiKey]);

  const handleUpload = async (file: File) => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const raw: unknown = JSON.parse(await file.text());
      loadFromPayload(raw, file.name, true);
    } catch (e) {
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRefresh = async () => {
    if (!apiKey.trim()) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const raw = await fetchBazaarFromApi(apiKey);
      loadFromPayload(raw, "Hypixel API (live)", true, new Date().toISOString());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!dataset) return [];
    return applyProductFilters(dataset.products, productFilters);
  }, [dataset, productFilters]);

  const productColumns = useMemo(
    () => (dataset ? defaultProductColumns(dataset.products) : []),
    [dataset],
  );

  const metaLine = dataset
    ? [
        dataset.meta.lastUpdatedIso && `Bazaar updated ${dataset.meta.lastUpdatedIso}`,
        dataset.meta.fetchedAtIso && `loaded ${new Date(dataset.meta.fetchedAtIso).toLocaleString()}`,
        dataset.meta.elapsedSeconds !== null &&
          `fetch ${dataset.meta.elapsedSeconds.toFixed(2)}s`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const productRangeFields = PRODUCT_NUMERIC_COLS.map((k) => ({ key: k, label: k }));

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Hypixel Bazaar Viewer</h1>
          <p className="subtitle">
            Browse SkyBlock bazaar products — filter, sort, and export.
          </p>
        </div>
        <div className="header-status">
          {loadState === "loading" && <span className="badge">Loading…</span>}
          {loadState === "ready" && dataset && (
            <span className="badge ready">
              {dataset.products.length.toLocaleString()} products
            </span>
          )}
          {loadState === "error" && <span className="badge error">No data</span>}
        </div>
      </header>

      <main className="main">
        <DataSourcePanel
          sourceLabel={sourceLabel}
          metaLine={metaLine}
          loading={loadState === "loading"}
          error={loadError}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          onRefresh={() => void handleRefresh()}
          onUpload={(f) => void handleUpload(f)}
          onResetDefault={() => void loadDefault()}
          isCustom={customData}
          refreshing={refreshing}
        />

        {dataset && loadState === "ready" && (
          <>
            <FilterPanel
              filters={productFilters}
              onChange={setProductFilters}
              rangeFields={productRangeFields}
            />

            <DataTable
              rows={filteredProducts}
              allColumns={productColumns}
              defaultVisible={PREFERRED_PRODUCT_COLS.filter((c) =>
                productColumns.includes(c),
              )}
              exportFilename="bazaar_products_filtered.csv"
            />
          </>
        )}

        {loadState === "error" && !dataset && (
          <section className="panel empty-state">
            <p>Load the default snapshot or upload a <code>bazaar_raw.json</code> file to begin.</p>
          </section>
        )}
      </main>
    </div>
  );
}
