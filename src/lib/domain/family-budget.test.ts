import { describe, expect, it } from "vitest";
import { budget, category, txItem } from "@/test/factories";
import { averageTrip, budgetStatus, byExpenseCategory, byRetailer, manualExpenseRecord, monthlyTotals, spendToCsv } from "./budget";
import type { ManualExpense } from "./types";

const categories = new Map([
  ["legume", category({ id: "legume", name: "Legume" })],
  ["curatenie", category({ id: "curatenie", name: "Curățenie", is_food: false })],
]);
const expense: ManualExpense = {
  id: "manual1", household_id: "h1", description: "After-school", category_id: "educatie", amount: 800,
  spent_on: "2026-03-05", created_at: "2026-03-05T10:00:00Z", updated_at: "2026-03-05T10:00:00Z", deleted_at: null,
};
const groceries = txItem({ category_id: "legume", amount: 100, purchased_at: "2026-03-05T09:00:00Z" });

describe("bugetul familiei", () => {
  it("combină plățile fără a schimba sensul bugetelor vechi", () => {
    const records = [groceries, manualExpenseRecord(expense)];
    const today = "2026-03-08";
    expect(budgetStatus(budget({ scope: { kind: "familie" }, amount: 1000 }), records, categories, today)).toMatchObject({ spent: 900, remaining: 100 });
    expect(budgetStatus(budget({ scope: { kind: "cheltuiala", category_id: "educatie" } }), records, categories, today).spent).toBe(800);
    expect(budgetStatus(budget({ scope: { kind: "cheltuiala", category_id: "alimentatie" } }), records, categories, today).spent).toBe(100);
    expect(budgetStatus(budget({ scope: { kind: "cheltuiala", category_id: "transport" } }), records, categories, today).spent).toBe(0);
    for (const kind of ["total", "alimente"] as const) expect(budgetStatus(budget({ scope: { kind } }), records, categories, today).spent).toBe(100);
    expect(budgetStatus(budget({ scope: { kind: "sursa", source: "alta" } }), records, categories, today).spent).toBe(0);
    expect(budgetStatus(budget({ scope: { kind: "categorie", category_id: "legume" } }), records, categories, today).spent).toBe(100);
  });

  it("grupează cumpărăturile și manualele în categoriile generale", () => {
    const records = [groceries, txItem({ category_id: "curatenie", amount: 50 }), manualExpenseRecord(expense), manualExpenseRecord({ ...expense, id: "taxi", category_id: "transport", amount: 20 })];
    expect(byExpenseCategory(records, categories)).toEqual([
      { key: "educatie", label: "Școala și educația copiilor", amount: 800 },
      { key: "alimentatie", label: "Alimentație", amount: 100 },
      { key: "ingrijire", label: "Îngrijire personală și curățenie", amount: 50 },
      { key: "transport", label: "Transport și mașină", amount: 20 },
    ]);
    expect(averageTrip(records)).toBe(150);
    expect(byRetailer(records, new Map()).reduce((n, r) => n + r.amount, 0)).toBe(150);
  });

  it("folosește ziua plății și exclude ștergerile din grafice", () => {
    const records = [groceries, manualExpenseRecord({ ...expense, spent_on: "2026-02-28" }), manualExpenseRecord({ ...expense, id: "deleted", amount: 999, deleted_at: "2026-03-06T00:00:00Z" })];
    expect(monthlyTotals(records, "2026-03-08", 2).map((m) => m.amount)).toEqual([800, 100]);
  });

  it("exportă manualele cu categorie, tip și descriere sigură pentru Excel", () => {
    const csv = spendToCsv([manualExpenseRecord({ ...expense, description: "=Școală; Ana" })], categories, new Map());
    expect(csv).toContain("Școala și educația copiilor");
    expect(csv).toContain("Cheltuială manuală");
    expect(csv).toContain("800,00");
    expect(csv).toContain("\"'=Școală; Ana\"");
    expect(csv).toContain("2026-03-05");
  });
});
