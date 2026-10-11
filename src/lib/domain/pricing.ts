import type { ISODate, ProductPrice, UnitCode } from "./types";
import { canConvert, convert } from "./units";
import { roundMoney } from "./money";

/** Prețul unitar cunoscut pentru un produs, cu proveniența lui. */
export interface UnitPrice {
  product_id: string;
  /** RON pentru 1 × `unit`. */
  per_unit: number;
  unit: UnitCode;
  observed_on: ISODate;
  price_id: string;
}

export type PriceIndex = Map<string, ProductPrice[]>;

/**
 * Grupează prețurile pe produs, cele mai noi primele. Prețurile șterse și
 * cele cu cantitate zero se ignoră. Nu există prețuri implicite: un produs
 * fără preț introdus de gospodărie rămâne fără preț.
 */
export function buildPriceIndex(prices: ProductPrice[]): PriceIndex {
  const index: PriceIndex = new Map();
  for (const p of prices) {
    if (p.deleted_at || p.quantity <= 0 || p.amount < 0) continue;
    const list = index.get(p.product_id) ?? [];
    list.push(p);
    index.set(p.product_id, list);
  }
  for (const list of index.values()) {
    list.sort((a, b) => (b.observed_on.localeCompare(a.observed_on)) || b.updated_at.localeCompare(a.updated_at));
  }
  return index;
}

/** Cel mai recent preț exprimabil în `unit` (sau orice unitate, dacă `unit` lipsește). */
export function latestUnitPrice(index: PriceIndex, productId: string, unit?: UnitCode | null): UnitPrice | null {
  const list = index.get(productId);
  if (!list) return null;
  for (const p of list) {
    if (unit && !canConvert(p.unit, unit)) continue;
    const target = unit ?? p.unit;
    const qtyInTarget = convert(p.quantity, p.unit, target)!;
    if (qtyInTarget <= 0) continue;
    return { product_id: productId, per_unit: p.amount / qtyInTarget, unit: target, observed_on: p.observed_on, price_id: p.id };
  }
  return null;
}

/** Costul estimat pentru o cantitate; null dacă nu există un preț compatibil. */
export function estimateCost(index: PriceIndex, productId: string, quantity: number | null, unit: UnitCode | null): { cost: number; observed_on: ISODate } | null {
  if (quantity == null || !unit) return null;
  const up = latestUnitPrice(index, productId, unit);
  if (!up) return null;
  return { cost: roundMoney(up.per_unit * quantity), observed_on: up.observed_on };
}
