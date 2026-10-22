import { describe, expect, it } from "vitest";
import { averageTrip, budgetStatus, byCategory, diverseGroups, monthlyTotals, spendToCsv, weeklyTotals } from "./budget";
import { normalize } from "./search";
import { budget, category, txItem } from "@/test/factories";
import type { ProductCategory, Retailer } from "./types";

const cats = new Map<string, ProductCategory>([
  ["legume", category({ id: "legume", name: "Legume" })],
  ["curatenie", category({ id: "curatenie", name: "Produse de curățenie", is_food: false })],
]);

const items = [
  txItem({ transaction_id: "t1", category_id: "legume", amount: 100, source: "piata", purchased_at: "2026-03-02T08:00:00Z" }),
  txItem({ transaction_id: "t1", category_id: "curatenie", amount: 50, source: "supermarket", retailer_id: "lidl", purchased_at: "2026-03-02T08:10:00Z" }),
  txItem({ transaction_id: "t2", category_id: "legume", amount: 30.5, source: "producator", purchased_at: "2026-03-20T08:00:00Z" }),
  txItem({ transaction_id: "t2", category_id: "legume", amount: null, purchased_at: "2026-03-20T08:00:00Z" }),
  txItem({ transaction_id: "t3", category_id: "legume", amount: 999, purchased_at: "2026-02-27T08:00:00Z" }), // altă lună
  txItem({ transaction_id: "t4", category_id: "legume", amount: 500, purchased_at: "2026-03-05T08:00:00Z", deleted_at: "2026-03-05T09:00:00Z" }),
];

describe("starea bugetului", () => {
  it("adună doar cheltuielile reale din perioadă", () => {
    const s = budgetStatus(budget({ amount: 1000 }), items, cats, "2026-03-25");
    expect(s.spent).toBe(180.5);
    expect(s.remaining).toBe(819.5);
    expect(s.used_pct).toBe(18);
    expect(s.over).toBe(false);
    expect(s.items_without_amount).toBe(1);
    expect(s.period).toEqual({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("filtrează după tipul bugetului", () => {
    const today = "2026-03-25";
    expect(budgetStatus(budget({ scope: { kind: "alimente" } }), items, cats, today).spent).toBe(130.5);
    expect(budgetStatus(budget({ scope: { kind: "nealimentare" } }), items, cats, today).spent).toBe(50);
    // Piața include și producătorii locali.
    expect(budgetStatus(budget({ scope: { kind: "sursa", source: "piata" } }), items, cats, today).spent).toBe(130.5);
    expect(budgetStatus(budget({ scope: { kind: "magazin", retailer_id: "lidl" } }), items, cats, today).spent).toBe(50);
  });

  it("semnalează depășirea și bugetul săptămânal", () => {
    const s = budgetStatus(budget({ amount: 120, period: "saptamanal" }), items, cats, "2026-03-04");
    expect(s.period).toEqual({ from: "2026-03-02", to: "2026-03-08" });
    expect(s.spent).toBe(150);
    expect(s.over).toBe(true);
    expect(s.remaining).toBe(-30);
  });
});

describe("rapoarte", () => {
  it("compară lunile și săptămânile", () => {
    expect(monthlyTotals(items, "2026-03-25", 2).map((m) => m.amount)).toEqual([999, 180.5]);
    expect(weeklyTotals(items, "2026-03-25", 4).map((w) => w.amount)).toEqual([150, 0, 30.5, 0]);
  });

  it("împarte pe categorii și calculează media unei ieșiri", () => {
    expect(byCategory(items, cats)[0]).toEqual({ key: "legume", label: "Legume", amount: 1129.5 });
    expect(averageTrip(items)).toBe(Math.round(((150 + 30.5 + 999) / 3) * 100) / 100);
  });

  it("exportă CSV cu separator „;” și virgulă zecimală", () => {
    const csv = spendToCsv([items[0]], cats, new Map<string, Retailer>());
    expect(csv.startsWith("﻿Data;Produs")).toBe(true);
    expect(csv).toContain("2026-03-02;Produs;1;buc;Legume;;Piață;100,00");
  });
});

describe("cumpărăturile din „Diverse” (.tasks/016)", () => {
  it("adunate pe produs sau, fără produs, pe nume; eticheta de pe cel mai recent bon; cele mai scumpe primele", () => {
    const g = diverseGroups(
      [
        txItem({ product_id: "p-unt", name: "Unt de arahide", receipt_name: "Unt arahide Lidl", amount: 24.99, purchased_at: "2026-03-12T09:00:00Z" }),
        txItem({ product_id: "p-unt", name: "Unt de arahide", amount: 22.5, purchased_at: "2026-03-01T09:00:00Z" }),
        txItem({ name: "Pungă", amount: 0.5 }),
        txItem({ name: "pungă ", amount: 0.5, purchased_at: "2026-03-11T09:00:00Z" }),
        txItem({ name: "Pungă", amount: 9, deleted_at: "2026-03-11T10:00:00Z" }),
        txItem({ product_id: "lapte", name: "Lapte", category_id: "lactate", amount: 5 }),
      ],
      normalize,
    );
    expect(g).toEqual([
      { key: "p-unt", product_id: "p-unt", label: "Unt arahide Lidl", count: 2, total: 47.49, last_bought: "2026-03-12" },
      { key: `nume:${normalize("Pungă")}`, product_id: null, label: "pungă", count: 2, total: 1, last_bought: "2026-03-11" },
    ]);
  });
});
