import { describe, expect, it } from "vitest";
import { mealForHour, recipeAllergens, recipeCost, recipeNeeds, recipeNutrition, recipesForMeal, whatCanICook, type ProductNutrition } from "./recipes";
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

describe("sugestiile după ora din zi (.tasks/016)", () => {
  it("05–10 mic dejun, 11–16 prânz, 17–04 cină", () => {
    expect([0, 4, 5, 10, 11, 16, 17, 23].map(mealForHour)).toEqual(["cina", "cina", "mic_dejun", "mic_dejun", "pranz", "pranz", "cina", "cina"]);
  });

  it("doar rețetele mesei; fără niciuna, toate", () => {
    const omleta = recipe({ id: "omleta", categories: ["mic_dejun", "rapide"] });
    const ciorba = recipe({ id: "ciorba", categories: ["pranz", "supe_ciorbe"] });
    expect(recipesForMeal([omleta, ciorba], "mic_dejun").map((r) => r.id)).toEqual(["omleta"]);
    expect(recipesForMeal([omleta, ciorba], "cina").map((r) => r.id)).toEqual(["omleta", "ciorba"]);
  });
});

describe("valorile nutriționale ale rețetei (.tasks/016, etapa 4)", () => {
  const values: Record<string, ProductNutrition> = {
    "piept-pui": { per_100g: { kcal: 110, protein_g: 23, carbs_g: 0, fat_g: 1.5 }, units: {} },
    ceapa: { per_100g: { kcal: 36, protein_g: 1, carbs_g: 7, fat_g: 0 }, units: { piece_grams: 150 } },
    ulei: { per_100g: { kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 100 }, units: { grams_per_ml: 0.92 } },
    usturoi: { per_100g: { kcal: 109, protein_g: 5, carbs_g: 21, fat_g: 0.5 }, units: { catel_g: 3 } },
    patrunjel: { per_100g: { kcal: 42, protein_g: 3, carbs_g: 4, fat_g: 1 }, units: {} },
  };
  const of = (id: string) => values[id];

  it("adună gramele ingredientelor și împarte la porții; „după gust” și opționalele nu contează", () => {
    const n = recipeNutrition(r, ings, of);
    // 500 g pui = 550 kcal, 115 g proteine; 2 cepe = 300 g = 108 kcal, 3 g proteine, 21 g glucide; la 4 porții
    expect(n.per_serving).toEqual({ kcal: 165, protein_g: 30, carbs_g: 5, fat_g: 2 });
    expect(n.missing).toEqual([]);
  });

  it("transformă lingura (densitate) și cățelul în grame", () => {
    const n = recipeNutrition(recipe({ id: "r2", servings: 1 }), [
      ingredient({ recipe_id: "r2", product_id: "ulei", quantity: 2, unit: "lingura" }),
      ingredient({ recipe_id: "r2", product_id: "usturoi", quantity: 2, unit: "catel" }),
    ], of);
    // 30 ml × 0,92 = 27,6 g ulei = 248,4 kcal; 6 g usturoi = 6,5 kcal
    expect(n.per_serving).toEqual({ kcal: 255, protein_g: 0, carbs_g: 1, fat_g: 28 });
  });

  it("calculează parțial și spune ce lipsește: fără valori sau fără greutate", () => {
    const n = recipeNutrition(recipe({ id: "r3", servings: 2 }), [
      ingredient({ recipe_id: "r3", product_id: "piept-pui", quantity: 400, unit: "g" }),
      ingredient({ recipe_id: "r3", product_id: "patrunjel", quantity: 1, unit: "legatura" }),
      ingredient({ recipe_id: "r3", product_id: "bors", quantity: 1, unit: "l" }),
    ], of);
    expect(n.per_serving).toEqual({ kcal: 220, protein_g: 46, carbs_g: 0, fat_g: 3 });
    expect(n.missing).toEqual([
      { product_id: "patrunjel", frying: false },
      { product_id: "bors", frying: false },
    ]);
  });

  it("fără niciun ingredient calculabil nu are valori", () => {
    const n = recipeNutrition(recipe({ id: "r4", servings: 2 }), [ingredient({ recipe_id: "r4", product_id: "bors", quantity: 1, unit: "l" })], of);
    expect(n.per_serving).toBeNull();
    expect(n.missing).toEqual([{ product_id: "bors", frying: false }]);
  });

  it("uleiul pentru prăjit nu se socotește și apare la ce lipsește", () => {
    const n = recipeNutrition(recipe({ id: "r5", servings: 1 }), [
      ingredient({ recipe_id: "r5", product_id: "piept-pui", quantity: 100, unit: "g" }),
      ingredient({ recipe_id: "r5", product_id: "ulei", quantity: 500, unit: "ml", note: "pentru prajit" }),
    ], of);
    expect(n.per_serving).toEqual({ kcal: 110, protein_g: 23, carbs_g: 0, fat_g: 2 });
    expect(n.missing).toEqual([{ product_id: "ulei", frying: true }]);
  });
});
