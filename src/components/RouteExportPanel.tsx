import { useState } from "react";
import { copyRouteToClipboard, downloadRoute } from "../exportRoute";
import type { RouteResult } from "../types";

interface Props {
  result: RouteResult;
}

export function RouteExportPanel({ result }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyRouteToClipboard(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="panel export-panel">
      <h2>Export</h2>
      <p className="export-hint">
        One <code>x y z</code> waypoint per line.
      </p>
      <div className="export-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => downloadRoute(result)}
        >
          Download .txt
        </button>
        <button type="button" className="btn" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
      </div>
      <pre className="export-preview">
        {result.waypoints
          .slice(0, 8)
          .map((w) => `${w.center[0]} ${w.center[1]} ${w.center[2]}`)
          .join("\n")}
        {result.waypoints.length > 8 ? "\n…" : ""}
      </pre>
    </section>
  );
}
