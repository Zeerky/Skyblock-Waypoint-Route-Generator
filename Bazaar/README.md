# Hypixel Bazaar Viewer

Web app to explore Hypixel SkyBlock Bazaar data — products (`quick_status`) and buy/sell order ladders.

Web UI for bazaar product stats — filtering, sorting, pagination, column picker, and CSV export.

## Setup

```bash
npm install
```

Ensure snapshot data is available at `public/bazaar_raw.json` (copied automatically from `bazaar_out/` on `npm run dev` / `npm run build`):

```powershell
# Or manually:
Copy-Item bazaar_out\bazaar_raw.json public\bazaar_raw.json
```

Refresh data with the Python dumper (requires Hypixel API key):

```bash
python dump_bazaar_to_csv.py --api-key YOUR_KEY --outdir ./bazaar_out
```

## Run

```bash
npm run dev
```

Open the URL shown (default `http://localhost:5174`).

## Features

- Product prices, volumes, profit (optional 1.125% tax), hide Shards / Enchants
- Sort any column, paginate, toggle columns, export filtered CSV
- Default bundled snapshot, upload custom `bazaar_raw.json`, or refresh live with a [Hypixel development API key](https://developer.hypixel.net/dashboard)

## Legacy scripts

- `dump_bazaar_to_csv.py` — fetch API and write CSVs + `bazaar_raw.json`
- `bazaar_viewer.py` — original Tk desktop viewer (kept for reference)
