#!/usr/bin/env python3
"""
Dump Hypixel SkyBlock Bazaar data to CSV.

It fetches https://api.hypixel.net/v2/skyblock/bazaar and writes:
  - bazaar_products.csv       (one row per product, incl. quick_status fields)
  - bazaar_buy_summary.csv    (one row per buy offer per product)
  - bazaar_sell_summary.csv   (one row per sell offer per product)
  - bazaar_meta.csv           (a single-row file with fetch metadata)
  - bazaar_raw.json           (optional: full raw JSON for reference)

Usage:
  python dump_bazaar_to_csv.py --api-key YOUR_KEY [--outdir ./out] [--no-raw]

API key handling:
  - Pass via --api-key
  - Or set env var HYPIXEL_API_KEY
Notes:
  - Your key may be rate-limited by Hypixel. This script makes a single request.
  - No external dependencies required (std lib only).
"""

import argparse
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple

BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar"


def to_iso8601(ms_epoch: int) -> str:
    """Convert a milliseconds epoch timestamp to an ISO 8601 string in UTC."""
    try:
        return datetime.fromtimestamp(ms_epoch / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return ""


def fetch_bazaar(api_key: str, timeout: int = 20) -> Dict[str, Any]:
    """Fetch bazaar JSON using the Hypixel API key."""
    req = urllib.request.Request(BAZAAR_URL)
    # Hypixel accepts either header "API-Key" or query ?key=...
    req.add_header("API-Key", api_key.strip())

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status} from Hypixel")
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTPError {e.code}: {msg}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"URLError: {e.reason}") from e


def normalize_quick_status(product_id: str, quick_status: Dict[str, Any]) -> Dict[str, Any]:
    """
    Flatten quick_status with stable keys.
    Hypixel typical fields (can change over time):
      - productId
      - sellPrice
      - sellVolume
      - sellMovingWeek
      - sellOrders
      - buyPrice
      - buyVolume
      - buyMovingWeek
      - buyOrders
    We’ll include all we see plus product_id and a computed midPrice.
    """
    row = {"product_id": product_id}
    for k, v in quick_status.items():
        row[str(k)] = v
    # Add a midPrice convenience column if prices present
    try:
        buy_p = float(row.get("buyPrice", "nan"))
        sell_p = float(row.get("sellPrice", "nan"))
        if buy_p == buy_p and sell_p == sell_p:  # check for NaN
            row["midPrice"] = (buy_p + sell_p) / 2.0
    except Exception:
        pass
    return row


