import { describe, expect, it } from "vitest";
import { groupByCategory, listTotals, planMerge, unrecordedCost } from "./shopping";
import { buildPriceIndex } from "./pricing";
import { category, listItem, price } from "@/test/factories";

const prices = buildPriceIndex([price({ product_id: "rosii", amount: 12, quantity: 1, unit: "kg" })]);

describe("totalurile listei", () => {
  it("estimează din prețuri, folosește suma reală la bifate și numără prețurile lipsă", () => {
    const items = [
      listItem({ product_id: "rosii", quantity: 2, unit: "kg" }), // 24 estimat
      listItem({ name: "Pâine", estimated_price: 6 }), // estimare manuală
      listItem({ name: "Detergent" }), // fără preț
      listItem({ product_id: "rosii", quantity: 0.5, unit: "kg", checked: true, actual_price: 7.5 }), // estimat 6, plătit 7,5
      listItem({ name: "Lapte", checked: true, estimated_price: 9 }), // bifat fără preț real
      listItem({ name: "Șters", estimated_price: 100, deleted_at: "2026-03-01T00:00:00Z" }),
    ];
    const t = listTotals(items, prices);
    expect(t.estimated_total).toBe(24 + 6 + 6 + 9);
    expect(t.spent).toBe(7.5);
    expect(t.remaining_estimate).toBe(24 + 6 + 9);
    expect(t.projected_total).toBe(46.5);
    expect(t.item_count).toBe(5);
    expect(t.checked_count).toBe(2);
    expect(t.unknown_price_count).toBe(1);
    expect(t.checked_without_price_count).toBe(1);
  });
});

describe("gruparea pe categorii", () => {
  it("respectă ordinea raioanelor și coboară produsele bifate", () => {
    const cats = [category({ id: "legume", sort_order: 2 }), category({ id: "fructe", sort_order: 1 })];
    const g = groupByCategory(
      [
        listItem({ id: "a", category_id: "legume", name: "Ardei", checked: true }),
        listItem({ id: "b", category_id: "legume", name: "Varză" }),
        listItem({ id: "c", category_id: "fructe", name: "Mere" }),
      ],
      cats,
    );
    expect(g.map((x) => x.category?.id)).toEqual(["fructe", "legume"]);
    expect(g[1].items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("adăugarea în listă fără dubluri", () => {
  it("mărește cantitatea produsului existent și adaugă restul", () => {
    const existing = [listItem({ id: "x", product_id: "piept-pui", quantity: 500, unit: "g" })];
    const ops = planMerge(existing, [
      { product_id: "piept-pui", quantity: 300, unit: "g" },
      { product_id: "piept-pui", quantity: 0.5, unit: "kg" },
      { product_id: "oua", quantity: 1.5, unit: "buc" },
    ]);
    expect(ops).toContainEqual({ kind: "update", item_id: "x", quantity: 1.3, unit: "kg" });
    expect(ops).toContainEqual({ kind: "insert", need: { product_id: "oua", quantity: 2, unit: "buc" } });
    expect(ops).toHaveLength(2);
  });

  it("nu modifică produsele deja bifate", () => {
    const existing = [listItem({ id: "x", product_id: "oua", quantity: 10, unit: "buc", checked: true })];
    expect(planMerge(existing, [{ product_id: "oua", quantity: 4, unit: "buc" }])).toEqual([
      { kind: "insert", need: { product_id: "oua", quantity: 4, unit: "buc" } },
    ]);
  });

  it("nu dublează un produs „după gust” deja pe listă", () => {
    const existing = [listItem({ id: "x", product_id: "sare", quantity: 1, unit: "pachet" })];
    expect(planMerge(existing, [{ product_id: "sare", quantity: null, unit: null }])).toEqual([]);
  });
});

describe("lista în curs și bugetul", () => {
  const items = [
    listItem({ product_id: "rosii", quantity: 1, unit: "kg", checked: true, actual_price: 15 }), // plătit, neînregistrat încă
    listItem({ product_id: "rosii", quantity: 1, unit: "kg", checked: true }), // bifat fără sumă, estimat 12
    listItem({ name: "Pâine" }), // nebifat, fără preț
    listItem({ name: "Lapte", checked: true }), // bifat, fără sumă și fără preț
    listItem({ product_id: "rosii", quantity: 2, unit: "kg" }), // nebifat, estimat 24
  ];

  it("până la finalizare, bugetul include și ce s-a plătit deja pe listă", () => {
    const t = listTotals(items, prices);
    expect(unrecordedCost(t, false)).toBe(15 + 12 + 24);
    // După finalizare (lista arhivată), cheltuiala e deja în buget: nu se numără de două ori.
    expect(unrecordedCost(t, true)).toBe(0);
  });

  it("numără corect produsele încă fără preț", () => {
    expect(listTotals(items, prices).remaining_unknown_count).toBe(2);
  });
});
