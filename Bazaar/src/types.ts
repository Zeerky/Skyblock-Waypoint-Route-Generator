export type Row = Record<string, string | number | null>;

export interface BazaarMeta {
  success: boolean;
  lastUpdatedMs: number | null;
  lastUpdatedIso: string;
  fetchedAtIso: string;
  elapsedSeconds: number | null;
}

export interface BazaarDataset {
  meta: BazaarMeta;
  products: Row[];
}

export interface ProductFilters {
  productQuery: string;
  calculateTax: boolean;
  hideShard: boolean;
  hideEnchantment: boolean;
  ranges: Record<string, { min: string; max: string }>;
}

export const BAZAAR_TAX = 0.01125;

export const DEFAULT_PAGE_SIZE = 100;

export const PRODUCT_NUMERIC_COLS = [
  "sellPrice",
  "sellVolume",
  "sellMovingWeek",
  "sellOrders",
  "buyPrice",
  "buyVolume",
  "buyMovingWeek",
  "buyOrders",
  "midPrice",
  "profit",
] as const;

export const PREFERRED_PRODUCT_COLS = [
  "product_id",
  "sellPrice",
  "sellOrders",
  "sellVolume",
  "buyPrice",
  "buyOrders",
  "buyVolume",
  "midPrice",
  "profit",
  "sellMovingWeek",
  "buyMovingWeek",
];
