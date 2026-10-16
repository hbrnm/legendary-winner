import { z } from "zod";
import type { MealSlot, PantryItem, Recipe, UnitCode } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow, upsertRow } from "@/lib/db/write";
import { newId, stableId } from "@/lib/db/ids";
import { aggregateNeeds, productUnitsOf, subtractStock, toShoppingNeed, type Need } from "@/lib/domain/quantities";
import { activeIngredients, recipeNeeds } from "@/lib/domain/recipes";
import { isRecipeImageUrl } from "@/lib/domain/recipe-photos";
import { pantryStock, planConsumption } from "@/lib/domain/pantry";
import { addDays } from "@/lib/domain/dates";
import { type AppCtx, UserError, w } from "./context";
import { parse, zDate, zName, zNote, zQuantity, zUnit } from "./validation";
import { owned, productMap, visible } from "./queries";
import { addNeeds } from "./shopping";

// Rețete, planul de mese și cămara: cele trei lucrează împreună.

export async function toggleFavorite(ctx: AppCtx, recipeId: string): Promise<boolean> {
  const id = await stableId("favorit", ctx.householdId, recipeId);
  const existing = await ctx.db.favorite_recipes.get(id);
  if (existing && !existing.deleted_at) {
    await softDelete(ctx.db, "favorite_recipes", id, w(ctx));
    return false;
  }
  await upsertRow(ctx.db, "favorite_recipes", { id, household_id: ctx.householdId, recipe_id: recipeId }, w(ctx));
  return true;
}

async function recipeWithIngredients(ctx: AppCtx, recipeId: string) {
  const recipe = await ctx.db.recipes.get(recipeId);
  if (!recipe || recipe.deleted_at) throw new UserError("Rețeta nu mai există.");
  const ingredients = activeIngredients(await ctx.db.recipe_ingredients.where("recipe_id").equals(recipeId).toArray(), recipeId);
  return { recipe, ingredients };
}

/** Transformă nevoile (în unități de bucătărie) în linii de cumpărături, scăzând opțional ce e în cămară. */
async function needsToShopping(ctx: AppCtx, needs: Need[], subtractPantry: boolean) {
  const aggregated = aggregateNeeds(needs);
  const products = await productMap(ctx.db, ctx.householdId);
  const pieces = productUnitsOf(products.values());
  let remaining = aggregated;
  let covered: Need[] = [];
  if (subtractPantry) {
    const r = subtractStock(aggregated, pantryStock(await owned(ctx.db, "pantry_items", ctx.householdId)), pieces);
    remaining = r.remaining;
    covered = r.covered;
  }
  // Din nou pe produs: după conversie, două linii (ex. 300 g și 1 lingură) pot ajunge în aceeași unitate.
  const shopping = remaining
    .filter((n) => products.has(n.product_id))
    .map((n) => toShoppingNeed(n, products.get(n.product_id)!.default_unit, pieces.get(n.product_id)));
  return { shopping, covered };
}

export interface AddToListResult {
  added: number;
  updated: number;
  /** Ingrediente pe care le ai deja în cămară. */
  covered: number;
}

/** „Adaugă ingredientele în listă” — toate sau doar ce lipsește din cămară. */
export async function addRecipeToList(ctx: AppCtx, input: { recipeId: string; servings: number; listId: string; onlyMissing: boolean }): Promise<AddToListResult> {
  const servings = parse(z.number().int().min(1).max(50), input.servings);
  const { recipe, ingredients } = await recipeWithIngredients(ctx, input.recipeId);
  const { shopping, covered } = await needsToShopping(ctx, recipeNeeds(recipe, ingredients, servings), input.onlyMissing);
  const r = await addNeeds(ctx, input.listId, shopping, "reteta");
  return { ...r, covered: covered.length };
}

/** „Am gătit rețeta” — scade ingredientele din cămară, întâi ce expiră primul. */
export async function cookRecipe(ctx: AppCtx, recipeId: string, servings: number): Promise<{ updated: number; shortfall: Need[] }> {
  const { recipe, ingredients } = await recipeWithIngredients(ctx, recipeId);
  const pantry = await owned(ctx.db, "pantry_items", ctx.householdId);
  const pieces = productUnitsOf((await productMap(ctx.db, ctx.householdId)).values());
  const { ops, shortfall } = planConsumption(pantry, aggregateNeeds(recipeNeeds(recipe, ingredients, servings)), pieces);
  for (const op of ops) await updateRow(ctx.db, "pantry_items", op.item_id, { quantity: op.new_quantity }, w(ctx));
  return { updated: ops.length, shortfall };
}

// --- Rețete proprii ---------------------------------------------------------

