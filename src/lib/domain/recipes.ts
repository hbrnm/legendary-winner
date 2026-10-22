import type { Allergen, ISODate, Product, Recipe, RecipeIngredient } from "./types";
import { aggregateNeeds, scaleQuantity, subtractStock, type Need, type ProductUnitsMap, type Stock } from "./quantities";
import { estimateCost, type PriceIndex } from "./pricing";
import { roundMoney, sumMoney } from "./money";
import { convertForProduct, type ProductUnits } from "./units";

export function activeIngredients(ingredients: RecipeIngredient[], recipeId: string): RecipeIngredient[] {
  return ingredients
    .filter((i) => i.recipe_id === recipeId && !i.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function scaleIngredients(ingredients: RecipeIngredient[], fromServings: number, toServings: number): RecipeIngredient[] {
  return ingredients.map((i) => ({ ...i, quantity: scaleQuantity(i.quantity, fromServings, toServings) }));
}

/** Nevoile de cumpărături ale unei rețete pentru un număr de porții (fără ingredientele opționale). */
export function recipeNeeds(recipe: Recipe, ingredients: RecipeIngredient[], servings: number): Need[] {
  return scaleIngredients(ingredients, recipe.servings, servings)
    .filter((i) => !i.optional)
    .map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit: i.unit }));
}

export interface RecipeCost {
  total: number;
  per_serving: number;
  /** Ingrediente cu cantitate (cele „după gust” nu intră în cost). */
  costable_count: number;
  priced_count: number;
  /** 0–100. */
  coverage_pct: number;
  complete: boolean;
  /** Cel mai vechi preț folosit: costul e la zi cel mult de la această dată. */
  oldest_price_on: ISODate | null;
  newest_price_on: ISODate | null;
  /** Cel puțin un preț folosit e mai vechi de STALE_AFTER_DAYS. */
  has_stale_price: boolean;
  missing_product_ids: string[];
}

/** Costul unei rețete: estimare generală, din cel mai recent preț obișnuit al oricărei surse. */
export function recipeCost(recipe: Recipe, ingredients: RecipeIngredient[], servings: number, prices: PriceIndex, today: ISODate | null = null): RecipeCost {
  const scaled = scaleIngredients(ingredients, recipe.servings, servings).filter((i) => !i.optional && i.quantity != null && i.unit);
  const costs: number[] = [];
  const missing: string[] = [];
  let oldest: ISODate | null = null;
  let newest: ISODate | null = null;
  let stale = false;
  for (const i of scaled) {
    const c = estimateCost(prices, i.product_id, i.quantity, i.unit, { today });
    if (!c) {
      missing.push(i.product_id);
      continue;
    }
    costs.push(c.cost);
    if (c.price.stale) stale = true;
    if (!oldest || c.observed_on < oldest) oldest = c.observed_on;
    if (!newest || c.observed_on > newest) newest = c.observed_on;
  }
  const total = sumMoney(costs);
  const costable = scaled.length;
  return {
    total,
    per_serving: servings > 0 ? roundMoney(total / servings) : 0,
    costable_count: costable,
    priced_count: costs.length,
    coverage_pct: costable === 0 ? 100 : Math.round((costs.length / costable) * 100),
    complete: missing.length === 0,
    oldest_price_on: oldest,
    newest_price_on: newest,
    has_stale_price: stale,
    missing_product_ids: missing,
  };
}

