#!/usr/bin/env python3
"""
Bazaar CSV Viewer (dark, minimal, modern)

A desktop GUI to explore the CSV dump produced by `dump_bazaar_to_csv.py`.
- Tab 1: Products (quick_status)
- Tab 2: Offers (buy/sell price ladders)
- Powerful filtering (substring, numeric ranges, side, etc.)
- Column visibility toggles
- Click-to-sort by any column (ascending/descending)
- Pagination for large datasets
- Export current filtered view to CSV (raw, not pretty-formatted)
- Dark theme using ttkbootstrap if available (falls back to a custom ttk dark style)

How to run:
  Just run this file (no args). It will look for ./bazaar_out next to the script.
  If ./bazaar_out is missing, you'll be prompted to select the folder.

Display rules:
  - Numbers show with thousands separators.
  - Max 1 decimal place (trailing .0 is omitted).

Dependencies:
  - Python 3.8+
  - pandas (required):       pip install pandas
  - ttkbootstrap (optional): pip install ttkbootstrap
"""

import os
import sys
import math
import csv
import traceback
from typing import List, Optional, Dict, Any, Tuple

# --- Hard guard: pandas is required for convenient filtering ---
try:
    import pandas as pd
    from pandas.api.types import is_numeric_dtype
except Exception as e:
    print("Missing dependency: pandas\nInstall with: pip install pandas", file=sys.stderr)
    sys.exit(1)

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# Try to use ttkbootstrap for a modern dark theme
_HAS_TTKBOOTSTRAP = False
try:
    import ttkbootstrap as tb  # type: ignore
    _HAS_TTKBOOTSTRAP = True
except Exception:
    _HAS_TTKBOOTSTRAP = False


APP_TITLE = "Hypixel SkyBlock Bazaar Viewer"
DEFAULT_PAGE_SIZE = 100
DEFAULT_DIR = "./bazaar_out"


# ----------------------------- Utilities -----------------------------

def safe_float(v) -> Optional[float]:
    try:
        if pd.isna(v):
            return None
        return float(v)
    except Exception:
        return None


def read_csv_if_exists(path: str) -> Optional[pd.DataFrame]:
    if not os.path.isfile(path):
        return None
    try:
        return pd.read_csv(path)
    except Exception:
        # attempt with low-memory off for wider CSV
        try:
            return pd.read_csv(path, low_memory=False)
        except Exception:
            traceback.print_exc()
            return None


def sort_dataframe(df: pd.DataFrame, col: str, ascending: bool) -> pd.DataFrame:
    if col not in df.columns:
        return df
    # Robust sort: mergesort keeps stable order; numeric when possible
    try:
        return df.sort_values(by=col, ascending=ascending, kind="mergesort")
    except Exception:
        try:
            tmp = df.copy()
            tmp["_sort_key_"] = pd.to_numeric(tmp[col], errors="coerce")
            tmp = tmp.sort_values(by=["_sort_key_"], ascending=ascending, kind="mergesort").drop(columns=["_sort_key_"])
            return tmp
        except Exception:
            tmp = df.copy()
            tmp["_sort_key_"] = tmp[col].astype(str)
            tmp = tmp.sort_values(by=["_sort_key_"], ascending=ascending, kind="mergesort").drop(columns=["_sort_key_"])
            return tmp


