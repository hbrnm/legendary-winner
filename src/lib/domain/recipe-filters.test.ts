import { describe, expect, it } from "vitest";
import { recipe } from "@/test/factories";
import { filterRecipes, matchesMealCategory } from "./recipe-filters";

// Wrong category precedence must not turn soup or dessert into a main course.
describe("recipe category mapping", () => {
  it("keeps meal categories exclusive when legacy recipes have several tags", () => {
    expect(matchesMealCategory(recipe({ categories: ["pranz", "supe_ciorbe", "carne"] }), "principal")).toBe(false);
    expect(matchesMealCategory(recipe({ categories: ["cina", "salate"] }), "principal")).toBe(false);
    expect(matchesMealCategory(recipe({ categories: ["carne"] }), "principal")).toBe(true);
    expect(matchesMealCategory(recipe({ categories: ["cina"] }), "principal")).toBe(true);
    expect(matchesMealCategory(recipe({ categories: ["mic_dejun", "vegetariene"] }), "principal")).toBe(false);
    expect(matchesMealCategory(recipe({ categories: ["deserturi"] }), "deserturi")).toBe(true);
  });
});

describe("combined recipe filters", () => {
  const recipes = [
    recipe({ id: "a", name: "Supă de legume", categories: ["supe_ciorbe", "vegetariene"], prep_minutes: 10, cook_minutes: 15 }),
    recipe({ id: "b", name: "Supă de post", categories: ["supe_ciorbe", "de_post"], prep_minutes: 10, cook_minutes: 20 }),
    recipe({ id: "c", name: "Supă lentă", categories: ["supe_ciorbe", "de_post", "meal_prep"], prep_minutes: 15, cook_minutes: 60 }),
  ];
  const context = { searchText: new Map([["a", "supă de legume dovlecei"], ["b", "supă de post dovlecei"], ["c", "supă lentă dovlecei"]]), favorites: new Set(["b", "c"]), pantryRecipeIds: new Set(["b"]) };
  it("combines ingredient search, favorites, pantry, category and time", () => {
    expect(filterRecipes(recipes, { query: "DOVLECEI", category: "supe_ciorbe", favoritesOnly: true, pantryOnly: true, time: "30" }, context).map((r) => r.id)).toEqual(["b"]);
  });
  it("uses explicit post tags only, and din timp uses meal prep rather than duration", () => {
    expect(filterRecipes(recipes, { style: "de_post" }, context).map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterRecipes(recipes, { time: "meal_prep" }, context).map((r) => r.id)).toEqual(["c"]);
  });
});