const recipeInput = z.object({
  name: zName(120, "Numele rețetei"),
  description: z.string().trim().max(1000).default(""),
  categories: z.array(z.enum(["mic_dejun", "pranz", "cina", "gustari", "supe_ciorbe", "traditionale", "carne", "peste", "vegetariene", "salate", "deserturi", "rapide", "meal_prep"])).min(1, "Alege cel puțin o categorie."),
  cuisine: z.enum(["romaneasca", "internationala"]).default("romaneasca"),
  servings: z.number().int().min(1, "Rețeta trebuie să aibă cel puțin o porție.").max(50),
  prep_minutes: z.number().int().min(0).max(2880),
  cook_minutes: z.number().int().min(0).max(2880),
  difficulty: z.enum(["usor", "mediu", "dificil"]),
  image_url: z.string().refine(isRecipeImageUrl, "Adresa fotografiei nu e validă.").nullable().default(null),
  source_url: z.string().regex(/^https:\/\/\S+$/, "Adresa sursei nu e validă.").max(500, "Adresa sursei nu e validă.").nullable().default(null),
  ingredients: z
    .array(z.object({ product_id: z.string().min(1), quantity: zQuantity.nullable(), unit: zUnit.nullable(), note: z.string().trim().max(120).nullable().default(null), optional: z.boolean().default(false) }))
    .min(1, "Adaugă cel puțin un ingredient."),
  steps: z.array(z.string().trim().min(1).max(1500)).min(1, "Adaugă cel puțin un pas."),
});

export type RecipeInput = z.input<typeof recipeInput>;

/**
 * Salvează o rețetă a gospodăriei (sau, pentru administratori, din catalogul
 * global: householdId = null). Ingredientele și pașii vechi se înlocuiesc.
 */
export async function saveRecipe(ctx: AppCtx, input: RecipeInput, opts: { id?: string; global?: boolean } = {}): Promise<string> {
  const v = parse(recipeInput, input);
  for (const i of v.ingredients) {
    if ((i.quantity == null) !== (i.unit == null)) throw new UserError("Fiecare ingredient are fie cantitate și unitate, fie „după gust”.");
  }
  const products = await productMap(ctx.db, ctx.householdId);
  for (const i of v.ingredients) if (!products.has(i.product_id)) throw new UserError("Un ingredient nu mai există în catalog.");
  const household_id = opts.global ? null : ctx.householdId;
  const id = opts.id ?? newId();
  const { ingredients, steps, ...fields } = v;
  await upsertRow(ctx.db, "recipes", { id, household_id, ...fields, nutrition: null } as Omit<Recipe, "created_at" | "updated_at" | "deleted_at">, w(ctx));
  for (const old of await ctx.db.recipe_ingredients.where("recipe_id").equals(id).toArray()) {
    if (!old.deleted_at) await softDelete(ctx.db, "recipe_ingredients", old.id, w(ctx));
  }
  for (const old of await ctx.db.recipe_steps.where("recipe_id").equals(id).toArray()) {
    if (!old.deleted_at) await softDelete(ctx.db, "recipe_steps", old.id, w(ctx));
  }
  for (const [k, i] of ingredients.entries()) {
    await insertRow(ctx.db, "recipe_ingredients", { id: newId(), household_id, recipe_id: id, product_id: i.product_id, quantity: i.quantity, unit: i.unit, note: i.note, optional: i.optional, sort_order: k }, w(ctx));
  }
  for (const [k, text] of steps.entries()) {
    await insertRow(ctx.db, "recipe_steps", { id: newId(), household_id, recipe_id: id, position: k, text }, w(ctx));
  }
  return id;
}

export async function deleteRecipe(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "recipes", id, w(ctx));
}

// --- Planul de mese -------------------------------------------------------------

const mealInput = z.object({
  date: zDate,
  slot: z.enum(["mic_dejun", "pranz", "cina", "gustare"]),
  recipe_id: z.string().min(1),
  servings: z.number().int().min(1, "Cel puțin o porție.").max(50),
  note: zNote.nullable().default(null),
});

export async function addMeal(ctx: AppCtx, input: z.input<typeof mealInput>): Promise<string> {
  const v = parse(mealInput, input);
  const id = newId();
  await insertRow(ctx.db, "meal_plan_items", { id, household_id: ctx.householdId, ...v }, w(ctx));
  return id;
}

export async function moveMeal(ctx: AppCtx, id: string, date: string, slot: MealSlot) {
  parse(zDate, date);
  await updateRow(ctx.db, "meal_plan_items", id, { date, slot }, w(ctx));
}

