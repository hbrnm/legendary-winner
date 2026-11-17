import type { Recipe, RecipeCategoryId } from "./types";
import { normalize } from "./search";
import { totalMinutes } from "./recipes";

export const MEAL_CATEGORIES = [
  { id: "toate", label: "Toate" },
  { id: "mic_dejun", label: "Mic dejun" },
  { id: "supe_ciorbe", label: "Supe & Ciorbe" },
  { id: "principal", label: "Fel principal" },
  { id: "salate", label: "Salate & Garnituri" },
  { id: "deserturi", label: "Deserturi" },
  { id: "gustari", label: "Gustări" },
] as const;
export type MealCategory = typeof MEAL_CATEGORIES[number]["id"];
export type RecipeTimeFilter = "30" | "60" | "meal_prep";
export type RecipeStyle = Extract<RecipeCategoryId, "carne" | "peste" | "vegetariene" | "de_post" | "traditionale">;
export interface RecipeFilters {
  query?: string;
  category?: MealCategory;
  favoritesOnly?: boolean;
  pantryOnly?: boolean;
  time?: RecipeTimeFilter | null;
  style?: RecipeStyle | null;
}

/** Legacy recipes may carry several meal tags; specific dishes win over lunch/dinner. */
export function matchesMealCategory(recipe: Recipe, category: MealCategory): boolean {
  if (category === "toate") return true;
  const categories = recipe.categories;
  const specific = (["supe_ciorbe", "salate", "deserturi", "mic_dejun", "gustari"] as const).find((c) => categories.includes(c));
  if (specific) return category === specific;
  return category === "principal" && categories.some((c) => ["pranz", "cina", "carne", "peste", "vegetariene", "de_post", "traditionale"].includes(c));
}

export function filterRecipes(recipes: Recipe[], filters: RecipeFilters, context: {
  searchText: Map<string, string>;
  favorites: Set<string>;
  pantryRecipeIds: Set<string>;
}): Recipe[] {
  const words = normalize(filters.query ?? "").split(" ").filter(Boolean);
  return recipes.filter((r) => {
    if (!matchesMealCategory(r, filters.category ?? "toate")) return false;
    if (filters.favoritesOnly && !context.favorites.has(r.id)) return false;
    if (filters.pantryOnly && !context.pantryRecipeIds.has(r.id)) return false;
    if (filters.style && !r.categories.includes(filters.style)) return false;
    if (filters.time === "meal_prep" && !r.categories.includes("meal_prep")) return false;
    if (filters.time && filters.time !== "meal_prep" && totalMinutes(r) > Number(filters.time)) return false;
    const text = normalize(context.searchText.get(r.id) ?? r.name);
    return words.every((word) => text.includes(word));
  });
}
