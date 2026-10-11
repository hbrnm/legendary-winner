import type { Budget, ISODate, ProductCategory, PurchaseSource, Retailer, ShoppingTransactionItem } from "./types";
import { addDays, inPeriod, localDateOf, monthPeriod, startOfMonth, weekPeriod, type Period } from "./dates";
import { roundMoney, sumMoney } from "./money";

// Cheltuiala reală vine DOAR din liniile de tranzacție (produse bifate la
// cumpărături). Bugetul planificat e o altă entitate. O linie de listă mutată
// în altă listă își păstrează id-ul, iar linia de tranzacție e unică per
// (tranzacție, linie de listă), deci nu se numără de două ori.

export function liveSpend(items: ShoppingTransactionItem[]): ShoppingTransactionItem[] {
  return items.filter((i) => !i.deleted_at);
}

export function spendInPeriod(items: ShoppingTransactionItem[], period: Period): ShoppingTransactionItem[] {
  return liveSpend(items).filter((i) => inPeriod(localDateOf(i.purchased_at), period));
}

export function sumAmounts(items: ShoppingTransactionItem[]): number {
  return sumMoney(items.map((i) => i.amount ?? 0));
}

export function matchesScope(item: ShoppingTransactionItem, budget: Budget, categories: Map<string, ProductCategory>): boolean {
  const s = budget.scope;
  switch (s.kind) {
    case "total":
      return true;
    case "alimente":
      return categories.get(item.category_id)?.is_food ?? true;
    case "nealimentare":
      return categories.get(item.category_id)?.is_food === false;
    case "sursa":
      return sourceGroup(item.source) === sourceGroup(s.source);
    case "categorie":
      return item.category_id === s.category_id;
    case "magazin":
      return item.retailer_id === s.retailer_id;
  }
}

/** Piața și producătorul local se tratează împreună la buget („piață”). */
function sourceGroup(s: PurchaseSource): string {
  return s === "producator" ? "piata" : s;
}

export function budgetPeriod(budget: Budget, today: ISODate): Period {
  return budget.period === "lunar" ? monthPeriod(today) : weekPeriod(today);
}

export interface BudgetStatus {
  budget: Budget;
  period: Period;
  spent: number;
  remaining: number;
  /** 0–100+ */
  used_pct: number;
  over: boolean;
  /** Linii bifate fără sumă introdusă: cheltuiala reală poate fi mai mare. */
  items_without_amount: number;
  /** Proiecție liniară până la sfârșitul perioadei (doar după primele zile). */
  projected: number | null;
}

export function budgetStatus(
  budget: Budget,
  items: ShoppingTransactionItem[],
  categories: Map<string, ProductCategory>,
  today: ISODate,
): BudgetStatus {
  const period = budgetPeriod(budget, today);
  const scoped = spendInPeriod(items, period).filter((i) => matchesScope(i, budget, categories));
  const spent = sumAmounts(scoped);
  const remaining = roundMoney(budget.amount - spent);
  const daysTotal = dayCount(period);
  const daysElapsed = dayCount({ from: period.from, to: today });
  const projected = budget.period === "lunar" && daysElapsed >= 5 && daysElapsed < daysTotal ? roundMoney((spent / daysElapsed) * daysTotal) : null;
  return {
    budget,
    period,
    spent,
    remaining,
    used_pct: budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0,
    over: spent > budget.amount,
    items_without_amount: scoped.filter((i) => i.amount == null).length,
    projected,
  };
}

function dayCount(p: Period): number {
  let n = 0;
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) n++;
  return n;
}

export interface Breakdown {
  key: string;
  label: string;
  amount: number;
}

export function breakdownBy(
  items: ShoppingTransactionItem[],
  keyOf: (i: ShoppingTransactionItem) => string,
  labelOf: (key: string) => string,
): Breakdown[] {
  const sums = new Map<string, number[]>();
  for (const i of liveSpend(items)) {
    if (i.amount == null) continue;
    const k = keyOf(i);
    const list = sums.get(k) ?? [];
    list.push(i.amount);
    sums.set(k, list);
  }
  return [...sums.entries()]
    .map(([key, v]) => ({ key, label: labelOf(key), amount: sumMoney(v) }))
    .sort((a, b) => b.amount - a.amount);
}

export function byCategory(items: ShoppingTransactionItem[], categories: Map<string, ProductCategory>): Breakdown[] {
  return breakdownBy(items, (i) => i.category_id, (k) => categories.get(k)?.name ?? "Altele");
}

export function byRetailer(items: ShoppingTransactionItem[], retailers: Map<string, Retailer>): Breakdown[] {
  return breakdownBy(
    items,
    (i) => i.retailer_id ?? `sursa:${sourceGroup(i.source)}`,
    (k) => retailers.get(k)?.name ?? SOURCE_LABELS[k.replace("sursa:", "") as PurchaseSource] ?? "Nespecificat",
  );
}

export const SOURCE_LABELS: Record<PurchaseSource, string> = {
  supermarket: "Supermarket",
  piata: "Piață",
  producator: "Producător local",
  alta: "Altă sursă",
};

export interface PeriodTotal {
  period: Period;
  amount: number;
}

/** Totalurile pe ultimele `count` luni (cea curentă ultima). */
export function monthlyTotals(items: ShoppingTransactionItem[], today: ISODate, count: number): PeriodTotal[] {
  const out: PeriodTotal[] = [];
  let anchor = startOfMonth(today);
  for (let k = 0; k < count; k++) {
    const p = monthPeriod(anchor);
    out.unshift({ period: p, amount: sumAmounts(spendInPeriod(items, p)) });
    anchor = startOfMonth(addDays(anchor, -1));
  }
  return out;
}

export function weeklyTotals(items: ShoppingTransactionItem[], today: ISODate, count: number): PeriodTotal[] {
  const out: PeriodTotal[] = [];
  let anchor = weekPeriod(today).from;
  for (let k = 0; k < count; k++) {
    const p = weekPeriod(anchor);
    out.unshift({ period: p, amount: sumAmounts(spendInPeriod(items, p)) });
    anchor = addDays(anchor, -7);
  }
  return out;
}

/** Valoarea medie a unei ieșiri la cumpărături (tranzacții cu cel puțin o sumă). */
export function averageTrip(items: ShoppingTransactionItem[]): number | null {
  const byTx = new Map<string, number[]>();
  for (const i of liveSpend(items)) {
    if (i.amount == null) continue;
    const list = byTx.get(i.transaction_id) ?? [];
    list.push(i.amount);
    byTx.set(i.transaction_id, list);
  }
  if (byTx.size === 0) return null;
  return roundMoney(sumMoney([...byTx.values()].map(sumMoney)) / byTx.size);
}

/** Export CSV (separator „;”, cum îl deschide Excel în română; BOM pentru diacritice). */
export function spendToCsv(
  items: ShoppingTransactionItem[],
  categories: Map<string, ProductCategory>,
  retailers: Map<string, Retailer>,
): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Data", "Produs", "Cantitate", "Unitate", "Categorie", "Magazin", "Sursă", "Sumă (RON)"]];
  for (const i of [...liveSpend(items)].sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))) {
    rows.push([
      localDateOf(i.purchased_at),
      i.name,
      i.quantity == null ? "" : String(i.quantity).replace(".", ","),
      i.unit ?? "",
      categories.get(i.category_id)?.name ?? "",
      i.retailer_id ? retailers.get(i.retailer_id)?.name ?? "" : "",
      SOURCE_LABELS[i.source],
      i.amount == null ? "" : i.amount.toFixed(2).replace(".", ","),
    ]);
  }
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
