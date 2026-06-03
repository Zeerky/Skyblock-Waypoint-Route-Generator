import type { ProductFilters } from "../types";

interface RangeField {
  key: string;
  label: string;
}

interface Props {
  filters: ProductFilters;
  onChange: (f: ProductFilters) => void;
  rangeFields: RangeField[];
}

function RangeInputs({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="range-field">
      <span className="range-label">{label}</span>
      <div className="range-inputs">
        <input
          type="number"
          placeholder="min"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          aria-label={`${label} minimum`}
        />
        <input
          type="number"
          placeholder="max"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange, rangeFields }: Props) {
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });

  const setRange = (
    ranges: Record<string, { min: string; max: string }>,
    key: string,
    part: "min" | "max",
    value: string,
  ) => ({
    ...ranges,
    [key]: { ...ranges[key], [part]: value },
  });

  const reset = () => {
    const emptyRanges = Object.fromEntries(
      rangeFields.map((f) => [f.key, { min: "", max: "" }]),
    );
    onChange({
      productQuery: "",
      calculateTax: false,
      hideShard: false,
      hideEnchantment: false,
      ranges: emptyRanges,
    });
  };

  return (
    <section className="panel filter-panel">
      <div className="filter-row filter-row-main">
        <label className="field filter-search">
          <span className="field-label">product_id contains</span>
          <input
            type="search"
            value={filters.productQuery}
            onChange={(e) => set({ productQuery: e.target.value })}
            placeholder="e.g. ENCHANTED"
          />
        </label>

        <div className="filter-toggles">
          <label className="check">
            <input
              type="checkbox"
              checked={filters.calculateTax}
              onChange={(e) => set({ calculateTax: e.target.checked })}
            />
            <span>1.125% tax on profit</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.hideShard}
              onChange={(e) => set({ hideShard: e.target.checked })}
            />
            <span>Hide Shards</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.hideEnchantment}
              onChange={(e) => set({ hideEnchantment: e.target.checked })}
            />
            <span>Hide Enchants</span>
          </label>
        </div>

        <button type="button" className="btn" onClick={reset}>
          Reset filters
        </button>
      </div>

      <details className="filter-ranges-details">
        <summary>Numeric ranges</summary>
        <div className="filter-ranges-grid">
          {rangeFields.map((f) => (
            <RangeInputs
              key={f.key}
              label={f.label}
              min={filters.ranges[f.key]?.min ?? ""}
              max={filters.ranges[f.key]?.max ?? ""}
              onMin={(v) => set({ ranges: setRange(filters.ranges, f.key, "min", v) })}
              onMax={(v) => set({ ranges: setRange(filters.ranges, f.key, "max", v) })}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
