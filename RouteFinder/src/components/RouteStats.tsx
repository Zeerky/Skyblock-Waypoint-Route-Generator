import type { RouteResult } from "../types";

interface Props {
  result: RouteResult | null;
}

export function RouteStats({ result }: Props) {
  if (!result) {
    return (
      <section className="panel stats-panel empty">
        <p>Configure parameters and run the finder to see route stats.</p>
      </section>
    );
  }

  const avgHop =
    result.waypoints.length > 1
      ? result.totalDistance / (result.waypoints.length - 1)
      : 0;
  const avgCoal =
    result.waypoints.length > 0
      ? result.totalCoal / result.waypoints.length
      : 0;

  return (
    <section className="panel stats-panel">
      <h2>Route summary</h2>
      <dl className="stats-grid">
        <div>
          <dt>Total coal</dt>
          <dd>{result.totalCoal.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Waypoints</dt>
          <dd>{result.waypoints.length}</dd>
        </div>
        <div>
          <dt>Path distance</dt>
          <dd>{result.totalDistance.toFixed(2)} blocks</dd>
        </div>
        <div>
          <dt>Avg hop distance</dt>
          <dd>{avgHop.toFixed(2)} blocks</dd>
        </div>
        <div>
          <dt>Avg coal / stop</dt>
          <dd>{avgCoal.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Clusters considered</dt>
          <dd>{result.filteredClusterCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Solve time</dt>
          <dd>{result.elapsedMs.toFixed(0)} ms</dd>
        </div>
      </dl>
    </section>
  );
}