def collect_quick_status_rows(products: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    rows: List[Dict[str, Any]] = []
    header_keys = set(["product_id"])
    for pid, p in products.items():
        qs = p.get("quick_status", {})
        row = normalize_quick_status(pid, qs)
        rows.append(row)
        header_keys.update(row.keys())

    # Create stable column order: product_id first, known fields next, then the rest sorted
    known_order = [
        "product_id",
        "productId",
        "sellPrice",
        "sellVolume",
        "sellMovingWeek",
        "sellOrders",
        "buyPrice",
        "buyVolume",
        "buyMovingWeek",
        "buyOrders",
        "midPrice",
    ]
    remaining = [k for k in sorted(header_keys) if k not in known_order]
    columns = [k for k in known_order if k in header_keys] + remaining
    return rows, columns


def collect_offer_rows(products: Dict[str, Any], side: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    side: 'buy_summary' or 'sell_summary'
    Each offer contains:
      - amount
      - pricePerUnit
      - orders
    """
    assert side in ("buy_summary", "sell_summary")
    rows: List[Dict[str, Any]] = []
    header_keys = set(["product_id", "rank", "side"])
    for pid, p in products.items():
        offers = p.get(side, [])
        for rank, offer in enumerate(offers, start=1):
            row = {
                "product_id": pid,
                "rank": rank,
                "side": side.replace("_summary", ""),  # 'buy' or 'sell'
            }
            # Copy all offer keys (future-proofing)
            for k, v in offer.items():
                row[str(k)] = v
            rows.append(row)
            header_keys.update(row.keys())

    # Preferred order
    known_order = ["product_id", "side", "rank", "pricePerUnit", "amount", "orders"]
    remaining = [k for k in sorted(header_keys) if k not in known_order]
    columns = [k for k in known_order if k in header_keys] + remaining
    return rows, columns


def write_csv(path: str, rows: List[Dict[str, Any]], columns: List[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in columns})


def write_meta_csv(path: str, payload: Dict[str, Any], elapsed_s: float) -> None:
    meta = {
        "success": payload.get("success", False),
        "lastUpdated_ms": payload.get("lastUpdated", ""),
        "lastUpdated_iso": to_iso8601(payload.get("lastUpdated", 0)) if payload.get("lastUpdated") else "",
        "fetched_at_iso": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": f"{elapsed_s:.3f}",
    }
    write_csv(path, [meta], list(meta.keys()))


def main():
    parser = argparse.ArgumentParser(description="Dump Hypixel SkyBlock Bazaar data to CSV.")
    parser.add_argument("--api-key", default=os.environ.get("HYPIXEL_API_KEY", "").strip(),
                        help="Hypixel API key (or set HYPIXEL_API_KEY env var).")
    parser.add_argument("--outdir", default="./bazaar_out", help="Output directory for CSVs and JSON.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds.")
    parser.add_argument("--no-raw", action="store_true", help="Do not write bazaar_raw.json.")
    args = parser.parse_args()

    api_key = (args.api_key or "").strip()
    if not api_key:
        # Fallback: allow reading from stdin (so you can: echo KEY | python script.py -)
        if not sys.stdin.isatty():
            api_key = sys.stdin.read().strip()
    if not api_key:
        print("Error: Missing API key. Pass --api-key or set HYPIXEL_API_KEY.", file=sys.stderr)
        sys.exit(2)

    t0 = time.time()
    try:
        payload = fetch_bazaar(api_key=api_key, timeout=args.timeout)
    except Exception as e:
        print(f"Fetch error: {e}", file=sys.stderr)
        sys.exit(1)
    elapsed = time.time() - t0

    if not payload.get("success", False):
        print(f"Hypixel API returned success=false. Full payload:\n{json.dumps(payload, indent=2)}", file=sys.stderr)
        sys.exit(1)

    products = payload.get("products", {})
    if not isinstance(products, dict) or not products:
        print("No products found in response.", file=sys.stderr)
        sys.exit(1)

    outdir = args.outdir
    os.makedirs(outdir, exist_ok=True)

    # Write meta
    write_meta_csv(os.path.join(outdir, "bazaar_meta.csv"), payload, elapsed)

    # Write products (quick_status)
    qs_rows, qs_cols = collect_quick_status_rows(products)
    write_csv(os.path.join(outdir, "bazaar_products.csv"), qs_rows, qs_cols)

    # Write buy offers
    buy_rows, buy_cols = collect_offer_rows(products, "buy_summary")
    write_csv(os.path.join(outdir, "bazaar_buy_summary.csv"), buy_rows, buy_cols)

    # Write sell offers
    sell_rows, sell_cols = collect_offer_rows(products, "sell_summary")
    write_csv(os.path.join(outdir, "bazaar_sell_summary.csv"), sell_rows, sell_cols)

    # Optional: raw JSON for full fidelity
    if not args.no_raw:
        with open(os.path.join(outdir, "bazaar_raw.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Done. Wrote CSVs to: {os.path.abspath(outdir)}")
    print(f"Files:")
    print(f"  - bazaar_meta.csv")
    print(f"  - bazaar_products.csv")
    print(f"  - bazaar_buy_summary.csv")
    print(f"  - bazaar_sell_summary.csv")
    if not args.no_raw:
        print(f"  - bazaar_raw.json")


if __name__ == "__main__":
    main()