export async function updateMealServings(ctx: AppCtx, id: string, servings: number) {
  parse(z.number().int().min(1).max(50), servings);
  await updateRow(ctx.db, "meal_plan_items", id, { servings }, w(ctx));
}

export async function duplicateMeal(ctx: AppCtx, id: string, date: string, slot?: MealSlot): Promise<string> {
  const m = await ctx.db.meal_plan_items.get(id);
  if (!m) throw new UserError("Masa nu mai există în plan.");
  return addMeal(ctx, { date, slot: slot ?? m.slot, recipe_id: m.recipe_id, servings: m.servings, note: m.note });
}

export async function removeMeal(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "meal_plan_items", id, w(ctx));
}

/** Copiază mesele unei săptămâni în săptămâna următoare. */
export async function copyWeek(ctx: AppCtx, weekStart: string): Promise<number> {
  const meals = await mealsBetween(ctx, weekStart, addDays(weekStart, 6));
  for (const m of meals) await addMeal(ctx, { date: addDays(m.date, 7), slot: m.slot, recipe_id: m.recipe_id, servings: m.servings, note: m.note });
  return meals.length;
}

export async function mealsBetween(ctx: AppCtx, from: string, to: string) {
  return (await owned(ctx.db, "meal_plan_items", ctx.householdId)).filter((m) => m.date >= from && m.date <= to);
}

/**
 * Generează lista de cumpărături pentru mesele dintr-un interval: adună
 * ingredientele comune (500 g + 300 g piept de pui = 800 g), scade la cerere
 * ce e în cămară și adaugă în listă fără dubluri.
 */
export async function generateListFromPlan(ctx: AppCtx, input: { from: string; to: string; listId: string; subtractPantry: boolean }): Promise<AddToListResult & { meals: number }> {
  const meals = await mealsBetween(ctx, parse(zDate, input.from), parse(zDate, input.to));
  if (meals.length === 0) throw new UserError("Nu ai mese planificate în perioada aleasă.");
  const recipes = new Map((await visible(ctx.db, "recipes", ctx.householdId)).map((r) => [r.id, r]));
  const needs: Need[] = [];
  for (const m of meals) {
    const recipe = recipes.get(m.recipe_id);
    if (!recipe) continue;
    const ingredients = activeIngredients(await ctx.db.recipe_ingredients.where("recipe_id").equals(recipe.id).toArray(), recipe.id);
    needs.push(...recipeNeeds(recipe, ingredients, m.servings));
  }
  const { shopping, covered } = await needsToShopping(ctx, needs, input.subtractPantry);
  const r = await addNeeds(ctx, input.listId, shopping, "plan");
  return { ...r, covered: covered.length, meals: meals.length };
}

// --- Cămara ----------------------------------------------------------------------

const pantryInput = z.object({
  product_id: z.string().nullable().default(null),
  name: zName(120, "Denumirea"),
  quantity: z.number().min(0, "Cantitatea nu poate fi negativă.").max(100000),
  unit: zUnit,
  location_id: z.string().min(1),
  purchased_on: zDate.nullable().default(null),
  expires_on: zDate.nullable().default(null),
  note: zNote.nullable().default(null),
});

export async function addPantryItem(ctx: AppCtx, input: z.input<typeof pantryInput>): Promise<string> {
  const v = parse(pantryInput, input);
  const id = newId();
  await insertRow(ctx.db, "pantry_items", { id, household_id: ctx.householdId, ...v }, w(ctx));
  return id;
}

export async function updatePantryItem(ctx: AppCtx, id: string, patch: Partial<z.input<typeof pantryInput>>) {
  const v = parse(pantryInput.partial(), patch);
  const clean = Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined));
  await updateRow(ctx.db, "pantry_items", id, clean as Partial<PantryItem>, w(ctx));
}

/** Scade (sau adaugă, cu delta pozitiv) din cantitate; nu coboară sub zero. */
export async function adjustPantry(ctx: AppCtx, id: string, delta: number) {
  const item = await ctx.db.pantry_items.get(id);
  if (!item) throw new UserError("Produsul nu mai e în cămară.");
  await updateRow(ctx.db, "pantry_items", id, { quantity: Math.max(0, Math.round((item.quantity + delta) * 1000) / 1000) }, w(ctx));
}

export async function removePantryItem(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "pantry_items", id, w(ctx));
}

// --- Setări ----------------------------------------------------------------------

export async function setPantryOnPurchase(ctx: AppCtx, value: "intreaba" | "mereu" | "niciodata") {
  await upsertRow(ctx.db, "household_settings", { id: ctx.householdId, household_id: ctx.householdId, pantry_on_purchase: value, week_starts_on: 1 }, w(ctx));
}

export type { UnitCode };
