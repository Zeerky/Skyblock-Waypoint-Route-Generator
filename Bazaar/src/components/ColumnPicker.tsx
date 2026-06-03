interface Props {
  allColumns: string[];
  visible: string[];
  onChange: (cols: string[]) => void;
  onClose: () => void;
}

const COMMON = new Set([
  "product_id",
  "side",
  "rank",
  "pricePerUnit",
  "amount",
  "orders",
  "sellPrice",
  "buyPrice",
  "midPrice",
  "sellOrders",
  "buyOrders",
  "sellVolume",
  "buyVolume",
  "profit",
]);

export function ColumnPicker({ allColumns, visible, onChange, onClose }: Props) {
  const toggle = (col: string) => {
    const set = new Set(visible);
    if (set.has(col)) {
      if (set.size <= 1) return;
      set.delete(col);
    } else {
      set.add(col);
    }
    const next = allColumns.filter((c) => set.has(c));
    onChange(next.length ? next : visible);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal column-modal"
        role="dialog"
        aria-labelledby="col-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h3 id="col-picker-title">Visible columns</h3>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="column-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const common = allColumns.filter((c) => COMMON.has(c));
              onChange(common.length ? common : allColumns.slice(0, 8));
            }}
          >
            Common
          </button>
          <button type="button" className="btn btn-sm" onClick={() => onChange([...allColumns])}>
            All
          </button>
        </div>
        <ul className="column-list">
          {allColumns.map((col) => (
            <li key={col}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={visible.includes(col)}
                  onChange={() => toggle(col)}
                />
                <span>{col}</span>
              </label>
            </li>
          ))}
        </ul>
        <footer className="modal-footer">
          <button type="button" className="btn primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
