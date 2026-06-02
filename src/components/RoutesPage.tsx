import { formatRouteDate, type SavedRoute } from "../routeHistory";
import type { RouteResult } from "../types";
import { RouteExportPanel } from "./RouteExportPanel";
import { RouteMap } from "./RouteMap";
import { RouteStats } from "./RouteStats";

interface Props {
  routes: SavedRoute[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function RouteListRow({
  route,
  selected,
  onSelect,
  onRemove,
}: {
  route: SavedRoute;
  selected: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const { result } = route;
  const p = result.params;

  return (
    <div className={`route-row${selected ? " selected" : ""}`}>
      <button type="button" className="route-row-body" onClick={onSelect}>
        <div className="route-row-main">
          <span className="route-row-label">{route.label}</span>
          <span className="route-row-date">{formatRouteDate(route.createdAt)}</span>
        </div>
        <div className="route-row-meta">
          <span>≤{p.maxDistance} blk</span>
          <span>≥{p.minBlockCount} coal</span>
          <span>{result.elapsedMs.toFixed(0)} ms</span>
        </div>
      </button>
      <button
        type="button"
        className="route-row-delete"
        title="Remove route"
        onClick={onRemove}
        aria-label="Remove route"
      >
        ×
      </button>
    </div>
  );
}

function RouteDetail({
  route,
  onRemove,
}: {
  route: SavedRoute;
  onRemove: () => void;
}) {
  const result: RouteResult = route.result;

  return (
    <div className="route-detail">
      <div className="route-detail-header">
        <div>
          <h2>{route.label}</h2>
          <p className="route-detail-date">{formatRouteDate(route.createdAt)}</p>
        </div>
        <button type="button" className="btn btn-sm btn-cancel" onClick={onRemove}>
          Delete
        </button>
      </div>
      <RouteStats result={result} />
      <RouteMap result={result} />
      <RouteExportPanel result={result} />
    </div>
  );
}

export function RoutesPage({
  routes,
  selectedId,
  onSelect,
  onRemove,
  onClearAll,
}: Props) {
  const selected = routes.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="routes-page">
      <aside className="routes-list-panel panel">
        <div className="routes-list-header">
          <h2>Saved routes</h2>
          {routes.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
        {routes.length === 0 ? (
          <p className="routes-empty">
            Routes you generate on the Finder tab are saved here automatically.
          </p>
        ) : (
          <div className="routes-list">
            {routes.map((route) => (
              <RouteListRow
                key={route.id}
                route={route}
                selected={route.id === selectedId}
                onSelect={() => onSelect(route.id)}
                onRemove={(e) => {
                  e.stopPropagation();
                  onRemove(route.id);
                }}
              />
            ))}
          </div>
        )}
      </aside>

      <div className="routes-detail-column">
        {selected ? (
          <RouteDetail
            route={selected}
            onRemove={() => {
              onRemove(selected.id);
              onSelect(null);
            }}
          />
        ) : (
          <section className="panel routes-detail-empty">
            <p>
              {routes.length > 0
                ? "Select a route from the list to view its map and export options."
                : "No saved routes yet."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
