import { describe, expect, it } from "vitest";
import { buildPriceIndex, defaultShelfBasis, estimateCost, latestUnitPrice, totalFromShelfPrice, type PriceContext } from "./pricing";
import { listTotals, lineEstimate } from "./shopping";
import { recipeCost } from "./recipes";
import { ingredient, listItem, price, recipe } from "@/test/factories";

const TODAY = "2026-10-11";
const lidl: PriceContext = { retailer_id: "lidl", source: "supermarket" };

// Roșii: 8 lei/kg la piață, 12 la Kaufland, 14 la Lidl; cel de la piață e cel mai nou.
const rosii = buildPriceIndex([
  price({ id: "lidl", product_id: "rosii", amount: 14, quantity: 1, unit: "kg", retailer_id: "lidl", source: "supermarket", observed_on: "2026-10-01" }),
  price({ id: "kaufland", product_id: "rosii", amount: 12, quantity: 1, unit: "kg", retailer_id: "kaufland", source: "supermarket", observed_on: "2026-10-05" }),
  price({ id: "piata", product_id: "rosii", amount: 8, quantity: 1, unit: "kg", retailer_id: "piata-obor", source: "piata", observed_on: "2026-10-09" }),
]);

describe("prețuri", () => {
  it("folosește cel mai recent preț și convertește unitatea", () => {
    const idx = buildPriceIndex([
      price({ product_id: "rosii", amount: 10, quantity: 1, unit: "kg", observed_on: "2026-02-01" }),
      price({ product_id: "rosii", amount: 12, quantity: 1, unit: "kg", observed_on: "2026-03-01" }),
    ]);
    expect(latestUnitPrice(idx, "rosii", "g")?.per_unit).toBeCloseTo(0.012);
    expect(estimateCost(idx, "rosii", 500, "g")).toMatchObject({ cost: 6, observed_on: "2026-03-01" });
  });

  it("nu inventează un preț pentru unități incompatibile", () => {
    const idx = buildPriceIndex([price({ product_id: "miere", amount: 35, quantity: 1, unit: "borcan" })]);
    expect(estimateCost(idx, "miere", 200, "g")).toBeNull();
    expect(estimateCost(idx, "miere", 2, "borcan")?.cost).toBe(70);
  });

  it("ignoră prețurile șterse și produsele fără preț", () => {
    const idx = buildPriceIndex([price({ product_id: "lapte", amount: 8, quantity: 1, unit: "l", deleted_at: "2026-03-02T00:00:00Z" })]);
    expect(latestUnitPrice(idx, "lapte")).toBeNull();
    expect(latestUnitPrice(idx, "branza")).toBeNull();
  });
});

describe("prețul potrivit cumpărăturii", () => {
  it("trei magazine: lista de la Lidl folosește prețul de la Lidl", () => {
    const p = latestUnitPrice(rosii, "rosii", "kg", { context: lidl });
    expect(p).toMatchObject({ per_unit: 14, price_id: "lidl", match: "magazin" });
    expect(latestUnitPrice(rosii, "rosii", "kg", { context: { retailer_id: "kaufland", source: "supermarket" } })?.per_unit).toBe(12);
  });

  it("piață și supermarket: un coș de supermarket nu ia prețul de la piață", () => {
    const p = latestUnitPrice(rosii, "rosii", "kg", { context: { retailer_id: "mega", source: "supermarket" } });
    expect(p).toMatchObject({ price_id: "kaufland", match: "alt_magazin" });
    expect(latestUnitPrice(rosii, "rosii", "kg", { context: { retailer_id: null, source: "piata" } })).toMatchObject({ per_unit: 8, match: "sursa" });
  });

  it("producător și magazin nu se amestecă", () => {
    const idx = buildPriceIndex([price({ product_id: "oua", amount: 1.2, quantity: 1, unit: "buc", source: "producator", retailer_id: null })]);
    expect(latestUnitPrice(idx, "oua", "buc", { context: lidl })).toBeNull();
    expect(latestUnitPrice(idx, "oua", "buc", { context: { retailer_id: null, source: "producator" } })?.per_unit).toBe(1.2);
  });

  it("listă fără magazin: cel mai recent preț din aceeași sursă", () => {
    expect(latestUnitPrice(rosii, "rosii", "kg", { context: { retailer_id: null, source: "supermarket" } })).toMatchObject({ per_unit: 12, match: "sursa" });
  });

  it("fără context (rețete): cel mai recent preț din orice sursă, ca estimare generală", () => {
    expect(latestUnitPrice(rosii, "rosii", "kg")).toMatchObject({ per_unit: 8, match: "general" });
  });

  it("promoția intră doar dacă nu există un preț obișnuit și e marcată", () => {
    const idx = buildPriceIndex([
      price({ id: "promo", product_id: "unt", amount: 7, quantity: 1, unit: "buc", retailer_id: "lidl", price_type: "promotie", observed_on: "2026-10-10" }),
      price({ id: "obisnuit", product_id: "unt", amount: 11, quantity: 1, unit: "buc", retailer_id: "lidl", price_type: "observat", observed_on: "2026-09-20" }),
    ]);
    expect(latestUnitPrice(idx, "unt", "buc", { context: lidl })).toMatchObject({ price_id: "obisnuit", promo: false });
    const doarPromo = buildPriceIndex([idx.get("unt")![0]]);
    expect(latestUnitPrice(doarPromo, "unt", "buc", { context: lidl })).toMatchObject({ price_id: "promo", promo: true });
    // Un preț obișnuit din alt magazin e preferat unei promoții.
    const altMagazin = buildPriceIndex([idx.get("unt")![0], price({ id: "k", product_id: "unt", amount: 10, quantity: 1, unit: "buc", retailer_id: "kaufland" })]);
    expect(latestUnitPrice(altMagazin, "unt", "buc", { context: lidl })?.price_id).toBe("k");
  });

  it("un preț mai vechi de 90 de zile se folosește, dar e marcat vechi", () => {
    const idx = buildPriceIndex([price({ product_id: "orez", amount: 9, quantity: 1, unit: "kg", observed_on: "2026-07-01" })]);
    expect(latestUnitPrice(idx, "orez", "kg", { today: TODAY })).toMatchObject({ per_unit: 9, stale: true });
    expect(latestUnitPrice(idx, "orez", "kg", { today: "2026-09-29" })?.stale).toBe(false);
  });

  it("convertește unitățile compatibile și refuză restul, și în context", () => {
    expect(estimateCost(rosii, "rosii", 500, "g", { context: lidl })?.cost).toBe(7);
    expect(estimateCost(rosii, "rosii", 2, "buc", { context: lidl })).toBeNull();
  });
});