def ensure_numeric(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    out = df.copy()
    for c in cols:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce")
    return out


def format_number(value) -> str:
    """
    Pretty-print numbers:
      - thousands separators
      - max 1 decimal place
      - trim trailing '.0'
    """
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        num = float(value)
        s = f"{num:,.1f}"
        if s.endswith(".0"):
            s = s[:-2]
        return s
    except Exception:
        return str(value)


# ----------------------------- Data Layer -----------------------------

class BazaarData:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.products_df: Optional[pd.DataFrame] = None
        self.offers_df: Optional[pd.DataFrame] = None
        self.meta: Dict[str, Any] = {}
        self._load()

    def _load(self):
        products_path = os.path.join(self.base_dir, "bazaar_products.csv")
        buy_path = os.path.join(self.base_dir, "bazaar_buy_summary.csv")
        sell_path = os.path.join(self.base_dir, "bazaar_sell_summary.csv")
        meta_path = os.path.join(self.base_dir, "bazaar_meta.csv")

        p = read_csv_if_exists(products_path)
        b = read_csv_if_exists(buy_path)
        s = read_csv_if_exists(sell_path)
        m = read_csv_if_exists(meta_path)

        if p is None:
            raise FileNotFoundError(f"Missing file: {products_path}")

        # Normalize columns likely to be numeric for better filtering/sorting
        p = ensure_numeric(p, [
            "sellPrice", "sellVolume", "sellMovingWeek", "sellOrders",
            "buyPrice", "buyVolume", "buyMovingWeek", "buyOrders", "midPrice"
        ])
        
        # Calculate profit column (buyPrice - sellPrice)
        if "buyPrice" in p.columns and "sellPrice" in p.columns:
            p["profit"] = p["buyPrice"] - p["sellPrice"]
        else:
            p["profit"] = 0.0

        # Build offers with unified schema (side in column already: 'buy' or 'sell')
        frames = []
        if b is not None:
            b["side"] = "buy"
            frames.append(b)
        if s is not None:
            s["side"] = "sell"
            frames.append(s)
        offers = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

        # Normalize numeric offer columns
        offers = ensure_numeric(offers, ["rank", "pricePerUnit", "amount", "orders"])

        # Helpful column order
        preferred_offer_cols = [c for c in ["product_id", "side", "rank", "pricePerUnit", "amount", "orders"] if c in offers.columns]
        other_offer_cols = [c for c in offers.columns if c not in preferred_offer_cols]
        self.offers_df = offers[preferred_offer_cols + other_offer_cols] if not offers.empty else offers

        self.products_df = p
        if m is not None and len(m) > 0:
            self.meta = m.iloc[0].to_dict()
        else:
            self.meta = {}

    def get_products(self) -> pd.DataFrame:
        return self.products_df.copy()

    def get_offers(self) -> pd.DataFrame:
        return self.offers_df.copy() if self.offers_df is not None else pd.DataFrame()

    def get_product_ids(self) -> List[str]:
        col = "product_id"
        if self.products_df is None or col not in self.products_df.columns:
            return []
        vals = sorted(list(set(self.products_df[col].dropna().astype(str).tolist())))
        return vals


# ----------------------------- View Layer -----------------------------

class DataTable(ttk.Frame):
    """
    A paginated, sortable table backed by a pandas DataFrame.
    - Click column headers to sort (toggles asc/desc).
    - Supports column show/hide.
    - Paginates large datasets.
    - Pretty formats numeric cells (commas, max 1 decimal).
    """
    def __init__(self, master, page_size=DEFAULT_PAGE_SIZE):
        super().__init__(master)
        self.df: pd.DataFrame = pd.DataFrame()
        self.visible_columns: List[str] = []
        self.page_size = page_size
        self.current_page = 1
        self.sort_col: Optional[str] = None
        self.sort_asc: bool = True

        self._build_widgets()

    def _build_widgets(self):
        # Controls above table: page size, prev/next, export, count label
        ctrl = ttk.Frame(self)
        ctrl.pack(fill="x", padx=6, pady=4)

        self.countVar = tk.StringVar(value="0 rows")
        self.pageVar = tk.StringVar(value="Page 1/1")
        self.pageSizeVar = tk.IntVar(value=self.page_size)

        ttk.Label(ctrl, textvariable=self.countVar).pack(side="left", padx=(0, 8))

        ttk.Label(ctrl, text="Rows/page:").pack(side="left")
        ps = ttk.Spinbox(ctrl, from_=25, to=10000, textvariable=self.pageSizeVar, width=8, command=self._on_page_size)
        ps.pack(side="left", padx=(4, 12))

        self.prevBtn = ttk.Button(ctrl, text="← Prev", command=self.prev_page)
        self.prevBtn.pack(side="left")
        ttk.Label(ctrl, textvariable=self.pageVar).pack(side="left", padx=8)
        self.nextBtn = ttk.Button(ctrl, text="Next →", command=self.next_page)
        self.nextBtn.pack(side="left")

        ttk.Button(ctrl, text="Export filtered CSV", command=self.export_csv).pack(side="right")
        ttk.Button(ctrl, text="Columns…", command=self.edit_columns).pack(side="right", padx=(0, 8))

        # Treeview table
        self.tree = ttk.Treeview(self, columns=(), show="headings", height=24)
        self.tree.pack(fill="both", expand=True, padx=6, pady=(0, 6))

        # Attach vertical scrollbar
        vsb = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        vsb.place(in_=self.tree, relx=1.0, rely=0, relheight=1.0, x=-1, y=0, anchor="ne")
        self.tree.configure(yscrollcommand=vsb.set)

        # Column header click
        self.tree.bind("<Button-1>", self._on_header_click)

    # ----- Data / Rendering -----

    def set_dataframe(self, df: pd.DataFrame, preferred_cols: Optional[List[str]] = None):
        self.df = df.copy()
        self.current_page = 1
        self.sort_col = None

        # Default visible columns
        cols = list(self.df.columns)
        if preferred_cols:
            # keep preferred first then others
            left = [c for c in preferred_cols if c in cols]
            right = [c for c in cols if c not in left]
            cols = left + right
        self.visible_columns = cols[:]
        self._refresh_headers()
        self._render_page()

    def _refresh_headers(self):
        self.tree["columns"] = self.visible_columns
        for c in self.visible_columns:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=140 if c != "product_id" else 220, anchor="w")

    def _render_page(self):
        # Clear
        for i in self.tree.get_children():
            self.tree.delete(i)

        total_rows = len(self.df)
        page_size = max(1, int(self.pageSizeVar.get()))
        n_pages = max(1, math.ceil(total_rows / page_size))
        self.current_page = max(1, min(self.current_page, n_pages))
        start = (self.current_page - 1) * page_size
        end = min(total_rows, start + page_size)

        view = self.df.iloc[start:end]

        # Determine numeric columns once for this view
        numeric_cols = {c for c in self.visible_columns if c in view.columns and is_numeric_dtype(view[c])}

        # Insert rows with pretty formatting
        for _, row in view.iterrows():
            values = []
            for c in self.visible_columns:
                v = row.get(c, "")
                if c in numeric_cols:
                    values.append(format_number(v))
                else:
                    values.append("" if (isinstance(v, float) and pd.isna(v)) else v)
            self.tree.insert("", "end", values=values)

        self.countVar.set(f"{total_rows:,} rows")
        self.pageVar.set(f"Page {self.current_page}/{n_pages}")
        self.prevBtn["state"] = tk.NORMAL if self.current_page > 1 else tk.DISABLED
        self.nextBtn["state"] = tk.NORMAL if self.current_page < n_pages else tk.DISABLED

    # ----- Sorting -----

    def _on_header_click(self, event):
        # Identify if clicked on header
        region = self.tree.identify("region", event.x, event.y)
        if region != "heading":
            return
        col_id = self.tree.identify_column(event.x)  # e.g., "#3"
        try:
            idx = int(col_id.replace("#", "")) - 1
        except Exception:
            return
        if idx < 0 or idx >= len(self.visible_columns):
            return

        col_name = self.visible_columns[idx]
        if self.sort_col == col_name:
            self.sort_asc = not self.sort_asc
        else:
            self.sort_col = col_name
            self.sort_asc = True

        self.df = sort_dataframe(self.df, col_name, self.sort_asc)
        self._render_page()

    # ----- Pagination -----

    def _on_page_size(self):
        try:
            n = int(self.pageSizeVar.get())
            if n < 1:
                self.pageSizeVar.set(1)
        except Exception:
            self.pageSizeVar.set(DEFAULT_PAGE_SIZE)
        self.current_page = 1
        self._render_page()

    def next_page(self):
        self.current_page += 1
        self._render_page()

    def prev_page(self):
        self.current_page -= 1
        self._render_page()

    # ----- Column Editor -----

    def edit_columns(self):
        if self.df.empty:
            messagebox.showinfo("Columns", "No data loaded.")
            return

        top = tk.Toplevel(self)
        top.title("Choose visible columns")
        top.geometry("520x480")

        cols = list(self.df.columns)
        vis_set = set(self.visible_columns)

        left_frame = ttk.Frame(top)
        left_frame.pack(side="left", fill="both", expand=True, padx=8, pady=8)
        right_frame = ttk.Frame(top)
        right_frame.pack(side="right", fill="y", padx=8, pady=8)

        ttk.Label(left_frame, text="Columns (check to show)").pack(anchor="w", pady=(0, 6))
        canvas = tk.Canvas(left_frame, highlightthickness=0)
        scroll = ttk.Scrollbar(left_frame, orient="vertical", command=canvas.yview)
        inner = ttk.Frame(canvas)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        vars_map: Dict[str, tk.BooleanVar] = {}
        for c in cols:
            v = tk.BooleanVar(value=(c in vis_set))
            cb = ttk.Checkbutton(inner, text=c, variable=v)
            cb.pack(anchor="w")
            vars_map[c] = v

        def select_common():
            common = ["product_id", "side", "rank", "pricePerUnit", "amount", "orders",
                      "sellPrice", "buyPrice", "midPrice", "sellOrders", "buyOrders",
                      "sellVolume", "buyVolume"]
            for c in cols:
                vars_map[c].set(c in common and c in cols)

        def on_ok():
            new_visible = [c for c in cols if vars_map[c].get()]
            if not new_visible:
                messagebox.showwarning("Columns", "At least one column must be visible.")
                return
            self.visible_columns = new_visible
            self._refresh_headers()
            self._render_page()
            top.destroy()

        ttk.Button(right_frame, text="Common", command=select_common).pack(fill="x", pady=(0, 8))
        ttk.Button(right_frame, text="All", command=lambda: [vars_map[c].set(True) for c in cols]).pack(fill="x", pady=(0, 8))
        ttk.Button(right_frame, text="None", command=lambda: [vars_map[c].set(False) for c in cols]).pack(fill="x", pady=(0, 8))
        ttk.Separator(right_frame).pack(fill="x", pady=8)
        ttk.Button(right_frame, text="OK", command=on_ok).pack(fill="x")
        ttk.Button(right_frame, text="Cancel", command=top.destroy).pack(fill="x", pady=(8, 0))

    # ----- Export -----

    def export_csv(self):
        if self.df.empty:
            messagebox.showinfo("Export", "No data to export.")
            return
        path = filedialog.asksaveasfilename(
            title="Export filtered view",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialfile="bazaar_filtered.csv",
        )
        if not path:
            return
        try:
            # Export raw (unformatted) numeric values for analysis
            self.df[self.visible_columns].to_csv(path, index=False)
            messagebox.showinfo("Export", f"Saved: {path}")
        except Exception as e:
            messagebox.showerror("Export failed", str(e))


