import type { PantryItem, ShoppingListItem, ShoppingTransactionItem, ProductCategory, UnitCode } from "./types";
import { addDays, localDateOf } from "./dates";
import { estimateCost, type PriceIndex, type UnitPrice } from "./pricing";
import type { ISODate } from "./types";
import { sumMoney } from "./money";
import { canConvert, convert, humanize } from "./units";
import type { Need } from "./quantities";
import { roundForShopping } from "./quantities";

export interface LineEstimate {
  /** Suma estimată pentru linie, sau null dacă nu se cunoaște. */
  amount: number | null;
  kind: "manual" | "calculat" | "necunoscut";
  /** Prețul din care s-a calculat (doar pentru „calculat”), ca estimarea să poată fi explicată. */
  price?: UnitPrice;
}

/** Estimarea unei linii, din prețurile magazinului și ale sursei ei (vezi latestUnitPrice). */
export function lineEstimate(item: ShoppingListItem, prices: PriceIndex, today: ISODate | null = null): LineEstimate {
  if (item.estimated_price != null) return { amount: item.estimated_price, kind: "manual" };
  if (item.product_id) {
    const c = estimateCost(prices, item.product_id, item.quantity ?? 1, item.unit, { context: { retailer_id: item.retailer_id, source: item.source }, today });
    if (c) return { amount: c.cost, kind: "calculat", price: c.price };
  }
  return { amount: null, kind: "necunoscut" };
}

/** Eticheta scurtă a unei estimări calculate, când prețul nu e chiar pentru această cumpărătură. */
export function estimateFlag(e: LineEstimate): "alt magazin" | "promoție" | "preț vechi" | null {
  if (e.kind !== "calculat" || !e.price) return null;
  if (e.price.match === "alt_magazin") return "alt magazin";
  if (e.price.promo) return "promoție";
  if (e.price.stale) return "preț vechi";
  return null;
}

export interface RetailerComparison {
  retailer_id: string;
  /** Suma produselor cu preț la acest magazin. */
  total: number;
  priced_count: number;
  /** Produsele nebifate comparate (cu sau fără preț aici). */
  item_count: number;
  promo_count: number;
  stale_count: number;
}

/**
 * Cât ar costa produsele nebifate la fiecare magazin, doar cu prețurile
 * văzute sau plătite chiar acolo (decizia proprietarului, 12 oct. 2026).
 * Produsele fără preț la un magazin nu intră în totalul lui. Primele sunt
 * magazinele cu mai multe produse cu preț, apoi cele mai ieftine.
 */
export function compareRetailers(items: ShoppingListItem[], prices: PriceIndex, today: ISODate | null = null): RetailerComparison[] {
  const todo = items.filter((i) => !i.deleted_at && !i.checked);
  const retailers = new Set<string>();
  for (const i of todo) for (const p of (i.product_id && prices.get(i.product_id)) || []) if (p.retailer_id) retailers.add(p.retailer_id);
  const out: RetailerComparison[] = [];
  for (const retailer_id of retailers) {
    const costs: number[] = [];
    let promo = 0;
    let stale = 0;
    for (const i of todo) {
      if (!i.product_id) continue;
      const c = estimateCost(prices, i.product_id, i.quantity ?? 1, i.unit, { context: { retailer_id, source: i.source }, retailer_only: true, today });
      if (!c) continue;
      costs.push(c.cost);
      if (c.price.promo) promo++;
      if (c.price.stale) stale++;
    }
    if (costs.length === 0) continue;
    out.push({ retailer_id, total: sumMoney(costs), priced_count: costs.length, item_count: todo.length, promo_count: promo, stale_count: stale });
  }
  return out.sort((a, b) => b.priced_count - a.priced_count || a.total - b.total);
}

export interface ListTotals {
  /** Valoarea estimată a întregii liste (bifate + nebifate), cu prețurile cunoscute. */
  estimated_total: number;
  /** Cât s-a plătit efectiv pe produsele bifate cu preț introdus. */
  spent: number;
  /** Estimarea produselor rămase de cumpărat. */
  remaining_estimate: number;
  /** spent + remaining_estimate: unde va ajunge nota. */
  projected_total: number;
  item_count: number;
  checked_count: number;
  unknown_price_count: number;
  checked_without_price_count: number;
  /**
   * Produse nebifate fără preț estimat: costul de cumpărat e incomplet. Cele
   * bifate fără sumă apar deja în buget ca „fără sumă” (spendRecords).
   */
  remaining_unknown_count: number;
}

export function listTotals(items: ShoppingListItem[], prices: PriceIndex, today: ISODate | null = null): ListTotals {
  const live = items.filter((i) => !i.deleted_at);
  const estimates: number[] = [];
  const spent: number[] = [];
  const remaining: number[] = [];
  let unknown = 0;
  let checkedNoPrice = 0;
  let remainingUnknown = 0;
  for (const i of live) {
    const e = lineEstimate(i, prices, today);
    if (e.amount == null) unknown++;
    else estimates.push(e.amount);
    if (e.amount == null && !i.checked) remainingUnknown++;
    if (i.checked) {
      if (i.actual_price != null) spent.push(i.actual_price);
      else {
        checkedNoPrice++;
        if (e.amount != null) remaining.push(e.amount);
      }
    } else if (e.amount != null) remaining.push(e.amount);
  }
  const spentSum = sumMoney(spent);
  const remainingSum = sumMoney(remaining);
  return {
    estimated_total: sumMoney(estimates),
    spent: spentSum,
    remaining_estimate: remainingSum,
    projected_total: sumMoney([spentSum, remainingSum]),
    item_count: live.length,
    checked_count: live.filter((i) => i.checked).length,
    unknown_price_count: unknown,
    checked_without_price_count: checkedNoPrice,
    remaining_unknown_count: remainingUnknown,
  };
}