describe("estimări explicabile", () => {
  it("lista de cumpărături: fiecare linie folosește magazinul și sursa ei", () => {
    const items = [
      listItem({ id: "a", product_id: "rosii", quantity: 1, unit: "kg", retailer_id: "lidl", source: "supermarket" }),
      listItem({ id: "b", product_id: "rosii", quantity: 2, unit: "kg", retailer_id: null, source: "piata" }),
      listItem({ id: "c", product_id: "rosii", quantity: 1, unit: "kg", retailer_id: null, source: "producator" }),
    ];
    expect(lineEstimate(items[0], rosii, TODAY)).toMatchObject({ amount: 14, kind: "calculat", price: { match: "magazin" } });
    expect(lineEstimate(items[1], rosii, TODAY).amount).toBe(16);
    expect(lineEstimate(items[2], rosii, TODAY)).toEqual({ amount: null, kind: "necunoscut" });
    const t = listTotals(items, rosii, TODAY);
    expect(t.estimated_total).toBe(30);
    expect(t.unknown_price_count).toBe(1);
  });

  it("rețeta: estimare generală, cu prețurile vechi semnalate", () => {
    const r = recipe({ id: "r", servings: 2 });
    const ings = [ingredient({ recipe_id: "r", product_id: "rosii", quantity: 500, unit: "g" }), ingredient({ recipe_id: "r", product_id: "orez", quantity: 200, unit: "g" })];
    const idx = buildPriceIndex([...rosii.get("rosii")!, price({ product_id: "orez", amount: 9, quantity: 1, unit: "kg", observed_on: "2026-06-01" })]);
    const c = recipeCost(r, ings, 2, idx, TODAY);
    expect(c.total).toBe(5.8);
    expect(c.complete).toBe(true);
    expect(c.has_stale_price).toBe(true);
    expect(c.oldest_price_on).toBe("2026-06-01");
  });
});

describe("prețul de la raft", () => {
  it("calculează totalul din prețul pe 100 g, pe kg sau pe bucată", () => {
    expect(totalFromShelfPrice(7.99, "100g", 300, "g")).toBe(23.97);
    expect(totalFromShelfPrice(7.99, "100g", 0.312, "kg")).toBe(24.93);
    expect(totalFromShelfPrice(42.5, "kg", 250, "g")).toBe(10.63);
    expect(totalFromShelfPrice(3.2, "buc", 4, "buc")).toBe(12.8);
    expect(totalFromShelfPrice(1.5, "100ml", 0.5, "l")).toBe(7.5);
  });

  it("nu calculează când cantitatea nu se potrivește cu baza", () => {
    expect(totalFromShelfPrice(7.99, "kg", 2, "buc")).toBeNull();
    expect(totalFromShelfPrice(3.2, "buc", 300, "g")).toBeNull();
  });

  it("propune baza după unitatea liniei", () => {
    expect(defaultShelfBasis("g")).toBe("100g");
    expect(defaultShelfBasis("kg")).toBe("kg");
    expect(defaultShelfBasis("l")).toBe("l");
    expect(defaultShelfBasis("ml")).toBe("100ml");
    expect(defaultShelfBasis("pachet")).toBe("buc");
    expect(defaultShelfBasis(null)).toBe("buc");
  });
});
