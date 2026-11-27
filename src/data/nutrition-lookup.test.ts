import { describe, expect, it } from "vitest";
import { recipeNutrition } from "@/lib/domain/recipes";
import { buildCatalog } from "./catalog";
import { catalogNutrition } from "./nutrition-lookup";

describe("căutarea valorilor nutriționale din catalog și etichete", () => {
  it("calculează contribuțiile ingredientelor cu cantitate din toate rețetele de catalog", () => {
    const catalog = buildCatalog();
    const lookup = catalogNutrition(new Map(catalog.products.map((product) => [product.id, product])));
    const missing = catalog.recipes.flatMap((recipe) => {
      const ingredients = catalog.recipe_ingredients.filter((item) => item.recipe_id === recipe.id);
      return recipeNutrition(recipe, ingredients, lookup).missing.map(({ product_id }) => `${recipe.id}: ${product_id}`);
    });

    expect(missing).toEqual([]);
    expect(lookup("reteta-pastai-de-edamame-congelate").per_100g?.kcal).toBeCloseTo(78.65);
    expect(lookup("reteta-pastrav-eviscerat-crud").per_100g?.kcal).toBeCloseTo(78.47);
    expect(lookup("reteta-lapte-1-5-sau-bautura-vegetala").source).toContain("estimare (lapte semidegresat)");
  });

  it("calculează toate ingredientele din banana în ciocolată și indică estimarea", () => {
    const catalog = buildCatalog();
    const recipe = catalog.recipes.find((item) => item.id === "banana-congelata-ciocolata-neagra")!;
    const ingredients = catalog.recipe_ingredients.filter((item) => item.recipe_id === recipe.id);
    const lookup = catalogNutrition(new Map(catalog.products.map((product) => [product.id, product])));
    const nutrition = recipeNutrition(recipe, ingredients, lookup);

    expect(nutrition.missing).toEqual([]);
    expect(nutrition.total?.kcal).toBeCloseTo(350.52);
    expect(nutrition.contributions.find((row) => row.product_id === "reteta-ciocolata-neagra-85-cacao")?.source).toContain("estimare");
  });

  it("recunoaște albușul deja importat și aplică conversiile cu unitatea potrivită", () => {
    const lookup = catalogNutrition(new Map([
      ["albus-importat", { name: "Albuș de ou", piece_grams: null, grams_per_ml: null }],
    ]));

    expect(lookup("albus-importat").per_100g).toEqual(lookup("albus-de-ou").per_100g);
    expect(lookup("albus-importat").units.piece_grams).toBe(33);
    expect(lookup("apa-plata").units.grams_per_ml).toBe(1);
    expect(lookup("reteta-piper-negru").units.grams_per_ml).toBe(0.46);
    expect(lookup("reteta-spaghete-de-grau-dur-uscate").per_100g).toEqual(lookup("paste-spaghete").per_100g);
  });

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