export interface CategoryGroup {
  category: ProductCategory | null;
  items: ShoppingListItem[];
}

/** Grupează produsele pe categorii, în ordinea raioanelor; bifatele coboară la final în fiecare grup. */
export function groupByCategory(items: ShoppingListItem[], categories: ProductCategory[]): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, CategoryGroup>();
  for (const i of items) {
    if (i.deleted_at) continue;
    const cat = byId.get(i.category_id) ?? null;
    const k = cat?.id ?? "_";
    if (!groups.has(k)) groups.set(k, { category: cat, items: [] });
    groups.get(k)!.items.push(i);
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.items.sort(
      (a, b) =>
        Number(a.checked) - Number(b.checked) ||
        Number(b.priority === "ridicata") - Number(a.priority === "ridicata") ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name, "ro"),
    );
  }
  out.sort((a, b) => (a.category?.sort_order ?? 999) - (b.category?.sort_order ?? 999));
  return out;
}

export type MergeOp =
  | { kind: "update"; item_id: string; quantity: number | null; unit: UnitCode | null }
  | { kind: "insert"; need: Need };

/**
 * Cum se adaugă nevoi într-o listă existentă: dacă produsul e deja în listă,
 * nebifat și cu unitate compatibilă, i se mărește cantitatea; altfel se
 * adaugă o linie nouă. Așa nu apar dubluri când generezi lista din plan.
 */
export function planMerge(existing: ShoppingListItem[], needs: Need[]): MergeOp[] {
  const ops: MergeOp[] = [];
  const pending = new Map<string, { quantity: number | null; unit: UnitCode | null }>();
  for (const n of needs) {
    const target = existing.find(
      (i) =>
        !i.deleted_at &&
        !i.checked &&
        i.product_id === n.product_id &&
        ((n.quantity == null) || i.quantity == null || (i.unit != null && n.unit != null && canConvert(i.unit, n.unit))),
    );
    if (!target) {
      const q = n.quantity != null && n.unit ? roundForShopping(n.quantity, n.unit) : n.quantity;
      ops.push({ kind: "insert", need: { ...n, quantity: q } });
      continue;
    }
    const current = pending.get(target.id) ?? { quantity: target.quantity, unit: target.unit };
    if (n.quantity == null) continue; // produsul e deja pe listă
    if (current.quantity == null || !current.unit) {
      pending.set(target.id, { quantity: n.quantity, unit: n.unit });
      continue;
    }
    const sum = current.quantity + convert(n.quantity, n.unit!, current.unit)!;
    const h = humanize(sum, current.unit);
    pending.set(target.id, { quantity: roundForShopping(h.quantity, h.unit), unit: h.unit });
  }
  for (const [item_id, v] of pending) ops.push({ kind: "update", item_id, quantity: v.quantity, unit: v.unit });
  return ops;
}

export interface QuickSuggestion {
  product_id: string;
  name: string;
  /** „terminat”: s-a terminat în cămară; „des”: îl cumperi des și nu mai e acasă. */
  reason: "terminat" | "des";
}

/**
 * Sugestiile de sub listă: întâi produsele terminate în cămară, apoi cele
 * cumpărate de cel puțin 2 ori în ultimele `days` zile și care nu mai sunt
 * acasă. Nimic din ce e deja pe listă (bifat sau nu).
 */
export function quickSuggestions(input: {
  listProductIds: Iterable<string>;
  pantry: Pick<PantryItem, "product_id" | "name" | "quantity" | "deleted_at">[];
  history: Pick<ShoppingTransactionItem, "product_id" | "name" | "purchased_at" | "deleted_at">[];
  today: ISODate;
  days?: number;
  limit?: number;
}): QuickSuggestion[] {
  const { today, days = 60, limit = 6 } = input;
  const taken = new Set(input.listProductIds);
  const atHome = new Set(input.pantry.filter((p) => !p.deleted_at && p.product_id && p.quantity > 0).map((p) => p.product_id!));
  const out: QuickSuggestion[] = [];
  const push = (s: QuickSuggestion) => {
    if (taken.has(s.product_id) || out.length >= limit) return;
    taken.add(s.product_id);
    out.push(s);
  };
  for (const p of input.pantry) {
    if (!p.deleted_at && p.product_id && p.quantity <= 0 && !atHome.has(p.product_id)) push({ product_id: p.product_id, name: p.name, reason: "terminat" });
  }
  const from = addDays(today, -days);
  const counts = new Map<string, { name: string; n: number; last: string }>();
  for (const h of input.history) {
    if (h.deleted_at || !h.product_id) continue;
    const day = localDateOf(h.purchased_at);
    if (day < from || day > today) continue;
    const c = counts.get(h.product_id) ?? { name: h.name, n: 0, last: "" };
    counts.set(h.product_id, { name: c.name, n: c.n + 1, last: day > c.last ? day : c.last });
  }
  [...counts.entries()]
    .filter(([id, c]) => c.n >= 2 && !atHome.has(id))
    .sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last) || a[1].name.localeCompare(b[1].name, "ro"))
    .forEach(([product_id, c]) => push({ product_id, name: c.name, reason: "des" }));
  return out;
}
