import type { ShoppingListItem, ProductCategory, UnitCode } from "./types";
import { estimateCost, type PriceIndex } from "./pricing";
import { sumMoney } from "./money";
import { canConvert, convert, humanize } from "./units";
import type { Need } from "./quantities";
import { roundForShopping } from "./quantities";

export interface LineEstimate {
  /** Suma estimată pentru linie, sau null dacă nu se cunoaște. */
  amount: number | null;
  kind: "manual" | "calculat" | "necunoscut";
}

export function lineEstimate(item: ShoppingListItem, prices: PriceIndex): LineEstimate {
  if (item.estimated_price != null) return { amount: item.estimated_price, kind: "manual" };
  if (item.product_id) {
    const c = estimateCost(prices, item.product_id, item.quantity ?? 1, item.unit);
    if (c) return { amount: c.cost, kind: "calculat" };
  }
  return { amount: null, kind: "necunoscut" };
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
  /** Produse care încă nu au nici sumă plătită, nici preț estimat: costul listei e incomplet. */
  remaining_unknown_count: number;
}

export function listTotals(items: ShoppingListItem[], prices: PriceIndex): ListTotals {
  const live = items.filter((i) => !i.deleted_at);
  const estimates: number[] = [];
  const spent: number[] = [];
  const remaining: number[] = [];
  let unknown = 0;
  let checkedNoPrice = 0;
  let remainingUnknown = 0;
  for (const i of live) {
    const e = lineEstimate(i, prices);
    if (e.amount == null) unknown++;
    else estimates.push(e.amount);
    if (e.amount == null && !(i.checked && i.actual_price != null)) remainingUnknown++;
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

/**
 * Cât mai adaugă lista la buget. Cheltuiala intră în buget abia la „Termină
 * cumpărăturile”, așa că până atunci contează și sumele deja plătite pe
 * listă, plus estimarea restului. O listă arhivată e deja în buget.
 */
export function unrecordedCost(t: ListTotals, archived: boolean): number {
  return archived ? 0 : t.projected_total;
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
