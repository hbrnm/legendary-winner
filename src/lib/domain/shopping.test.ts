import { describe, expect, it } from "vitest";
import { compareRetailers, groupByCategory, listTotals, planMerge, quickSuggestions } from "./shopping";
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
    listItem({ product_id: "rosii", quantity: 1, unit: "kg", checked: true, actual_price: 15 }), // plătit: e deja în buget (spendRecords)
    listItem({ product_id: "rosii", quantity: 1, unit: "kg", checked: true }), // bifat fără sumă, estimat 12
    listItem({ name: "Pâine" }), // nebifat, fără preț
    listItem({ name: "Lapte", checked: true }), // bifat fără sumă: în buget apare ca „fără sumă”
    listItem({ product_id: "rosii", quantity: 2, unit: "kg" }), // nebifat, estimat 24
  ];

  it("estimarea rămasă nu include sumele deja plătite (ele sunt deja în buget)", () => {
    expect(listTotals(items, prices).remaining_estimate).toBe(12 + 24);
  });

  it("numără produsele nebifate încă fără preț", () => {
    // Formula veche (unknown_price_count - checked_without_price_count) dădea 0.
    expect(listTotals(items, prices).remaining_unknown_count).toBe(1);
  });
});

describe("comparația pe magazine", () => {
  const idx = buildPriceIndex([
    price({ product_id: "rosii", amount: 14, quantity: 1, unit: "kg", retailer_id: "lidl" }),
    price({ product_id: "rosii", amount: 12, quantity: 1, unit: "kg", retailer_id: "kaufland" }),
    price({ product_id: "lapte", amount: 7, quantity: 1, unit: "l", retailer_id: "lidl" }),
    price({ product_id: "lapte", amount: 5, quantity: 1, unit: "l", retailer_id: "lidl", price_type: "promotie", observed_on: "2026-03-05" }),
    price({ product_id: "oua", amount: 1, quantity: 1, unit: "buc", retailer_id: "piata-obor", source: "piata", observed_on: "2026-01-01" }),
    price({ product_id: "paine", amount: 6, quantity: 1, unit: "buc", retailer_id: null }),
  ]);
  const items = [
    listItem({ product_id: "rosii", quantity: 2, unit: "kg" }),
    listItem({ product_id: "lapte", quantity: 2, unit: "l" }),
    listItem({ product_id: "oua", quantity: 10, unit: "buc" }),
    listItem({ product_id: "paine", quantity: 1, unit: "buc" }),
    listItem({ product_id: "rosii", quantity: 5, unit: "kg", checked: true }), // bifat: nu se compară
  ];

  it("folosește doar prețurile fiecărui magazin și numără ce lipsește", () => {
    const r = compareRetailers(items, idx, "2026-06-01");
    expect(r.map((x) => [x.retailer_id, x.total, x.priced_count, x.item_count])).toEqual([
      ["lidl", 42, 2, 4], // 2 × 14 + 2 × 7 (prețul obișnuit, nu promoția)
      ["piata-obor", 10, 1, 4], // la același număr de produse cu preț, cel mai ieftin primul
      ["kaufland", 24, 1, 4],
    ]);
    expect(r[1].stale_count).toBe(1);
  });

  it("promoția intră doar dacă e singurul preț al magazinului și e numărată", () => {
    const doarPromo = buildPriceIndex([price({ product_id: "lapte", amount: 5, quantity: 1, unit: "l", retailer_id: "lidl", price_type: "promotie" })]);
    expect(compareRetailers([listItem({ product_id: "lapte", quantity: 1, unit: "l" })], doarPromo)).toEqual([
      { retailer_id: "lidl", total: 5, priced_count: 1, item_count: 1, promo_count: 1, stale_count: 0 },
    ]);
  });

  it("fără prețuri pe magazine nu întoarce nimic", () => {
    expect(compareRetailers(items.slice(3, 4), idx)).toEqual([]);
  });
});

describe("sugestiile de sub listă", () => {
  const h = (product_id: string, day: string) => ({ product_id, name: product_id, purchased_at: `${day}T10:00:00.000Z`, deleted_at: null });
  const p = (product_id: string, quantity: number) => ({ product_id, name: product_id, quantity, deleted_at: null });

  it("întâi ce s-a terminat în cămară, apoi ce cumperi des și nu e acasă, fără ce e deja pe listă", () => {
    const out = quickSuggestions({
      listProductIds: ["paine-alba"],
      pantry: [p("unt", 0), p("lapte-integral", 1), p("paine-alba", 0)],
      history: [h("oua", "2026-10-10"), h("oua", "2026-10-03"), h("lapte-integral", "2026-10-10"), h("lapte-integral", "2026-10-03"), h("mere", "2026-10-10"), h("cafea", "2026-05-01"), h("cafea", "2026-05-08")],
      today: "2026-10-16",
    });
    // unt: terminat; oua: de 2 ori; laptele e acasă; merele o singură dată; cafeaua e prea veche; pâinea e pe listă.
    expect(out).toEqual([
      { product_id: "unt", name: "unt", reason: "terminat" },
      { product_id: "oua", name: "oua", reason: "des" },
    ]);
  });

  it("se oprește la limită", () => {
    const pantry = ["a", "b", "c", "d"].map((x) => p(x, 0));
    expect(quickSuggestions({ listProductIds: [], pantry, history: [], today: "2026-10-16", limit: 3 })).toHaveLength(3);
  });
});
