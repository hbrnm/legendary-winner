import { describe, expect, it } from "vitest";
import { recipeAllergens, recipeCost, recipeNeeds, whatCanICook } from "./recipes";
import { buildPriceIndex } from "./pricing";
import { ingredient, price, recipe } from "@/test/factories";
import type { Product } from "./types";

const r = recipe({ id: "r1", servings: 4 });
const ings = [
  ingredient({ recipe_id: "r1", product_id: "piept-pui", quantity: 500, unit: "g" }),
  ingredient({ recipe_id: "r1", product_id: "ceapa", quantity: 2, unit: "buc" }),
  ingredient({ recipe_id: "r1", product_id: "sare", quantity: null, unit: null }),
  ingredient({ recipe_id: "r1", product_id: "patrunjel", quantity: 1, unit: "legatura", optional: true }),
];

describe("costul rețetei", () => {
  it("calculează total, per porție și acoperirea cu prețuri", () => {
    const idx = buildPriceIndex([price({ product_id: "piept-pui", amount: 30, quantity: 1, unit: "kg", observed_on: "2026-03-05" })]);
    const c = recipeCost(r, ings, 4, idx);
    expect(c.total).toBe(15);
    expect(c.per_serving).toBe(3.75);
    expect(c.costable_count).toBe(2); // fără „după gust” și opționale
    expect(c.priced_count).toBe(1);
    expect(c.coverage_pct).toBe(50);
    expect(c.complete).toBe(false);
    expect(c.missing_product_ids).toEqual(["ceapa"]);
    expect(c.newest_price_on).toBe("2026-03-05");
  });

  it("se recalculează la alt număr de porții", () => {
    const idx = buildPriceIndex([
      price({ product_id: "piept-pui", amount: 30, quantity: 1, unit: "kg" }),
      price({ product_id: "ceapa", amount: 1, quantity: 1, unit: "buc" }),
    ]);
    const c = recipeCost(r, ings, 8, idx);
    expect(c.total).toBe(34);
    expect(c.complete).toBe(true);
    expect(c.coverage_pct).toBe(100);
  });
});

describe("nevoile rețetei", () => {
  it("scalează și exclude ingredientele opționale", () => {
    expect(recipeNeeds(r, ings, 2)).toEqual([
      { product_id: "piept-pui", quantity: 250, unit: "g" },
      { product_id: "ceapa", quantity: 1, unit: "buc" },
      { product_id: "sare", quantity: null, unit: null },
    ]);
  });
});

describe("alergeni", () => {
  it("se deduc din produse", () => {
    const products = new Map<string, Product>([
      ["faina", { id: "faina", allergens: ["gluten"] } as Product],
      ["lapte", { id: "lapte", allergens: ["lapte"] } as Product],
    ]);
    const list = [ingredient({ recipe_id: "x", product_id: "lapte" }), ingredient({ recipe_id: "x", product_id: "faina" })];
    expect(recipeAllergens(list, products)).toEqual(["gluten", "lapte"]);
  });
});

describe("ce pot găti cu ce am", () => {
  const omleta = recipe({ id: "omleta", name: "Omletă", servings: 2 });
  const supa = recipe({ id: "supa", name: "Supă", servings: 4 });
  const all = [
    ingredient({ recipe_id: "omleta", product_id: "oua", quantity: 4, unit: "buc" }),
    ingredient({ recipe_id: "omleta", product_id: "sare", quantity: null, unit: null }),
    ingredient({ recipe_id: "omleta", product_id: "unt", quantity: 10, unit: "g" }),
    ingredient({ recipe_id: "supa", product_id: "piept-pui", quantity: 500, unit: "g" }),
    ingredient({ recipe_id: "supa", product_id: "morcovi", quantity: 2, unit: "buc" }),
  ];

  it("ordonează după cât acoperă cămara și arată ce lipsește", () => {
    const m = whatCanICook([omleta, supa], all, [
      { product_id: "oua", quantity: 6, unit: "buc" },
      { product_id: "unt", quantity: 200, unit: "g" },
      { product_id: "morcovi", quantity: 5, unit: "buc" },
    ]);
    expect(m.map((x) => x.recipe.id)).toEqual(["omleta", "supa"]);
    expect(m[0].ratio).toBe(1); // sarea e ingredient de bază
    expect(m[1].missing).toEqual([{ product_id: "piept-pui", quantity: 500, unit: "g" }]);
  });

  it("nu propune rețete fără niciun ingredient disponibil", () => {
    expect(whatCanICook([supa], all, [{ product_id: "oua", quantity: 6, unit: "buc" }])).toEqual([]);
  });
});
