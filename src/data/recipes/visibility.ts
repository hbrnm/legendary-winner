import type { Recipe } from "@/lib/domain/types";
import retiredRecipeIds from "./retired-ids.json";

const retired = new Set(retiredRecipeIds);

/** Existing plans can still resolve their stored recipe IDs. */
export function isAvailableRecipe(recipe: Pick<Recipe, "household_id" | "id">): boolean {
  return recipe.household_id !== null || !retired.has(recipe.id);
}
