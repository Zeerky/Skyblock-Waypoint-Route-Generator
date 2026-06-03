import type { ProductFilters } from "./types";
import { PRODUCT_NUMERIC_COLS } from "./types";

function emptyRanges(keys: readonly string[]): Record<string, { min: string; max: string }> {
  return Object.fromEntries(keys.map((k) => [k, { min: "", max: "" }]));
}

export function defaultProductFilters(): ProductFilters {
  return {
    productQuery: "",
    calculateTax: false,
    hideShard: false,
    hideEnchantment: false,
    ranges: emptyRanges(PRODUCT_NUMERIC_COLS),
  };
}