/** Valori nutriționale: la 100 g pentru produse, pe porție pentru rețete. */
export interface NutritionValues {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Ce știm despre un produs pentru calcul: valorile la 100 g și greutățile unităților (bucată, ml, cățel). */
export interface ProductNutrition {
  per_100g: NutritionValues | null;
  units: ProductUnits & { catel_g?: number | null };
}

export interface RecipeNutrition {
  /** Din ingredientele care se pot calcula; null dacă niciunul nu se poate. */
  per_serving: NutritionValues | null;
  /** Ingredientele fără valori sau fără greutate („după gust” și opționalele nu contează). */
  missing_product_ids: string[];
}

function gramsOf(quantity: number, unit: RecipeIngredient["unit"] & string, units: ProductNutrition["units"]): number | null {
  if (unit === "catel") return units.catel_g && units.catel_g > 0 ? quantity * units.catel_g : null;
  return convertForProduct(quantity, unit, "g", units);
}

/**
 * Valorile pe porție ale unei rețete (.tasks/016, etapa 4), aproximative: din
 * gramele fiecărui ingredient (prin greutatea bucății, densitate sau cățel) și
 * valorile la 100 g. Ce nu se poate calcula se numără la `missing_product_ids`,
 * iar restul se adună (decizia proprietarului: parțial, cu avertisment).
 */
export function recipeNutrition(recipe: Pick<Recipe, "servings">, ingredients: RecipeIngredient[], nutritionOf: (productId: string) => ProductNutrition | undefined): RecipeNutrition {
  const sum: NutritionValues = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const missing: string[] = [];
  let counted = 0;
  for (const i of ingredients) {
    if (i.optional || i.quantity == null || !i.unit) continue;
    const n = nutritionOf(i.product_id);
    const grams = n?.per_100g ? gramsOf(i.quantity, i.unit, n.units) : null;
    if (!n?.per_100g || grams == null) {
      if (!missing.includes(i.product_id)) missing.push(i.product_id);
      continue;
    }
    for (const k of Object.keys(sum) as (keyof NutritionValues)[]) sum[k] += (n.per_100g[k] * grams) / 100;
    counted++;
  }
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return {
    per_serving: counted === 0 ? null : { kcal: Math.round(sum.kcal / servings), protein_g: Math.round(sum.protein_g / servings), carbs_g: Math.round(sum.carbs_g / servings), fat_g: Math.round(sum.fat_g / servings) },
    missing_product_ids: missing,
  };
}

export function recipeAllergens(ingredients: RecipeIngredient[], products: Map<string, Product>): Allergen[] {
  const set = new Set<Allergen>();
  for (const i of ingredients) for (const a of products.get(i.product_id)?.allergens ?? []) set.add(a);
  return [...set].sort();
}

export interface PantryMatch {
  recipe: Recipe;
  /** Ingrediente obligatorii acoperite complet de cămară. */
  have: string[];
  /** Ingrediente lipsă sau insuficiente. */
  missing: Need[];
  /** 0–1. */
  ratio: number;
}

/** Ingrediente de bază pe care aproape orice bucătărie le are; nu blochează o sugestie. */
export const STAPLE_PRODUCT_IDS = new Set(["sare", "piper-negru-macinat", "apa"]);

/**
 * „Ce pot găti cu ce am?” — pentru fiecare rețetă, cât din ingredientele
 * obligatorii acoperă cămara. Se ordonează după proporția acoperită, apoi
 * după numărul de ingrediente lipsă.
 */
export function whatCanICook(recipes: Recipe[], allIngredients: RecipeIngredient[], stock: Stock[], minRatio = 0.5, pieces?: ProductUnitsMap): PantryMatch[] {
  const byRecipe = new Map<string, RecipeIngredient[]>();
  for (const i of allIngredients) {
    if (i.deleted_at) continue;
    const list = byRecipe.get(i.recipe_id) ?? [];
    list.push(i);
    byRecipe.set(i.recipe_id, list);
  }
  const matches: PantryMatch[] = [];
  for (const recipe of recipes) {
    if (recipe.deleted_at) continue;
    const needs = aggregateNeeds(recipeNeeds(recipe, byRecipe.get(recipe.id) ?? [], recipe.servings)).filter(
      (n) => !STAPLE_PRODUCT_IDS.has(n.product_id),
    );
    if (needs.length === 0) continue;
    const { remaining } = subtractStock(needs, stock, pieces);
    const missingIds = new Set(remaining.map((r) => r.product_id));
    const have = needs.filter((n) => !missingIds.has(n.product_id)).map((n) => n.product_id);
    const ratio = have.length / needs.length;
    if (ratio >= minRatio && have.length > 0) matches.push({ recipe, have, missing: remaining, ratio });
  }
  matches.sort((a, b) => b.ratio - a.ratio || a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name, "ro"));
  return matches;
}

export function totalMinutes(r: Pick<Recipe, "prep_minutes" | "cook_minutes">): number {
  return r.prep_minutes + r.cook_minutes;
}

/** Rețete care folosesc produse ce expiră curând, ordonate după câte astfel de produse folosesc. */
export function recipesUsingProducts(recipes: Recipe[], allIngredients: RecipeIngredient[], productIds: Set<string>): { recipe: Recipe; uses: string[] }[] {
  const out: { recipe: Recipe; uses: string[] }[] = [];
  for (const r of recipes) {
    if (r.deleted_at) continue;
    const uses = [...new Set(allIngredients.filter((i) => i.recipe_id === r.id && !i.deleted_at && productIds.has(i.product_id)).map((i) => i.product_id))];
    if (uses.length) out.push({ recipe: r, uses });
  }
  return out.sort((a, b) => b.uses.length - a.uses.length || a.recipe.name.localeCompare(b.recipe.name, "ro"));
}

export type SuggestedMeal = "mic_dejun" | "pranz" | "cina";

/** Masa după ora din zi (.tasks/016, chestionar 22 oct. 2026): 05–10 mic dejun, 11–16 prânz, 17–04 cină. */
export function mealForHour(hour: number): SuggestedMeal {
  if (hour >= 5 && hour < 11) return "mic_dejun";
  if (hour >= 11 && hour < 17) return "pranz";
  return "cina";
}

/** Rețetele potrivite mesei; dacă nu e niciuna, toate (sugestiile nu rămân goale). */
export function recipesForMeal<R extends Pick<Recipe, "categories">>(recipes: R[], meal: SuggestedMeal): R[] {
  const fit = recipes.filter((r) => r.categories.includes(meal));
  return fit.length ? fit : recipes;
}