# ----------------------------- Filter Pane -----------------------------

class Filters(ttk.Frame):
    """
    Filter controls for both Products and Offers.
    Provides:
      - product_id substring filter
      - min/max numeric filters for key columns
      - side filter (for offers)
      - apply/reset buttons
      - debounced change detection for text inputs
    """
    def __init__(self, master, on_apply, include_side=False, numeric_cols: Optional[List[str]] = None, include_tax_toggle=False, include_hide_toggles=False):
        super().__init__(master)
        self.on_apply = on_apply
        self.include_side = include_side
        self.include_tax_toggle = include_tax_toggle
        self.include_hide_toggles = include_hide_toggles
        self.numeric_cols = numeric_cols or []
        self._after_id = None

        self._build()

    def _build(self):
        grid = ttk.Frame(self)
        grid.pack(fill="x", padx=6, pady=6)

        # Row 0: product_id substring
        ttk.Label(grid, text="product_id contains").grid(row=0, column=0, sticky="w", padx=(0, 6), pady=(0, 6))
        self.productContainsVar = tk.StringVar()
        e = ttk.Entry(grid, textvariable=self.productContainsVar, width=28)
        e.grid(row=0, column=1, sticky="w", pady=(0, 6))
        e.bind("<KeyRelease>", self._debounced_apply)

        # Row 0 (cont): side selector for offers
        if self.include_side:
            ttk.Label(grid, text="side").grid(row=0, column=2, sticky="w", padx=(16, 6), pady=(0, 6))
            self.sideVar = tk.StringVar(value="both")
            side_combo = ttk.Combobox(grid, textvariable=self.sideVar, values=["both", "buy", "sell"], width=8, state="readonly")
            side_combo.grid(row=0, column=3, sticky="w", pady=(0, 6))
            side_combo.bind("<<ComboboxSelected>>", lambda _e: self.apply())
        
        # Row 0 (cont): tax toggle for products
        if self.include_tax_toggle:
            col_start = 4 if self.include_side else 2
            ttk.Label(grid, text="Calculate Taxes").grid(row=0, column=col_start, sticky="w", padx=(16, 6), pady=(0, 6))
            self.taxVar = tk.BooleanVar(value=False)
            tax_check = ttk.Checkbutton(grid, text="1.125% tax", variable=self.taxVar, command=self.apply)
            tax_check.grid(row=0, column=col_start+1, sticky="w", pady=(0, 6))
        
        # Row 0 (cont): hide toggles for products
        if self.include_hide_toggles:
            col_start = 6 if self.include_side and self.include_tax_toggle else (4 if self.include_side or self.include_tax_toggle else 2)
            ttk.Label(grid, text="Hide Items").grid(row=0, column=col_start, sticky="w", padx=(16, 6), pady=(0, 6))
            self.hideShardVar = tk.BooleanVar(value=False)
            self.hideEnchantmentVar = tk.BooleanVar(value=False)
            shard_check = ttk.Checkbutton(grid, text="SHARD_", variable=self.hideShardVar, command=self.apply)
            shard_check.grid(row=0, column=col_start+1, sticky="w", pady=(0, 6))
            enchantment_check = ttk.Checkbutton(grid, text="ENCHANTMENT_", variable=self.hideEnchantmentVar, command=self.apply)
            enchantment_check.grid(row=0, column=col_start+2, sticky="w", pady=(0, 6))

        # Row 1+: numeric ranges
        self.minVars: Dict[str, tk.StringVar] = {}
        self.maxVars: Dict[str, tk.StringVar] = {}

        r = 1
        c = 0
        for col_name in self.numeric_cols:
            self._add_numeric_range(grid, r, c, col_name)
            c += 1
            if c >= 3:
                c = 0
                r += 1

        # Apply/Reset
        btns = ttk.Frame(self)
        btns.pack(fill="x", padx=6, pady=(0, 6))
        ttk.Button(btns, text="Reset", command=self.reset).pack(side="right")
        ttk.Button(btns, text="Apply", command=self.apply).pack(side="right", padx=(0, 8))

    def _add_numeric_range(self, parent, r, c, label):
        frame = ttk.LabelFrame(parent, text=label)
        frame.grid(row=r, column=c, padx=6, pady=6, sticky="w")
        min_var = tk.StringVar()
        max_var = tk.StringVar()
        self.minVars[label] = min_var
        self.maxVars[label] = max_var

        row = ttk.Frame(frame)
        row.pack(padx=6, pady=6)

        ttk.Label(row, text="min").pack(side="left")
        e1 = ttk.Entry(row, textvariable=min_var, width=10)
        e1.pack(side="left", padx=(4, 12))
        e1.bind("<KeyRelease>", self._debounced_apply)

        ttk.Label(row, text="max").pack(side="left")
        e2 = ttk.Entry(row, textvariable=max_var, width=10)
        e2.pack(side="left", padx=(4, 0))
        e2.bind("<KeyRelease>", self._debounced_apply)

    # --- Actions ---

    def _debounced_apply(self, _evt):
        if self._after_id:
            self.after_cancel(self._after_id)
        self._after_id = self.after(300, self.apply)

    def get_state(self) -> Dict[str, Any]:
        state: Dict[str, Any] = {
            "product_substr": self.productContainsVar.get().strip(),
        }
        if self.include_side:
            state["side"] = self.sideVar.get()
        if self.include_tax_toggle:
            state["calculate_tax"] = self.taxVar.get()
        if self.include_hide_toggles:
            state["hide_shard"] = self.hideShardVar.get()
            state["hide_enchantment"] = self.hideEnchantmentVar.get()

        # Gather numeric ranges
        ranges: Dict[str, Tuple[Optional[float], Optional[float]]] = {}
        for k in self.minVars.keys():
            vmin = self.minVars[k].get().strip()
            vmax = self.maxVars[k].get().strip()
            vmin_f = None if vmin == "" else safe_float(vmin)
            vmax_f = None if vmax == "" else safe_float(vmax)
            ranges[k] = (vmin_f, vmax_f)
        state["ranges"] = ranges
        return state

    def apply(self):
        try:
            self.on_apply(self.get_state())
        except Exception:
            traceback.print_exc()

    def reset(self):
        self.productContainsVar.set("")
        if self.include_side:
            self.sideVar.set("both")
        if self.include_tax_toggle:
            self.taxVar.set(False)
        if self.include_hide_toggles:
            self.hideShardVar.set(False)
            self.hideEnchantmentVar.set(False)
        for k in list(self.minVars.keys()):
            self.minVars[k].set("")
            self.maxVars[k].set("")
        self.apply()


