import type { ProductSeed, RecipeSeed } from "../seed-types";
import collection from "./meal-catalog.json";

// The attachment supplies stable slugs, raw ingredient quantities and nutrition per serving.
export const RECIPE_SEEDS = collection.recipes as RecipeSeed[];
export const MEAL_INGREDIENT_PRODUCTS = collection.products as ProductSeed[];
