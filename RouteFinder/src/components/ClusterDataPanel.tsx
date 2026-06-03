import { CLUSTER_JSON_EXAMPLE } from "../clusterData";

interface Props {
  sourceLabel: string;
  isCustom: boolean;
  disabled: boolean;
  loadError: string | null;
  onUpload: (file: File) => void;
  onResetDefault: () => void;
}

export function ClusterDataPanel({
  sourceLabel,
  isCustom,
  disabled,
  loadError,
  onUpload,
  onResetDefault,
}: Props) {
  return (
    <section className="panel cluster-panel">
      <h2>Cluster data</h2>
      <p className="cluster-source">
        <span className="field-label">Source</span>
        <code className="cluster-source-name">{sourceLabel}</code>
      </p>

      <div className="cluster-actions">
        <label className={`btn btn-file${disabled ? " disabled" : ""}`}>
          Upload JSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        {isCustom && (
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={onResetDefault}
          >
            Use default
          </button>
        )}
      </div>

      {loadError && <p className="error-text cluster-error">{loadError}</p>}

      <details className="cluster-format">
        <summary>JSON file format</summary>
        <p>
          Upload a JSON <strong>array</strong> of cluster objects. Each object needs
          a block-space <code>center</code> and coal <code>block_count</code>.
          Extra fields (such as legacy <code>id</code>) are ignored.
        </p>
        <pre className="cluster-example">{CLUSTER_JSON_EXAMPLE}</pre>
        <p className="field-hint">
          Indices for start/end cluster refer to the list <em>after</em> filters
          (min coal, bounds, etc.) are applied.
        </p>
      </details>
    </section>
  );
}