# ----------------------------- Main Application -----------------------------

class BazaarViewer:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.data = BazaarData(base_dir)
        self.root = self._create_root()
        self._init_style(self.root)

        # Top-level layout: header + notebook (tabs)
        self._build_header()
        self._build_tabs()

    # ----- Tk root -----

    def _create_root(self):
        if _HAS_TTKBOOTSTRAP:
            app = tb.Window(themename="darkly")
        else:
            app = tk.Tk()
        app.title(APP_TITLE)
        app.geometry("1200x780")
        app.minsize(900, 600)
        return app

    def _init_style(self, root):
        if _HAS_TTKBOOTSTRAP:
            return  # already themed
        # Fallback: minimal dark theme for ttk
        style = ttk.Style(root)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        bg = "#1c1f24"
        fg = "#e6e6e6"
        acc = "#2a2f36"
        style.configure(".", background=bg, foreground=fg, fieldbackground=acc)
        style.configure("Treeview", background=acc, fieldbackground=acc, foreground=fg, borderwidth=0)
        style.map("Treeview", background=[("selected", "#39424e")], foreground=[("selected", "#ffffff")])
        style.configure("TLabel", background=bg, foreground=fg)
        style.configure("TEntry", fieldbackground="#121418", foreground=fg, insertcolor=fg)
        style.configure("TCombobox", fieldbackground="#121418", foreground=fg)
        style.configure("TCheckbutton", background=bg, foreground=fg)
        style.configure("TButton", background="#2b313a", foreground=fg)
        root.configure(bg=bg)

    # ----- Header -----

    def _build_header(self):
        bar = ttk.Frame(self.root)
        bar.pack(fill="x", pady=(6, 0), padx=8)

        self.dirVar = tk.StringVar(value=os.path.abspath(self.base_dir))
        ttk.Label(bar, text="Data directory").pack(side="left")
        dir_entry = ttk.Entry(bar, textvariable=self.dirVar, width=60)
        dir_entry.pack(side="left", padx=8)
        ttk.Button(bar, text="Open…", command=self._choose_dir).pack(side="left")

        # Meta on the right
        metaStr = self._meta_summary()
        self.metaVar = tk.StringVar(value=metaStr)
        ttk.Label(bar, textvariable=self.metaVar).pack(side="right")

    def _meta_summary(self) -> str:
        m = self.data.meta
        if not m:
            return ""
        lu = m.get("lastUpdated_iso") or ""
        fetched = m.get("fetched_at_iso") or ""
        return f"lastUpdated: {lu} | fetched: {fetched}"

    def _choose_dir(self):
        d = filedialog.askdirectory(initialdir=self.base_dir, mustexist=True, title="Select bazaar_out directory")
        if not d:
            return
        try:
            self.data = BazaarData(d)
            self.dirVar.set(os.path.abspath(d))
            self.metaVar.set(self._meta_summary())
            # refresh tabs
            self._reload_tabs()
        except Exception as e:
            messagebox.showerror("Load failed", str(e))

    # ----- Tabs -----

    def _build_tabs(self):
        self.nb = ttk.Notebook(self.root)
        self.nb.pack(fill="both", expand=True, padx=8, pady=8)

        # Products tab
        self.tabProducts = ttk.Frame(self.nb)
        self.nb.add(self.tabProducts, text="Products")

        self.prodFilters = Filters(
            self.tabProducts,
            on_apply=self._apply_product_filters,
            include_side=False,
            include_tax_toggle=True,
            include_hide_toggles=True,
            numeric_cols=[
                "sellPrice", "sellVolume", "sellMovingWeek", "sellOrders",
                "buyPrice", "buyVolume", "buyMovingWeek", "buyOrders", "midPrice",
                "profit",
            ],
        )
        self.prodFilters.pack(fill="x")
        self.prodTable = DataTable(self.tabProducts, page_size=DEFAULT_PAGE_SIZE)
        self.prodTable.pack(fill="both", expand=True)

        # Offers tab
        self.tabOffers = ttk.Frame(self.nb)
        self.nb.add(self.tabOffers, text="Offers")

        self.offerFilters = Filters(
            self.tabOffers,
            on_apply=self._apply_offer_filters,
            include_side=True,
            numeric_cols=["rank", "pricePerUnit", "amount", "orders"],
        )
        self.offerFilters.pack(fill="x")
        self.offerTable = DataTable(self.tabOffers, page_size=DEFAULT_PAGE_SIZE)
        self.offerTable.pack(fill="both", expand=True)

        # Initial data load
        self._reload_tabs()

    def _reload_tabs(self):
        # Products
        prod_df = self.data.get_products()
        self.prod_full_df = prod_df  # keep original for filtering
        pref_prod_cols = [
            "product_id",
            "sellPrice", "sellOrders", "sellVolume",
            "buyPrice", "buyOrders", "buyVolume",
            "midPrice", "profit",
        ]
        self.prodTable.set_dataframe(prod_df, preferred_cols=pref_prod_cols)

        # Offers
        offer_df = self.data.get_offers()
        self.offer_full_df = offer_df
        pref_offer_cols = ["product_id", "side", "rank", "pricePerUnit", "amount", "orders"]
        self.offerTable.set_dataframe(offer_df, preferred_cols=pref_offer_cols)

    # ----- Filter logic -----

    def _apply_product_filters(self, state: Dict[str, Any]):
        df = self.prod_full_df.copy()
        if df.empty:
            self.prodTable.set_dataframe(df)
            return

        # Apply tax calculation if enabled
        calculate_tax = state.get("calculate_tax", False)
        if calculate_tax and "profit" in df.columns:
            # Recalculate profit with 1.125% tax deduction
            if "buyPrice" in df.columns and "sellPrice" in df.columns:
                # profit = (buyPrice - sellPrice) * (1 - 0.01125)
                df["profit"] = (df["buyPrice"] - df["sellPrice"]) * (1 - 0.01125)

        # Hide items based on prefixes
        hide_shard = state.get("hide_shard", False)
        hide_enchantment = state.get("hide_enchantment", False)
        
        if hide_shard:
            df = df[~df["product_id"].astype(str).str.startswith("SHARD_", na=False)]
        if hide_enchantment:
            df = df[~df["product_id"].astype(str).str.startswith("ENCHANTMENT_", na=False)]

        # product_id substring
        substr = state.get("product_substr", "")
        if substr:
            df = df[df["product_id"].astype(str).str.contains(substr, case=False, na=False)]

        # numeric ranges
        ranges = state.get("ranges", {})
        for col, (vmin, vmax) in ranges.items():
            if col not in df.columns:
                continue
            if vmin is not None:
                df = df[df[col] >= vmin]
            if vmax is not None:
                df = df[df[col] <= vmax]

        self.prodTable.set_dataframe(df, preferred_cols=None)

    def _apply_offer_filters(self, state: Dict[str, Any]):
        df = self.offer_full_df.copy()
        if df.empty:
            self.offerTable.set_dataframe(df)
            return

        substr = state.get("product_substr", "")
        if substr:
            df = df[df["product_id"].astype(str).str.contains(substr, case=False, na=False)]

        side = state.get("side", "both")
        if side in ("buy", "sell") and "side" in df.columns:
            df = df[df["side"] == side]

        ranges = state.get("ranges", {})
        for col, (vmin, vmax) in ranges.items():
            if col not in df.columns:
                continue
            if vmin is not None:
                df = df[df[col] >= vmin]
            if vmax is not None:
                df = df[df[col] <= vmax]

        self.offerTable.set_dataframe(df, preferred_cols=None)

    # ----- Run -----

    def run(self):
        # Shortcuts
        self.root.bind("<Control-f>", lambda e: self._focus_first_filter())
        self.root.bind("<Control-s>", lambda e: self._export_current())
        self.root.bind("<F5>", lambda e: self._reload_tabs())

        self.root.mainloop()

    def _export_current(self):
        if self.nb.index(self.nb.select()) == 0:
            self.prodTable.export_csv()
        else:
            self.offerTable.export_csv()

    def _focus_first_filter(self):
        try:
            if self.nb.index(self.nb.select()) == 0:
                self.prodFilters.focus_set()
            else:
                self.offerFilters.focus_set()
        except Exception:
            pass


# ----------------------------- Entrypoint -----------------------------

def pick_or_default_dir() -> Optional[str]:
    """
    Prefer ./bazaar_out if it exists; otherwise prompt the user to choose the folder.
    """
    default_abs = os.path.abspath(DEFAULT_DIR)
    if os.path.isdir(default_abs):
        return default_abs

    root = tk.Tk()
    root.withdraw()
    messagebox.showinfo(
        "Select data folder",
        f"Default directory not found:\n{default_abs}\n\nPlease select your 'bazaar_out' folder."
    )
    d = filedialog.askdirectory(title="Select bazaar_out directory")
    root.destroy()
    if d and os.path.isdir(d):
        return d
    return None


def main():
    base_dir = pick_or_default_dir()
    if not base_dir:
        print("No data directory selected. Exiting.", file=sys.stderr)
        sys.exit(2)

    try:
        app = BazaarViewer(base_dir)
        app.run()
    except Exception as e:
        print("Fatal error:", e, file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
