import type {
  PantryLocation,
  Product,
  ProductAlias,
  ProductCategory,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  Retailer,
} from "@/lib/domain/types";
import { CATEGORY_SEEDS } from "./categories";
import { PRODUCT_SEEDS } from "./products";
import { RECIPE_SEEDS } from "./recipes";
import { RETAILER_SEEDS } from "./retailers";
import { PANTRY_LOCATION_SEEDS } from "./pantry-locations";
import { RECIPE_PHOTOS, recipePhotoUrl } from "./recipe-photos";

/**
 * Versiunea catalogului inițial. Rândurile seed au acest updated_at; la
 * sincronizare, clientul cere de la server doar ce e mai nou de atât.
 * Se schimbă când se modifică datele din src/data.
 */
export const CATALOG_VERSION = "2026-10-16T09:00:00.000Z";

const meta = { household_id: null, created_at: CATALOG_VERSION, updated_at: CATALOG_VERSION, deleted_at: null };

export interface Catalog {
  product_categories: ProductCategory[];
  products: Product[];
  product_aliases: ProductAlias[];
  retailers: Retailer[];
  pantry_locations: PantryLocation[];
  recipes: Recipe[];
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
}

export function buildCatalog(): Catalog {
  const photos = new Map(RECIPE_PHOTOS.map((p) => [p.recipe_id, recipePhotoUrl(p)]));
  return {
    product_categories: CATEGORY_SEEDS.map((c, i) => ({ ...meta, id: c.id, name: c.name, icon: c.icon, sort_order: (i + 1) * 10, is_food: c.is_food })),
    products: PRODUCT_SEEDS.map((p) => ({
      ...meta,
      id: p.id,
      name: p.name,
      category_id: p.category,
      subcategory: p.sub ?? null,
      default_unit: p.unit,
      brand_id: null,
      ean: null,
      season_months: p.season ?? [],
      is_traditional: p.traditional ?? false,
      is_market_typical: p.market ?? false,
      allergens: p.allergens ?? [],
      piece_grams: p.piece_g ?? null,
      grams_per_ml: p.g_per_ml ?? null,
    })),
    product_aliases: PRODUCT_SEEDS.flatMap((p) =>
      (p.aliases ?? []).map((alias, i) => ({ ...meta, id: `${p.id}:a${i + 1}`, product_id: p.id, alias })),
    ),
    retailers: RETAILER_SEEDS.map((r) => ({ ...meta, id: r.id, name: r.name, kind: r.kind, details: null })),
    pantry_locations: PANTRY_LOCATION_SEEDS.map((l, i) => ({ ...meta, id: l.id, name: l.name, sort_order: (i + 1) * 10 })),
    recipes: RECIPE_SEEDS.map((r) => ({
      ...meta,
      id: r.id,
      name: r.name,
      description: r.description,
      categories: r.categories,
      cuisine: r.cuisine,
      servings: r.servings,
      prep_minutes: r.prep,
      cook_minutes: r.cook,
      difficulty: r.difficulty,
      image_url: photos.get(r.id) ?? null,
      nutrition: null,
    })),
    recipe_ingredients: RECIPE_SEEDS.flatMap((r) =>
      r.ingredients.map((ing, i) => ({
        ...meta,
        id: `${r.id}:i${i + 1}`,
        recipe_id: r.id,
        product_id: ing.p,
        quantity: ing.q,
        unit: ing.q == null ? null : ing.u,
        note: ing.note ?? null,
        optional: ing.opt ?? false,
        sort_order: i,
      })),
    ),
    recipe_steps: RECIPE_SEEDS.flatMap((r) => r.steps.map((text, i) => ({ ...meta, id: `${r.id}:s${i + 1}`, recipe_id: r.id, position: i, text }))),
  };
}
