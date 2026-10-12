import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { RECIPE_SEEDS } from "./recipes";
import { buildCatalog } from "./catalog";
import { RECIPE_PHOTOS, catalogPhotoByUrl, recipePhotoProblems, recipePhotoUrl, type RecipePhotoSeed } from "./recipe-photos";
import { isRecipeImageUrl } from "@/lib/domain/recipe-photos";

const recipeIds = new Set(RECIPE_SEEDS.map((r) => r.id));

function publicFileBytes(file: string): number | null {
  const url = new URL(`../../public/retete/${file}`, import.meta.url);
  return existsSync(url) ? statSync(url).size : null;
}

describe("fotografiile catalogului", () => {
  it("fiecare are rețetă, fișier, autor, sursă și licență", () => {
    expect(recipePhotoProblems(RECIPE_PHOTOS, recipeIds, publicFileBytes)).toEqual([]);
  });

  it("ajung în image_url al rețetei, iar celelalte rețete rămân fără fotografie", () => {
    const withPhoto = new Map(RECIPE_PHOTOS.map((p) => [p.recipe_id, recipePhotoUrl(p)]));
    for (const r of buildCatalog().recipes) {
      expect(r.image_url, r.id).toBe(withPhoto.get(r.id) ?? null);
      if (r.image_url) expect(isRecipeImageUrl(r.image_url), r.id).toBe(true);
    }
  });
});

describe("verificarea listei de fotografii", () => {
  const ok: RecipePhotoSeed = {
    recipe_id: "sarmale",
    file: "sarmale.webp",
    author: "Ana Pop",
    source_url: "https://unsplash.com/photos/a-plate-of-food-abc_123",
    license: "unsplash",
  };
  const files = (sizes: Record<string, number>) => (file: string) => sizes[file] ?? null;

  it("acceptă o fotografie completă, de pe Unsplash sau Pexels", () => {
    const pexels = { ...ok, recipe_id: "ardei-umpluti", file: "ardei-umpluti.webp", source_url: "https://www.pexels.com/photo/stuffed-peppers-1234567/", license: "pexels" as const };
    expect(recipePhotoProblems([ok, pexels], recipeIds, files({ "sarmale.webp": 150_000, "ardei-umpluti.webp": 90_000 }))).toEqual([]);
  });

  it("semnalează rețeta, fișierul, autorul, sursa și dublurile", () => {
    const problems = recipePhotoProblems(
      [
        { ...ok, recipe_id: "nu-exista", file: "nu-exista.webp" },
        { ...ok, author: " " },
        { ...ok, file: "alta.webp" },
        { ...ok, recipe_id: "ardei-umpluti", file: "ardei-umpluti.webp", source_url: "https://images.unsplash.com/photo-1.jpg" },
      ],
      recipeIds,
      files({ "sarmale.webp": 400_000, "alta.webp": 1, "ardei-umpluti.webp": 1 }),
    );
    expect(problems).toEqual([
      "nu-exista: rețeta nu există în catalog",
      "nu-exista: lipsește public/retete/nu-exista.webp",
      "sarmale: fișierul are 400000 octeți (max. 250000)",
      "sarmale: lipsește autorul",
      "sarmale: are mai multe fotografii",
      "sarmale: fișierul trebuie să fie sarmale.webp",
      "ardei-umpluti: sursa nu e o pagină Unsplash",
    ]);
  });

  it("găsește autorul după adresa fotografiei, și la copiile rețetelor", () => {
    expect(catalogPhotoByUrl(null)).toBeNull();
    expect(catalogPhotoByUrl("https://exemplu.ro/poza.webp")).toBeNull();
    for (const p of RECIPE_PHOTOS) expect(catalogPhotoByUrl(recipePhotoUrl(p))).toBe(p);
  });
});
