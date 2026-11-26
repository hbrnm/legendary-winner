import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import { catalogNutrition } from "./nutrition-lookup";

describe("căutarea valorilor nutriționale din catalog și etichete", () => {
  it("preferă eticheta personală (g sau ml) cu sursa potrivită și păstrează fallback-ul din catalog", () => {
    const catalog = buildCatalog();
    const oua = catalog.products.find((p) => p.id === "oua")!;
    const lapte = catalog.products.find((p) => p.id === "lapte-integral")!;
    const custom = { ...oua, id: "custom-produs", name: "Produs propriu", household_id: "h1", piece_grams: null, grams_per_ml: null };
    const products = new Map([
      [oua.id, { ...oua, piece_grams: 60 }],
      [lapte.id, lapte],
      [custom.id, custom],
    ]);

    const lookup = catalogNutrition(products, [
      {
        user_id: "u1",
        product_id: lapte.id,
        basis: "ml",
        preparation: "as_sold",
        values: { kcal: 62, protein_g: 3.3, carbs_g: 4.8, fat_g: 3.5 },
        open_food_facts_code: "5949084019018",
      },
      {
        user_id: "u1",
        product_id: custom.id,
        basis: "g",
        preparation: "raw",
        values: { kcal: 250, protein_g: 10, carbs_g: 20, fat_g: 12 },
      },
    ]);

    expect(lookup(lapte.id)).toMatchObject({
      per_100g: null,
      per_100ml: { kcal: 62, protein_g: 3.3, carbs_g: 4.8, fat_g: 3.5 },
      source: "Open Food Facts · valori confirmate",
      preparation: "as_sold",
    });

    expect(lookup(custom.id)).toMatchObject({
      per_100g: { kcal: 250, protein_g: 10, carbs_g: 20, fat_g: 12 },
      source: "Eticheta produsului",
      preparation: "raw",
    });

    const catalogEgg = lookup(oua.id);
    expect(catalogEgg.per_100g).not.toBeNull();
    expect(catalogEgg.units.piece_grams).toBe(60);

    const missing = { ...custom, id: "necunoscut", name: "Fără valori" };
    const lookupMissing = catalogNutrition(new Map([[missing.id, missing]]), []);
    expect(lookupMissing(missing.id).per_100g).toBeNull();
    expect(lookupMissing(missing.id).source).toBeUndefined();
  });
});
