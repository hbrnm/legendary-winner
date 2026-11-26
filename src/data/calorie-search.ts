import type { ProductNutritionLabel, ProductNutritionSuggestion, CalorieSnapshot, FoodCalorieSnapshot } from "@/lib/domain/calories";
import { activeIngredients, recipeNutrition, type NutritionValues } from "@/lib/domain/recipes";
import { buildIndex, search, type SearchDoc, type SearchIndex } from "@/lib/domain/search";
import type { Product, ProductAlias, ProductCategory, Recipe, RecipeIngredient } from "@/lib/domain/types";
import type { AppCtx } from "@/lib/services/context";
import { visible } from "@/lib/services/queries";
import { calorieDatabase } from "@/lib/db/calorie-database";
import { catalogNutrition } from "./nutrition-lookup";

export type CalorieSearchItem =
  | {
    kind: "product";
    id: string;
    name: string;
    product: Product;
    per_100: NutritionValues | null;
    basis: "g" | "ml";
    piece_grams: number | null;
    grams_per_ml: number | null;
    source?: string;
    open_food_facts_code?: string;
  }
  | {
    kind: "recipe";
    id: string;
    name: string;
    recipe: Recipe;
    snapshot: CalorieSnapshot;
  };

export interface CalorieSearchCatalog {
  index: SearchIndex;
  items: ReadonlyMap<string, CalorieSearchItem>;
  findByGtin: (gtin: string) => { suggestion: ProductNutritionSuggestion; food: FoodCalorieSnapshot } | null;
}

export function buildCalorieSearchCatalog({
  products,
  aliases,
  categories,
  recipes,
  ingredients,
  labels,
}: {
  products: Product[];
  aliases: ProductAlias[];
  categories: ProductCategory[];
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  labels: ProductNutritionLabel[];
}): CalorieSearchCatalog {
  const foodCategories = new Set(categories.filter((c) => c.is_food).map((c) => c.id));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const aliasesByProduct = new Map<string, string[]>();
  for (const alias of aliases) {
    aliasesByProduct.set(alias.product_id, [...(aliasesByProduct.get(alias.product_id) ?? []), alias.alias]);
  }
  const labelsByProduct = new Map(labels.map((label) => [label.product_id, label]));
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const nutritionOf = catalogNutrition(productsMap, labels);

  const items = new Map<string, CalorieSearchItem>();
  const docs: SearchDoc[] = [];

  for (const product of products) {
    if (categoryById.has(product.category_id) && !foodCategories.has(product.category_id)) continue;
    const n = nutritionOf(product.id);
    const label = labelsByProduct.get(product.id);
    const basis = n.per_100ml ? "ml" : "g";
    const per_100 = n.per_100ml ?? n.per_100g;
    const key = `p:${product.id}`;
    items.set(key, {
      kind: "product",
      id: key,
      name: product.name,
      product,
      per_100,
      basis,
      piece_grams: n.units.piece_grams ?? null,
      grams_per_ml: n.units.grams_per_ml ?? null,
      source: n.source,
      open_food_facts_code: label?.open_food_facts_code,
    });
    docs.push({
      id: key,
      name: product.name,
      terms: [...(aliasesByProduct.get(product.id) ?? []), product.ean ?? "", label?.open_food_facts_code ?? ""],
      weakTerms: [product.subcategory ?? ""],
    });
  }

  for (const recipe of recipes) {
    const calc = recipeNutrition(recipe, activeIngredients(ingredients, recipe.id), nutritionOf);
    const perServing = recipe.nutrition ?? calc.exact_per_serving;
    const incomplete = !recipe.nutrition && calc.missing.length > 0;
    const key = `r:${recipe.id}`;
    items.set(key, {
      kind: "recipe",
      id: key,
      name: recipe.name,
      recipe,
      snapshot: {
        name: recipe.name,
        per_serving: perServing,
        source: recipe.nutrition ? "declared" : "estimated",
        incomplete,
      },
    });
    docs.push({
      id: key,
      name: recipe.name,
      terms: [recipe.description ?? ""],
    });
  }

  const index = buildIndex(docs);

  function findByGtin(gtin: string) {
    const padded = gtin.trim().padStart(14, "0");
    for (const item of items.values()) {
      if (item.kind !== "product") continue;
      const eanMatch = item.product.ean && item.product.ean.padStart(14, "0") === padded;
      const offMatch = item.open_food_facts_code && item.open_food_facts_code.padStart(14, "0") === padded;
      if (!eanMatch && !offMatch) continue;
      const food = defaultFoodFromItem(item);
      return {
        suggestion: {
          code: item.open_food_facts_code ?? item.product.ean ?? gtin.trim(),
          name: item.name,
          brand: "",
          quantity: "",
          nutrition: item.per_100 ? { basis: item.basis, values: item.per_100 } : null,
        },
        food,
      };
    }
    return null;
  }

  return { index, items, findByGtin };
}

export function searchCalorieCatalog(catalog: CalorieSearchCatalog, query: string, limit = 12): CalorieSearchItem[] {
  return search(catalog.index, query, limit)
    .map((hit) => catalog.items.get(hit.doc.id))
    .filter((item): item is CalorieSearchItem => Boolean(item));
}

export function defaultFoodFromItem(item: Extract<CalorieSearchItem, { kind: "product" }>): FoodCalorieSnapshot {
  const canUsePiece = item.product.default_unit === "buc" && item.piece_grams != null && item.piece_grams > 0;
  const canUseMl = (item.product.default_unit === "ml" || item.product.default_unit === "l")
    && (item.basis === "ml" || (item.grams_per_ml != null && item.grams_per_ml > 0));
  const unit = canUsePiece ? "buc" : canUseMl ? "ml" : item.basis;
  return {
    name: item.name,
    per_100: item.per_100,
    basis: item.basis,
    piece_grams: item.piece_grams,
    grams_per_ml: item.grams_per_ml,
    quantity: unit === "buc" ? 1 : 100,
    unit,
    source: item.source,
    open_food_facts_code: item.open_food_facts_code,
    product_id: item.product.id,
  };
}

export async function loadCalorieSearchCatalog(ctx: AppCtx): Promise<CalorieSearchCatalog> {
  const [products, aliases, categories, recipes, ingredients, labels] = await Promise.all([
    visible(ctx.db, "products", ctx.householdId),
    visible(ctx.db, "product_aliases", ctx.householdId),
    visible(ctx.db, "product_categories", ctx.householdId),
    visible(ctx.db, "recipes", ctx.householdId),
    visible(ctx.db, "recipe_ingredients", ctx.householdId),
    calorieDatabase().labels.where("user_id").equals(ctx.userId).toArray(),
  ]);
  return buildCalorieSearchCatalog({ products, aliases, categories, recipes, ingredients, labels });
}
