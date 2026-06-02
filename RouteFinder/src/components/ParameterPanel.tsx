import type { RouteParams } from "../types";

interface Props {
  params: RouteParams;
  onChange: (params: RouteParams) => void;
  disabled: boolean;
}

function NumField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function OptionalNumField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      <input
        type="number"
        placeholder="No limit"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </label>
  );
}

export function ParameterPanel({ params, onChange, disabled }: Props) {
  const set = <K extends keyof RouteParams>(key: K, value: RouteParams[K]) =>
    onChange({ ...params, [key]: value });

  const setBound = (
    key: keyof RouteParams["bounds"],
    value: number | null,
  ) => onChange({ ...params, bounds: { ...params.bounds, [key]: value } });

  return (
    <section className="panel params-panel">
      <h2>Route parameters</h2>

      <div className="field-group">
        <h3>Cluster filters</h3>
        <NumField
          label="Min coal per cluster"
          hint="Only visit clusters with at least this many coal blocks"
          value={params.minBlockCount}
          onChange={(v) => set("minBlockCount", v)}
          min={1}
          disabled={disabled}
        />
        <OptionalNumField
          label="Max coal per cluster"
          hint="Optional cap on cluster size"
          value={params.maxBlockCount}
          onChange={(v) => set("maxBlockCount", v)}
          disabled={disabled}
        />
      </div>

      <div className="field-group">
        <h3>Path constraints</h3>
        <NumField
          label="Max distance (blocks)"
          hint="Maximum 3D distance between consecutive waypoints"
          value={params.maxDistance}
          onChange={(v) => set("maxDistance", v)}
          min={1}
          step={0.5}
          disabled={disabled}
        />
        <NumField
          label="Min waypoints"
          value={params.minWaypoints}
          onChange={(v) => set("minWaypoints", v)}
          min={1}
          disabled={disabled}
        />
        <NumField
          label="Max waypoints"
          value={params.maxWaypoints}
          onChange={(v) => set("maxWaypoints", v)}
          min={1}
          disabled={disabled}
        />
      </div>

      <div className="field-group">
        <h3>Optimizer</h3>
        <NumField
          label="Start candidates"
          hint="More = better routes but slower (25 is a good default)"
          value={params.startCandidates}
          onChange={(v) => set("startCandidates", v)}
          min={1}
          max={500}
          disabled={disabled}
        />
        <NumField
          label="Distance weight"
          hint="Prefer closer neighbors when values are similar (0–1)"
          value={params.distanceWeight}
          onChange={(v) => set("distanceWeight", v)}
          min={0}
          max={2}
          step={0.05}
          disabled={disabled}
        />
        <OptionalNumField
          label="Start cluster ID"
          hint="Force route to begin at this cluster"
          value={params.startClusterId}
          onChange={(v) => set("startClusterId", v)}
          disabled={disabled}
        />
        <OptionalNumField
          label="End cluster ID"
          hint="Try to reach this cluster at the end"
          value={params.endClusterId}
          onChange={(v) => set("endClusterId", v)}
          disabled={disabled}
        />
      </div>

      <details className="bounds-details">
        <summary>Region bounds (optional)</summary>
        <div className="bounds-grid">
          {(
            [
              ["minX", "Min X"],
              ["maxX", "Max X"],
              ["minY", "Min Y"],
              ["maxY", "Max Y"],
              ["minZ", "Min Z"],
              ["maxZ", "Max Z"],
            ] as const
          ).map(([key, label]) => (
            <OptionalNumField
              key={key}
              label={label}
              value={params.bounds[key]}
              onChange={(v) => setBound(key, v)}
              disabled={disabled}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
