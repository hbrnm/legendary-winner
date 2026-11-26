import { mealForHour, scaleNutrition, type NutritionValues } from "./recipes";
import { normalize } from "./search";
import type { MealSlot } from "./types";
import { convertForProduct } from "./units";

export interface CalorieGoal {
  kcal: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export interface CaloriePreferences {
  user_id: string;
  goal?: CalorieGoal | null;
}

export const MEAL_SLOTS: readonly { slot: MealSlot; label: string }[] = [
  { slot: "mic_dejun", label: "Mic dejun" },
  { slot: "pranz", label: "Prânz" },
  { slot: "cina", label: "Cină" },
  { slot: "gustare", label: "Gustări" },
];

export function defaultMealForDate(date: Date): MealSlot {
  return mealForHour(date.getHours());
}

export interface ProductNutritionLabel {
  user_id: string;
  product_id: string;
  basis: "g" | "ml";
  preparation: "raw" | "cooked" | "as_sold";
  values: NutritionValues;
  open_food_facts_code?: string;
}

export interface ProductNutritionSuggestion {
  code: string;
  name: string;
  brand: string;
  quantity: string;
  nutrition: { basis: ProductNutritionLabel["basis"]; values: NutritionValues } | null;
}

export type FoodUnit = "g" | "ml" | "buc";

export interface FoodCalorieSnapshot {
  name: string;
  per_100: NutritionValues | null;
  basis: "g" | "ml";
  piece_grams?: number | null;
  grams_per_ml?: number | null;
  quantity: number;
  unit: FoodUnit;
  source?: string;
  open_food_facts_code?: string;
  product_id?: string;
}

export interface CalorieSnapshot {
  name: string;
  per_serving: NutritionValues | null;
  source: "declared" | "estimated";
  incomplete: boolean;
}

export interface CalorieEntry {
  id: string;
  user_id: string;
  date: string;
  meal?: MealSlot | null;
  logged_at?: string | null;
  recipe: CalorieSnapshot | null;
  food?: FoodCalorieSnapshot | null;
  label?: string | null;
  servings: number;
  manual_kcal: number | null;
}

export const kcalFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
export const macroFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });

export function foodUnitsFor(food: Pick<FoodCalorieSnapshot, "basis" | "piece_grams" | "grams_per_ml">): FoodUnit[] {
  const units: FoodUnit[] = [food.basis];
  if (food.grams_per_ml && food.grams_per_ml > 0) {
    units.push(food.basis === "g" ? "ml" : "g");
  }
  if (food.piece_grams && food.piece_grams > 0 && (food.basis === "g" || (food.grams_per_ml && food.grams_per_ml > 0))) {
    units.push("buc");
  }
  return units;
}

export function foodNutrition(food: FoodCalorieSnapshot): NutritionValues | null {
  if (!food.per_100 || !Number.isFinite(food.quantity) || food.quantity <= 0) return null;
  const amount = convertForProduct(food.quantity, food.unit, food.basis, {
    piece_grams: food.piece_grams,
    grams_per_ml: food.grams_per_ml,
  });
  if (amount == null || !Number.isFinite(amount)) return null;
  return scaleNutrition(food.per_100, amount / 100);
}

export function entryNutrition(entry: CalorieEntry): NutritionValues | null {
  if (entry.manual_kcal != null) return null;
  if (entry.food) return foodNutrition(entry.food);
  return entry.recipe?.per_serving ? scaleNutrition(entry.recipe.per_serving, entry.servings) : null;
}

export function entryEnergy(entry: CalorieEntry): number | null {
  if (entry.manual_kcal != null) return entry.manual_kcal;
  if (entry.food) return foodNutrition(entry.food)?.kcal ?? null;
  return entry.recipe?.per_serving ? entry.recipe.per_serving.kcal * entry.servings : null;
}

export function entryIncomplete(entry: CalorieEntry): boolean {
  return entryEnergy(entry) == null || (entry.manual_kcal == null && entry.recipe?.incomplete === true);
}

/** Formatează macronutrienții prescurtat pentru intrări (P · C · G = Proteine · Carbohidrați · Grăsimi). */
export function formatMacros(values: Pick<NutritionValues, "protein_g" | "carbs_g" | "fat_g">): string {
  return `P ${macroFormat.format(values.protein_g)} g · C ${macroFormat.format(values.carbs_g)} g · G ${macroFormat.format(values.fat_g)} g`;
}

/** Formatează macronutrienții cu cuvinte întregi pentru totalul zilei. */
export function formatDailyMacros(values: Pick<NutritionValues, "protein_g" | "carbs_g" | "fat_g">): string {
  return `Proteine ${macroFormat.format(values.protein_g)} g · Carbohidrați ${macroFormat.format(values.carbs_g)} g · Grăsimi ${macroFormat.format(values.fat_g)} g`;
}

export function dailyTotals(entries: readonly CalorieEntry[]): {
  kcal: number | null;
  macros: Pick<NutritionValues, "protein_g" | "carbs_g" | "fat_g"> | null;
  incomplete: boolean;
} {
  let kcalCount = 0;
  let kcalSum = 0;
  let macroCount = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;
  let incomplete = false;

  for (const entry of entries) {
    const energy = entryEnergy(entry);
    if (energy != null) {
      kcalSum += energy;
      kcalCount++;
    }
    if (entryIncomplete(entry)) incomplete = true;
    const n = entryNutrition(entry);
    if (n) {
      protein_g += n.protein_g;
      carbs_g += n.carbs_g;
      fat_g += n.fat_g;
      macroCount++;
    }
  }

  return {
    kcal: kcalCount === 0 ? null : kcalSum,
    macros: macroCount === 0 ? null : { protein_g, carbs_g, fat_g },
    incomplete,
  };
}

export function macrosSummary(entries: CalorieEntry[]): string | null {
  const { macros } = dailyTotals(entries);
  return macros ? formatDailyMacros(macros) : null;
}

export function goalProgress(consumed: number, target: number): { pct: number; remaining: number; over: boolean } {
  const remaining = target - consumed;
  return {
    pct: target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0,
    remaining,
    over: consumed > target,
  };
}

export function recentFoodChoices(entries: readonly CalorieEntry[], limit = 8): CalorieEntry[] {
  const sorted = [...entries].sort((a, b) => (b.logged_at ?? b.date).localeCompare(a.logged_at ?? a.date));
  const seen = new Set<string>();
  const picked: CalorieEntry[] = [];
  for (const entry of sorted) {
    let key: string | null = null;
    if (entry.food) {
      key = `food:${entry.food.product_id ?? entry.food.open_food_facts_code ?? normalize(entry.food.name)}`;
    } else if (entry.recipe) {
      key = `recipe:${normalize(entry.recipe.name)}`;
    } else if (entry.label?.trim()) {
      key = `manual:${normalize(entry.label)}`;
    }
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(entry);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function formatFoodQuantity(food: Pick<FoodCalorieSnapshot, "quantity" | "unit">): string {
  return `${kcalFormat.format(food.quantity)} ${food.unit}`;
}

export function energySummary(entries: CalorieEntry[]): string {
  if (entries.length === 0) return "0 kcal";
  const { kcal, incomplete } = dailyTotals(entries);
  if (kcal == null) return "Calorii necunoscute";
  return `${kcalFormat.format(kcal)} kcal${incomplete ? " · Total incomplet" : ""}`;
}
