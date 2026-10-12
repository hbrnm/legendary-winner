import { describe, expect, it } from "vitest";
import { chooseRecipePhoto, fitWithin, isRecipeImageUrl, recipePhotoPath } from "./recipe-photos";
import type { RecipePhoto } from "./types";

const H = "h1";
function photo(over: Partial<RecipePhoto> = {}): RecipePhoto {
  return {
    id: "f1",
    household_id: H,
    recipe_id: "ciorba",
    storage_path: `${H}/ciorba/f1.webp`,
    width: 1280,
    height: 960,
    created_by: null,
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

describe("fotografia afișată", () => {
  const catalog = { id: "ciorba", image_url: "/retete/ciorba.webp" };

  it("preferă fotografia gospodăriei", () => {
    const p = photo();
    expect(chooseRecipePhoto(catalog, [p], H)).toEqual({ kind: "household", photo: p });
  });

  it("fără fotografia gospodăriei, folosește catalogul; fără nimic, null", () => {
    expect(chooseRecipePhoto(catalog, [], H)).toEqual({ kind: "catalog", src: "/retete/ciorba.webp" });
    expect(chooseRecipePhoto({ id: "ciorba", image_url: null }, [], H)).toBeNull();
  });

  it("ignoră pozele șterse, ale altor rețete și ale altor gospodării", () => {
    const photos = [photo({ deleted_at: "2026-10-12T11:00:00.000Z" }), photo({ id: "f2", recipe_id: "alta" }), photo({ id: "f3", household_id: "h2" })];
    expect(chooseRecipePhoto(catalog, photos, H)).toEqual({ kind: "catalog", src: "/retete/ciorba.webp" });
    expect(chooseRecipePhoto({ id: "ciorba", image_url: null }, photos, null)).toBeNull();
  });

  it("dacă sunt mai multe, o alege pe cea mai nouă", () => {
    const nou = photo({ id: "f2", updated_at: "2026-10-12T12:00:00.000Z" });
    expect(chooseRecipePhoto(catalog, [photo(), nou], H)).toEqual({ kind: "household", photo: nou });
  });
});

describe("micșorarea", () => {
  it("aduce latura mare la 1280 px, cu proporțiile păstrate", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 960, height: 1280 });
  });

  it("nu mărește pozele mici", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("nu ajunge la 0 px la panorame extreme și refuză dimensiunile invalide", () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1280, height: 1 });
    expect(() => fitWithin(0, 100)).toThrow();
  });
});

describe("calea în Storage", () => {
  it("începe cu gospodăria", () => {
    expect(recipePhotoPath("8f0c-11", "ciorba-perisoare", "f1", "webp")).toBe("8f0c-11/ciorba-perisoare/f1.webp");
  });

  it("refuză segmentele care ar ieși din dosarul gospodăriei", () => {
    expect(() => recipePhotoPath("h1/../h2", "r", "f", "jpg")).toThrow();
    expect(() => recipePhotoPath("h1", "", "f", "jpg")).toThrow();
  });
});

describe("image_url", () => {
  it("acceptă https și fotografiile catalogului", () => {
    expect(isRecipeImageUrl("https://exemplu.ro/ciorba.jpg")).toBe(true);
    expect(isRecipeImageUrl("/retete/ciorba-perisoare.webp")).toBe(true);
  });

  it("refuză alte căi și protocoale", () => {
    for (const v of ["http://exemplu.ro/a.jpg", "javascript:alert(1)", "/retete/../x.webp", "/altceva/a.webp", "ciorba.webp"]) expect(isRecipeImageUrl(v)).toBe(false);
  });
});
