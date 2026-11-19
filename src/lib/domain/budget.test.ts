import { describe, expect, it } from "vitest";
import { averageTrip, budgetStatus, byCategory, diverseGroups, manualExpenseRecord, monthlyTotals, sanitizeCsvFormula, spendToCsv, weeklyTotals } from "./budget";
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

  it("fixture de regresie: 2 bonuri (100 și 50 RON) cu mai multe produse, plus cheltuială manuală de 40 RON => media este 75 RON", () => {
    const records = [
      // Bon 1 (100 RON): 2 produse (60 RON și 40 RON)
      txItem({ transaction_id: "bon-1", name: "Pâine", amount: 60 }),
      txItem({ transaction_id: "bon-1", name: "Lapte", amount: 40 }),
      // Bon 2 (50 RON): 2 produse (30 RON și 20 RON)
      txItem({ transaction_id: "bon-2", name: "Mere", amount: 30 }),
      txItem({ transaction_id: "bon-2", name: "Pere", amount: 20 }),
      // Cheltuială manuală (40 RON)
      manualExpenseRecord({
        id: "m1",
        household_id: "h1",
        category_id: "locuinta",
        description: "Factură curent",
        amount: 40,
        spent_on: "2026-03-05",
        created_at: "2026-03-05T00:00:00Z",
        updated_at: "2026-03-05T00:00:00Z",
        deleted_at: null,
      }),
    ];
    // Media cumpărăturilor este (100 + 50) / 2 = 75 RON, nu (60+40+30+20)/4 = 37.5 RON și nici 95 RON
    expect(averageTrip(records)).toBe(75);
  });

  it("gestionează cazurile limită ale mediei unei ieșiri: bon fără prețuri, tranzacție ștearsă, total declarat fără linii, mai multe categorii și lună fără cumpărături", () => {
    // Lună fără cumpărături
    expect(averageTrip([])).toBeNull();
    expect(
      averageTrip([
        manualExpenseRecord({
          id: "m1",
          household_id: "h1",
          category_id: "locuinta",
          description: "Factură curent",
          amount: 50,
          spent_on: "2026-03-05",
          created_at: "2026-03-05T00:00:00Z",
          updated_at: "2026-03-05T00:00:00Z",
          deleted_at: null,
        }),
      ]),
    ).toBeNull();

    // Bon fără prețuri (amount: null) - nu produce NaN și nu împarte la 0
    const noprice = [
      txItem({ transaction_id: "b1", amount: null }),
      txItem({ transaction_id: "b1", amount: null }),
    ];
    expect(averageTrip(noprice)).toBeNull();

    // Tranzacție ștearsă (deleted_at) este ignorată
    const withDeleted = [
      txItem({ transaction_id: "b1", amount: 100 }),
      txItem({ transaction_id: "b2", amount: 200, deleted_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(averageTrip(withDeleted)).toBe(100);

    // Total declarat fără linii (linie nealocată cu transaction_id b1)
    const declaredWithoutLines = [
      txItem({ transaction_id: "b1", category_id: "nealocat", name: "Diferență nealocată", amount: 80 }),
    ];
    expect(averageTrip(declaredWithoutLines)).toBe(80);

    // Mai multe categorii pe același bon sunt grupate în aceeași tranzacție
    const multiCategory = [
      txItem({ transaction_id: "b1", category_id: "legume", amount: 30 }),
      txItem({ transaction_id: "b1", category_id: "curatenie", amount: 70 }),
    ];
    expect(averageTrip(multiCategory)).toBe(100);

    // Linii în curs (pending shopping list) sunt ignorate
    const withPending = [
      txItem({ transaction_id: "b1", amount: 50 }),
      txItem({ transaction_id: "in-curs:list-1", amount: 30 }),
    ];
    expect(averageTrip(withPending)).toBe(50);
  });

  it("exportă CSV cu separator „;” și virgulă zecimală", () => {
    const csv = spendToCsv([items[0]], cats, new Map<string, Retailer>());
    expect(csv.startsWith("﻿Data;Produs")).toBe(true);
    expect(csv).toContain("2026-03-02;Produs;1;buc;Legume;;Piață;100,00");
  });

  it("neutralizează caracterele periculoase de formulă (=, +, -, @) prin sanitizeCsvFormula (F10)", () => {
    // Verificare directă pe toate cele 4 caractere periculoase cerute de F10
    expect(sanitizeCsvFormula("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvFormula("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(sanitizeCsvFormula("-2+5")).toBe("'-2+5");
    expect(sanitizeCsvFormula("@cmd")).toBe("'@cmd");

    // Cu spații albe sau tab la început
    expect(sanitizeCsvFormula("  =2*3")).toBe("'  =2*3");
    expect(sanitizeCsvFormula("\t+cmd")).toBe("'\t+cmd");
    expect(sanitizeCsvFormula("   -10")).toBe("'   -10");
    expect(sanitizeCsvFormula("\n@exec")).toBe("'\n@exec");

    // Șiruri inofensive
    expect(sanitizeCsvFormula("Lapte")).toBe("Lapte");
    expect(sanitizeCsvFormula("123")).toBe("123");
    expect(sanitizeCsvFormula("")).toBe("");
  });

  it("neutralizează formulele spreadsheet în exportul CSV pentru toate caracterele (=, +, -, @) (F10)", () => {
    const dangerousItem1 = txItem({
      name: "=1+1",
      category_id: "legume",
      amount: 10,
      source: "supermarket",
      retailer_id: "ret1",
      purchased_at: "2026-03-02T08:00:00Z",
    });
    const dangerousItem2 = txItem({
      name: "-2+5",
      unit: "buc",
      category_id: "legume",
      amount: 15,
      source: "supermarket",
      retailer_id: "ret1",
      purchased_at: "2026-03-03T08:00:00Z",
    });
    const dangerousRetailers = new Map<string, Retailer>([
      ["ret1", { id: "ret1", household_id: "h1", created_at: "", updated_at: "", deleted_at: null, name: "+Magazin", kind: "supermarket", details: null }],
    ]);
    const dangerousCats = new Map<string, ProductCategory>([
      ["legume", category({ id: "legume", name: "@Categorii" })],
    ]);
    const csv = spendToCsv([dangerousItem1, dangerousItem2], dangerousCats, dangerousRetailers);
    expect(csv).toContain("2026-03-02;'=1+1;1;buc;'@Categorii;'+Magazin;Supermarket;10,00");
    expect(csv).toContain("2026-03-03;'-2+5;1;buc;'@Categorii;'+Magazin;Supermarket;15,00");
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
