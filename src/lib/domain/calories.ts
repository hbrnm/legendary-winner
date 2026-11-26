import { scaleNutrition, type NutritionValues } from "./recipes";
import { convertForProduct } from "./units";

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

export function formatMacros(values: Pick<NutritionValues, "protein_g" | "carbs_g" | "fat_g">): string {
  return `P ${macroFormat.format(values.protein_g)} g · G ${macroFormat.format(values.carbs_g)} g · L ${macroFormat.format(values.fat_g)} g`;
}

export function macrosSummary(entries: CalorieEntry[]): string | null {
  let counted = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;
  for (const entry of entries) {
    const n = entryNutrition(entry);
    if (!n) continue;
    protein_g += n.protein_g;
    carbs_g += n.carbs_g;
    fat_g += n.fat_g;
    counted++;
  }
  return counted === 0 ? null : formatMacros({ protein_g, carbs_g, fat_g });
}

export function formatFoodQuantity(food: Pick<FoodCalorieSnapshot, "quantity" | "unit">): string {
  return `${kcalFormat.format(food.quantity)} ${food.unit}`;
}

export function energySummary(entries: CalorieEntry[]): string {
  if (entries.length === 0) return "0 kcal";
  const known = entries.map(entryEnergy).filter((energy) => energy != null);
  if (known.length === 0) return "Calorii necunoscute";
  const kcal = known.reduce((sum, value) => sum + value, 0);
  return `${kcalFormat.format(kcal)} kcal${entries.some(entryIncomplete) ? " · Total incomplet" : ""}`;
}
