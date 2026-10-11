import { describe, expect, it } from "vitest";
import { aggregateNeeds, roundForShopping, scaleQuantity, subtractStock } from "./quantities";

describe("agregarea nevoilor", () => {
  it("adună același produs din două rețete: 500 g + 300 g = 800 g", () => {
    expect(
      aggregateNeeds([
        { product_id: "piept-pui", quantity: 500, unit: "g" },
        { product_id: "piept-pui", quantity: 300, unit: "g" },
      ]),
    ).toEqual([{ product_id: "piept-pui", quantity: 800, unit: "g" }]);
  });

  it("convertește între kg și g și alege unitatea lizibilă", () => {
    expect(
      aggregateNeeds([
        { product_id: "cartofi", quantity: 1, unit: "kg" },
        { product_id: "cartofi", quantity: 500, unit: "g" },
      ]),
    ).toEqual([{ product_id: "cartofi", quantity: 1.5, unit: "kg" }]);
  });

  it("păstrează separat unitățile incompatibile", () => {
    const r = aggregateNeeds([
      { product_id: "patrunjel", quantity: 1, unit: "legatura" },
      { product_id: "patrunjel", quantity: 20, unit: "g" },
    ]);
    expect(r).toHaveLength(2);
  });

  it("„după gust” dispare când există și o cantitate", () => {
    expect(
      aggregateNeeds([
        { product_id: "sare", quantity: null, unit: null },
        { product_id: "sare", quantity: 10, unit: "g" },
        { product_id: "piper", quantity: null, unit: null },
        { product_id: "piper", quantity: null, unit: null },
      ]),
    ).toEqual([
      { product_id: "sare", quantity: 10, unit: "g" },
      { product_id: "piper", quantity: null, unit: null },
    ]);
  });
});

describe("scăderea stocului", () => {
  it("scade ce există în cămară, cu conversie", () => {
    const r = subtractStock([{ product_id: "faina", quantity: 1, unit: "kg" }], [{ product_id: "faina", quantity: 400, unit: "g" }]);
    expect(r.remaining).toEqual([{ product_id: "faina", quantity: 0.6, unit: "kg" }]);
    expect(r.covered).toEqual([{ product_id: "faina", quantity: 0.4, unit: "kg" }]);
  });

  it("nu mai cere produsul dacă stocul ajunge", () => {
    const r = subtractStock([{ product_id: "oua", quantity: 4, unit: "buc" }], [{ product_id: "oua", quantity: 10, unit: "buc" }]);
    expect(r.remaining).toEqual([]);
  });

  it("nu folosește același stoc de două ori", () => {
    const r = subtractStock(
      [
        { product_id: "oua", quantity: 4, unit: "buc" },
        { product_id: "oua", quantity: 2, unit: "buc" },
      ],
      [{ product_id: "oua", quantity: 5, unit: "buc" }],
    );
    expect(r.remaining).toEqual([{ product_id: "oua", quantity: 1, unit: "buc" }]);
  });

  it("nu scade unități incompatibile", () => {
    const r = subtractStock([{ product_id: "miere", quantity: 200, unit: "g" }], [{ product_id: "miere", quantity: 1, unit: "borcan" }]);
    expect(r.remaining).toEqual([{ product_id: "miere", quantity: 200, unit: "g" }]);
  });
});

describe("porții și rotunjiri", () => {
  it("recalculează cantitățile proporțional", () => {
    expect(scaleQuantity(500, 4, 6)).toBe(750);
    expect(scaleQuantity(3, 4, 2)).toBe(1.5);
    expect(scaleQuantity(null, 4, 2)).toBeNull();
  });

  it("rotunjește în sus doar unitățile întregi", () => {
    expect(roundForShopping(1.5, "buc")).toBe(2);
    expect(roundForShopping(2, "buc")).toBe(2);
    expect(roundForShopping(0.75, "kg")).toBe(0.75);
  });
});
