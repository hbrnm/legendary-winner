import type { NutritionValues } from "./recipes";

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
  servings: number;
  manual_kcal: number | null;
}

export const kcalFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

export function entryEnergy(entry: CalorieEntry): number | null {
  if (entry.manual_kcal != null) return entry.manual_kcal;
  return entry.recipe?.per_serving ? entry.recipe.per_serving.kcal * entry.servings : null;
}

export function entryIncomplete(entry: CalorieEntry): boolean {
  return entryEnergy(entry) == null || (entry.manual_kcal == null && entry.recipe?.incomplete === true);
}

export function energySummary(entries: CalorieEntry[]): string {
  if (entries.length === 0) return "0 kcal";
  const known = entries.map(entryEnergy).filter((energy) => energy != null);
  if (known.length === 0) return "Calorii necunoscute";
  const kcal = known.reduce((sum, value) => sum + value, 0);
  return `${kcalFormat.format(kcal)} kcal${entries.some(entryIncomplete) ? " · Total incomplet" : ""}`;
}
