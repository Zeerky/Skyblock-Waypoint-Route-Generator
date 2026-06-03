interface Props {
  sourceLabel: string;
  metaLine: string;
  loading: boolean;
  error: string | null;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  onRefresh: () => void;
  onUpload: (file: File) => void;
  onResetDefault: () => void;
  isCustom: boolean;
  refreshing: boolean;
}

const HYPIXEL_DASHBOARD_URL = "https://developer.hypixel.net/dashboard";

export function DataSourcePanel({
  sourceLabel,
  metaLine,
  loading,
  error,
  apiKey,
  onApiKeyChange,
  onRefresh,
  onUpload,
  onResetDefault,
  isCustom,
  refreshing,
}: Props) {
  return (
    <section className="panel data-panel">
      <h2>Data source</h2>
      <p className="data-source-line">
        <span className="field-label">Loaded</span>
        <code>{sourceLabel}</code>
      </p>
      {metaLine && <p className="data-meta">{metaLine}</p>}

      <div className="data-actions">
        <label className="btn btn-file">
          Upload JSON
          <input
            type="file"
            accept=".json,application/json"
            hidden
            disabled={loading || refreshing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {isCustom && (
          <button
            type="button"
            className="btn"
            disabled={loading || refreshing}
            onClick={onResetDefault}
          >
            Use default snapshot
          </button>
        )}
      </div>

      <div className="api-refresh">
        <label className="field">
          <span className="field-label">Hypixel API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Paste your development key"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={!apiKey.trim() || loading || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Fetching…" : "Refresh from API"}
        </button>
      </div>
      <p className="field-hint api-hint">
        Create a development API key on the{" "}
        <a href={HYPIXEL_DASHBOARD_URL} target="_blank" rel="noreferrer">
          Hypixel Developer Dashboard
        </a>
        . Keys are stored in this browser only and used when you refresh bazaar data.
      </p>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
