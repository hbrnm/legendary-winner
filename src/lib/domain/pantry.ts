import type { ISODate, PantryItem, ShoppingTransactionItem } from "./types";
import { daysBetween, localDateOf, addDays } from "./dates";
import { convertWithPiece } from "./units";
import type { Need, PieceGrams, Stock } from "./quantities";

export type ExpiryState = "expirat" | "expira_curand" | "ok" | "fara_data";

export function expiryState(item: Pick<PantryItem, "expires_on">, today: ISODate, soonDays = 3): ExpiryState {
  if (!item.expires_on) return "fara_data";
  const d = daysBetween(today, item.expires_on);
  if (d < 0) return "expirat";
  if (d <= soonDays) return "expira_curand";
  return "ok";
}

export function livePantry(items: PantryItem[]): PantryItem[] {
  return items.filter((i) => !i.deleted_at && i.quantity > 0);
}

/** Produsele expirate sau care expiră în `soonDays` zile, cele mai urgente primele. */
export function expiringSoon(items: PantryItem[], today: ISODate, soonDays = 3): PantryItem[] {
  return livePantry(items)
    .filter((i) => {
      const s = expiryState(i, today, soonDays);
      return s === "expirat" || s === "expira_curand";
    })
    .sort((a, b) => a.expires_on!.localeCompare(b.expires_on!));
}

export function pantryStock(items: PantryItem[]): Stock[] {
  return livePantry(items)
    .filter((i) => i.product_id)
    .map((i) => ({ product_id: i.product_id!, quantity: i.quantity, unit: i.unit }));
}

export interface ConsumeOp {
  item_id: string;
  new_quantity: number;
}

/**
 * Cum se scad ingredientele unei rețete din cămară: întâi din ce expiră
 * primul (FEFO). Nu se scade niciodată sub zero; ce nu se poate acoperi
 * (unitate incompatibilă, cantitate insuficientă) se întoarce în `shortfall`.
 */
export function planConsumption(items: PantryItem[], needs: Need[], pieces?: PieceGrams): { ops: ConsumeOp[]; shortfall: Need[] } {
  const working = livePantry(items)
    .map((i) => ({ ...i }))
    .sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999"));
  const shortfall: Need[] = [];
  const touched = new Map<string, number>();
  for (const n of needs) {
    if (n.quantity == null || !n.unit) continue;
    let left = n.quantity;
    const pg = pieces?.get(n.product_id);
    for (const i of working) {
      if (left <= 1e-9) break;
      if (i.product_id !== n.product_id || i.quantity <= 0) continue;
      const availableInNeed = convertWithPiece(i.quantity, i.unit, n.unit, pg);
      if (availableInNeed == null) continue;
      const used = Math.min(availableInNeed, left);
      i.quantity = Math.max(0, round3(i.quantity - convertWithPiece(used, n.unit, i.unit, pg)!));
      left -= used;
      touched.set(i.id, i.quantity);
    }
    if (left > 1e-9) shortfall.push({ ...n, quantity: round3(left) });
  }
  return { ops: [...touched].map(([item_id, new_quantity]) => ({ item_id, new_quantity })), shortfall };
}

function round3(q: number): number {
  return Math.round(q * 1000) / 1000;
}

export interface FrequentProduct {
  product_id: string;
  name: string;
  count: number;
  last_bought: ISODate;
}

/** Produsele cumpărate cel mai des în ultimele `days` zile (minimum 2 cumpărări). */
export function frequentProducts(items: ShoppingTransactionItem[], today: ISODate, days = 90, minCount = 2): FrequentProduct[] {
  const since = addDays(today, -days);
  const map = new Map<string, FrequentProduct>();
  for (const i of items) {
    if (i.deleted_at || !i.product_id) continue;
    const d = localDateOf(i.purchased_at);
    if (d < since || d > today) continue;
    const f = map.get(i.product_id) ?? { product_id: i.product_id, name: i.name, count: 0, last_bought: d };
    f.count++;
    if (d > f.last_bought) f.last_bought = d;
    map.set(i.product_id, f);
  }
  return [...map.values()].filter((f) => f.count >= minCount).sort((a, b) => b.count - a.count || b.last_bought.localeCompare(a.last_bought));
}
