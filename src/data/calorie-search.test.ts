import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import { buildCalorieSearchCatalog, defaultFoodFromItem, searchCalorieCatalog } from "./calorie-search";

describe("căutarea de alimente și rețete pentru jurnalul de calorii", () => {
  it("exclude produsele nealimentare și găsește atât alimente cât și rețete", () => {
    const catalog = buildCatalog();
    const searchable = buildCalorieSearchCatalog({
      products: catalog.products,
      aliases: catalog.product_aliases,
      categories: catalog.product_categories,
      recipes: catalog.recipes,
      ingredients: catalog.recipe_ingredients,
      labels: [],
    });

    const detergentHits = searchCalorieCatalog(searchable, "detergent");
    expect(detergentHits).toHaveLength(0);

    const hits = searchCalorieCatalog(searchable, "omleta");
    expect(hits.some((item) => item.kind === "recipe" && item.name.includes("Omletă"))).toBe(true);

    const eggHits = searchCalorieCatalog(searchable, "oua");
    const eggs = eggHits.find((item) => item.kind === "product" && item.product.id === "oua");
    expect(eggs?.kind).toBe("product");
    if (eggs?.kind === "product") {
      expect(defaultFoodFromItem(eggs)).toMatchObject({ unit: "buc", quantity: 1 });
    }
  });

  it("găsește produsul local după codul de bare sau eticheta Open Food Facts salvată", () => {
    const catalog = buildCatalog();
    const target = catalog.products.find((p) => p.id === "fulgi-ovaz") ?? catalog.products[0];
    const searchable = buildCalorieSearchCatalog({
      products: catalog.products,
      aliases: catalog.product_aliases,
      categories: catalog.product_categories,
      recipes: [],
      ingredients: [],
      labels: [{
        user_id: "u1",
        product_id: target.id,
        basis: "g",
        preparation: "as_sold",
        values: { kcal: 324, protein_g: 10, carbs_g: 65.2, fat_g: 1.3 },
        open_food_facts_code: "5949084024838",
      }],
    });

    const match = searchable.findByGtin("05949084024838");
    expect(match?.suggestion.name).toBe(target.name);
    expect(match?.suggestion.nutrition?.values.kcal).toBe(324);
    expect(match?.food.open_food_facts_code).toBe("5949084024838");
  });
});
