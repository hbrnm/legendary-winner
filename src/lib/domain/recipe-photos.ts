import type { Recipe, RecipePhoto } from "./types";

/** Latura mare a fotografiei după micșorarea pe telefon. */
export const RECIPE_PHOTO_MAX_SIDE = 1280;

export type RecipePhotoExt = "webp" | "jpg";

/** Fotografia care se afișează la o rețetă: a gospodăriei, apoi cea din catalog, altfel nimic. */
export type ChosenRecipePhoto = { kind: "household"; photo: RecipePhoto } | { kind: "catalog"; src: string } | null;

export function chooseRecipePhoto(recipe: Pick<Recipe, "id" | "image_url">, photos: readonly RecipePhoto[], householdId: string | null): ChosenRecipePhoto {
  let own: RecipePhoto | null = null;
  for (const p of photos) {
    if (p.recipe_id !== recipe.id || p.household_id !== householdId || p.deleted_at) continue;
    if (!own || p.updated_at > own.updated_at) own = p;
  }
  if (own) return { kind: "household", photo: own };
  return recipe.image_url ? { kind: "catalog", src: recipe.image_url } : null;
}

/** Dimensiunile după micșorare: păstrează proporțiile, nu mărește niciodată. */
export function fitWithin(width: number, height: number, maxSide = RECIPE_PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error("Dimensiuni invalide.");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const SEGMENT = /^[A-Za-z0-9_-]+$/;

/** Calea fișierului în Storage; primul segment e gospodăria (pe el se aplică RLS). */
export function recipePhotoPath(householdId: string, recipeId: string, photoId: string, ext: RecipePhotoExt): string {
  for (const s of [householdId, recipeId, photoId]) if (!SEGMENT.test(s)) throw new Error("Segment invalid în calea fotografiei.");
  return `${householdId}/${recipeId}/${photoId}.${ext}`;
}

const CATALOG_PATH = /^\/retete\/[a-z0-9-]+\.(webp|jpg)$/;

/** `image_url` acceptă un URL https sau o fotografie din catalog, servită din aplicație (`/retete/…`). */
export function isRecipeImageUrl(value: string): boolean {
  if (CATALOG_PATH.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
