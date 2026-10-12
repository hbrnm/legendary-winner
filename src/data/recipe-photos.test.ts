import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { RECIPE_SEEDS } from "./recipes";
import { RECIPE_PHOTO_SEEDS, recipeImageUrl } from "./recipe-photos";
import { buildCatalog } from "./catalog";
import { isRecipeImageUrl } from "@/lib/domain/recipe-photos";

const SOURCES = { Unsplash: /^https:\/\/unsplash\.com\/photos\/[A-Za-z0-9_-]+$/, Pexels: /^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+\/$/ };

describe("fotografiile rețetelor din catalog", () => {
  it("fiecare are rețetă, fișier, autor, sursă și licență", () => {
    const recipes = new Set(RECIPE_SEEDS.map((r) => r.id));
    for (const p of RECIPE_PHOTO_SEEDS) {
      expect(recipes.has(p.recipe_id), p.recipe_id).toBe(true);
      expect(p.file, p.recipe_id).toBe(`${p.recipe_id}.webp`);
      expect(existsSync(`public/retete/${p.file}`), p.file).toBe(true);
      expect(p.author.trim(), p.recipe_id).not.toBe("");
      expect(p.source_url, p.recipe_id).toMatch(SOURCES[p.license]);
    }
  });

  it("cel mult una pe rețetă", () => {
    const ids = RECIPE_PHOTO_SEEDS.map((p) => p.recipe_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ajung în catalog ca image_url valid; rețetele fără poză rămân cu null", () => {
    const catalog = buildCatalog();
    for (const r of catalog.recipes) {
      expect(r.image_url).toBe(recipeImageUrl(r.id));
      if (r.image_url) expect(isRecipeImageUrl(r.image_url)).toBe(true);
    }
  });
});
