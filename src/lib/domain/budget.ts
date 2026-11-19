import type { Budget, ISODate, ManualExpense, ProductCategory, PurchaseSource, Retailer, SpendRecord } from "./types";
import { expenseCategoryName, type ExpenseCategoryId } from "./expense-categories";
import { addDays, inPeriod, localDateOf, monthPeriod, startOfMonth, weekPeriod, type Period } from "./dates";
import { roundMoney, sumMoney } from "./money";

// Cheltuiala reală vine din plăți manuale și din liniile de tranzacție (produse bifate la
// cumpărături). Bugetul planificat e o altă entitate. O linie de listă mutată
// în altă listă își păstrează id-ul, iar linia de tranzacție e unică per
// (tranzacție, linie de listă), deci nu se numără de două ori.

export function liveSpend(items: SpendRecord[]): SpendRecord[] {
  return items.filter((i) => !i.deleted_at);
}

export function spendInPeriod(items: SpendRecord[], period: Period): SpendRecord[] {
  return liveSpend(items).filter((i) => inPeriod(localDateOf(i.purchased_at), period));
}

export function sumAmounts(items: SpendRecord[]): number {
  return sumMoney(items.map((i) => i.amount ?? 0));
}

export function matchesScope(item: SpendRecord, budget: Budget, categories: Map<string, ProductCategory>): boolean {
  const s = budget.scope;
  if (s.kind === "familie") return true;
  if (s.kind === "cheltuiala") return expenseCategoryOf(item, categories) === s.category_id;
  if (item.unallocated) return s.kind === "total" || (s.kind === "magazin" && item.retailer_id === s.retailer_id);
  // Scopurile istorice rămân exclusiv pentru cumpărături.
  if (item.manual_expense_id) return false;
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

export function expenseCategoryOf(item: SpendRecord, categories: Map<string, ProductCategory>): ExpenseCategoryId | null {
  if (item.unallocated) return null;
  if (item.expense_category_id) return item.expense_category_id;
  if (item.category_id === "igiena" || item.category_id === "curatenie") return "ingrijire";
  return categories.get(item.category_id)?.is_food ? "alimentatie" : "altele";
}

export function manualExpenseRecord(expense: ManualExpense): SpendRecord {
  return {
    ...expense, id: `manual:${expense.id}`, manual_expense_id: expense.id,
    expense_category_id: expense.category_id, category_id: `cheltuiala:${expense.category_id}`,
    name: expense.description, transaction_id: `manual:${expense.id}`,
    list_item_id: null, product_id: null, quantity: null, unit: null,
    retailer_id: expense.retailer_id ?? null, source: expense.source ?? "alta",
    // Data manuală este o zi calendaristică, nu un instant UTC.
    purchased_at: `${expense.spent_on}T12:00:00`,
  };
}

export function byExpenseCategory(items: SpendRecord[], categories: Map<string, ProductCategory>): Breakdown[] {
  return breakdownBy(items, (i) => expenseCategoryOf(i, categories) ?? "nealocat", key => key === "nealocat" ? "Nealocat" : expenseCategoryName(key));
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
  items: SpendRecord[],
  categories: Map<string, ProductCategory>,
  today: ISODate,
): BudgetStatus {
  const period = budgetPeriod(budget, today);
  const scoped = spendInPeriod(items, period).filter((i) => matchesScope(i, budget, categories));
  const spent = sumAmounts(scoped);
  const remaining = roundMoney(budget.amount - spent);
  const daysTotal = dayCount(period);
  const daysElapsed = dayCount({ from: period.from, to: today });
  // Proiecția are sens doar după câteva zile și cumpărături în zile diferite.
  const spendDays = new Set(scoped.map((i) => localDateOf(i.purchased_at))).size;
  const projected = budget.period === "lunar" && daysElapsed >= 7 && spendDays >= 3 && daysElapsed < daysTotal ? roundMoney((spent / daysElapsed) * daysTotal) : null;
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
  items: SpendRecord[],
  keyOf: (i: SpendRecord) => string,
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

export function byCategory(items: SpendRecord[], categories: Map<string, ProductCategory>): Breakdown[] {
  return breakdownBy(items, (i) => i.category_id, (k) => categories.get(k)?.name ?? "Altele");
}

export function byRetailer(items: SpendRecord[], retailers: Map<string, Retailer>): Breakdown[] {
  return breakdownBy(
    items.filter((i) => !i.manual_expense_id),
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
export function monthlyTotals(items: SpendRecord[], today: ISODate, count: number): PeriodTotal[] {
  const out: PeriodTotal[] = [];
  let anchor = startOfMonth(today);
  for (let k = 0; k < count; k++) {
    const p = monthPeriod(anchor);
    out.unshift({ period: p, amount: sumAmounts(spendInPeriod(items, p)) });
    anchor = startOfMonth(addDays(anchor, -1));
  }
  return out;
}

export function weeklyTotals(items: SpendRecord[], today: ISODate, count: number): PeriodTotal[] {
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
export function averageTrip(items: SpendRecord[]): number | null {
  const byTx = new Map<string, number[]>();
  for (const i of liveSpend(items)) {
    if (i.manual_expense_id) continue;
    if (i.transaction_id.startsWith("in-curs")) continue;
    if (i.amount == null) continue;
    const list = byTx.get(i.transaction_id) ?? [];
    list.push(i.amount);
    byTx.set(i.transaction_id, list);
  }
  if (byTx.size === 0) return null;
  return roundMoney(sumMoney([...byTx.values()].map(sumMoney)) / byTx.size);
}

/** Neutralizează prefixele de formulă (=, +, -, @) pentru a preveni formula injection în Excel/Sheets. */
export function sanitizeCsvFormula(v: string): string {
  return /^[\s\t\r\n]*[=+\-@]/.test(v) ? `'${v}` : v;
}

/** Export CSV (separator „;”, cum îl deschide Excel în română; BOM pentru diacritice). */
export function spendToCsv(
  items: SpendRecord[],
  categories: Map<string, ProductCategory>,
  retailers: Map<string, Retailer>,
): string {
  const esc = (v: string) => {
    const safe = sanitizeCsvFormula(v);
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [["Data", "Produs", "Cantitate", "Unitate", "Categorie", "Magazin", "Sursă", "Sumă (RON)", "Categorie de cheltuieli", "Tip"]];
  for (const i of [...liveSpend(items)].sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))) {
    rows.push([
      localDateOf(i.purchased_at),
      i.name,
      i.quantity == null ? "" : String(i.quantity).replace(".", ","),
      i.unit ?? "",
      i.expense_category_id ? expenseCategoryName(i.expense_category_id) : categories.get(i.category_id)?.name ?? "",
      i.retailer_id ? retailers.get(i.retailer_id)?.name ?? "" : "",
      i.manual_expense_id ? "" : SOURCE_LABELS[i.source],
      i.amount == null ? "" : i.amount.toFixed(2).replace(".", ","),
      i.unallocated ? "Nealocat" : expenseCategoryName(expenseCategoryOf(i, categories)!),
      i.manual_expense_id ? "Cheltuială manuală" : "Cumpărături",
    ]);
  }
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

/** Cumpărăturile din „Diverse”, adunate pe produs (sau pe nume, fără produs), pentru mutarea lor (.tasks/016). */
export interface DiverseGroup {
  /** `product_id` sau, fără produs, numele normalizat. */
  key: string;
  product_id: string | null;
  /** Numele de pe cel mai recent bon, altfel numele liniei. */
  label: string;
  count: number;
  total: number;
  last_bought: ISODate;
}

export function diverseGroups(items: SpendRecord[], normalizeName: (s: string) => string): DiverseGroup[] {
  const map = new Map<string, DiverseGroup>();
  // Cele mai vechi întâi, ca eticheta și data să rămână ale celei mai recente cumpărături.
  for (const i of liveSpend(items).sort((a, b) => a.purchased_at.localeCompare(b.purchased_at))) {
    if (i.category_id !== "diverse") continue;
    const key = i.product_id ?? `nume:${normalizeName(i.name)}`;
    const g = map.get(key) ?? { key, product_id: i.product_id, label: "", count: 0, total: 0, last_bought: "" };
    g.count++;
    g.total = roundMoney(g.total + (i.amount ?? 0));
    g.label = (i.receipt_name || i.name).trim();
    g.last_bought = localDateOf(i.purchased_at);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ro"));
}

/** Remaining funds divided by all calendar days left, including today. */
export function dailyBudgetAvailable(remaining: number, today: ISODate): number {
  return remaining <= 0 ? 0 : roundMoney(remaining / dayCount({ from: today, to: monthPeriod(today).to }));
}
