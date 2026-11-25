"use client";

import type { MealSlot, Recipe, RecipeCategoryId } from "@/lib/domain/types";
import { RECIPE_PHOTO_SOURCE_LABELS, catalogPhotoByUrl, recipePhotoLicenseLabel } from "@/data/recipe-photos";
import { ChefHat, MealEveningIcon, MealMorningIcon, MealNoonIcon, MealSnackIcon } from "@/components/ui/icons";

export const SLOT_LABELS: Record<MealSlot, string> = { mic_dejun: "Mic dejun", pranz: "Prânz", cina: "Cină", gustare: "Gustare" };

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategoryId, string> = {
  mic_dejun: "Mic dejun",
  pranz: "Prânz",
  cina: "Cină",
  gustari: "Gustări",
  supe_ciorbe: "Supe și ciorbe",
  traditionale: "Tradiționale",
  carne: "Carne",
  peste: "Pește",
  vegetariene: "Vegetariene",
  de_post: "De post",
  salate: "Salate",
  deserturi: "Deserturi",
  rapide: "Rapide",
  meal_prep: "Din timp",
};

export const DIFFICULTY_LABELS = { usor: "Ușor", mediu: "Mediu", dificil: "Dificil" } as const;

/**
 * Fotografia rețetei, dacă există. Fără fotografie nu se afișează nimic:
 * pătrățelele colorate cu pictograme au fost scoase (decizia proprietarului, 12 oct. 2026).
 */
export type RecipeVisualSize = "sm" | "md" | "lg";

/** Dimensiunile imaginii unei rețete, la fel pentru fotografia din catalog și cea a gospodăriei. */
export const visualDims = (size: RecipeVisualSize) => (size === "lg" ? "h-44 w-full rounded-xl" : size === "sm" ? "h-12 w-12 rounded-md" : "h-16 w-16 rounded-md");

export function RecipeVisual({ recipe, size = "md", priority = false }: { recipe: Pick<Recipe, "image_url">; size?: RecipeVisualSize; priority?: boolean }) {
  // O poză din catalog scoasă din listă nu se mai arată, chiar dacă baza de pe server o mai are (15 oct. 2026).
  if (!recipe.image_url || !hasRecipeVisual(recipe)) return null;
  const dims = visualDims(size);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={recipe.image_url} alt="" className={`${dims} shrink-0 object-cover`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} />;
}

/** Inițiala numelui rețetei, cu majusculă românească (ș → Ș). */
export function recipeInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase("ro-RO") || "?";
}

/** Kept for callers using the old avatar API; no placeholder without a photo. */
export function RecipeAvatar({ recipe, size = "md" }: { recipe: Pick<Recipe, "name">; size?: "sm" | "md" }) {
  void recipe;
  void size;
  return null;
}

export type MealBadgeKey = "mic_dejun" | "pranz" | "cina" | "gustari" | "alte";

const MEAL_BADGE_STYLES: Record<MealBadgeKey, { classes: string; Icon: typeof MealMorningIcon }> = {
  mic_dejun: { classes: "bg-meal-morning text-meal-morning-ink", Icon: MealMorningIcon },
  pranz: { classes: "bg-meal-noon text-meal-noon-ink", Icon: MealNoonIcon },
  cina: { classes: "bg-meal-evening text-meal-evening-ink", Icon: MealEveningIcon },
  gustari: { classes: "bg-meal-snack text-meal-snack-ink", Icon: MealSnackIcon },
  alte: { classes: "bg-surface-2 text-brand", Icon: ChefHat },
};

export function resolveMealBadge(categories?: RecipeCategoryId[], meal?: MealSlot | MealBadgeKey): MealBadgeKey {
  if (meal === "gustare") return "gustari";
  if (meal && meal in MEAL_BADGE_STYLES) return meal as MealBadgeKey;
  if (categories) {
    for (const key of ["mic_dejun", "pranz", "cina", "gustari"] as const) {
      if (categories.includes(key)) return key;
    }
  }
  return "alte";
}

export function mealBadgeClasses(meal: MealSlot | MealBadgeKey): string {
  return MEAL_BADGE_STYLES[resolveMealBadge(undefined, meal)].classes;
}

/** Insignă colorată pe tip de masă pentru rețetele fără fotografie și etichetele de categorie. */
export function RecipeMealBadge({
  categories,
  meal,
  size = "md",
}: {
  categories?: RecipeCategoryId[];
  meal?: MealSlot | MealBadgeKey;
  size?: "sm" | "md";
}) {
  const key = resolveMealBadge(categories, meal);
  const { classes, Icon } = MEAL_BADGE_STYLES[key];
  const dims = size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${dims} ${classes}`}>
      <Icon size={size === "sm" ? 21 : 26} strokeWidth={1.75} />
    </span>
  );
}

/** Dacă fotografia rețetei se poate afișa (există și nu e o poză retrasă din catalog). */
export function hasRecipeVisual(recipe: Pick<Recipe, "image_url">): boolean {
  if (!recipe.image_url) return false;
  if (!recipe.image_url.startsWith("/retete/")) return true;
  const photo = catalogPhotoByUrl(recipe.image_url);
  return !!photo && photo.source !== "ai";
}

/**
 * Mențiunea autorului, sub o fotografie din catalog: „Foto: Ana Pop / Unsplash”,
 * iar la Wikimedia și licența: „Foto: Ana Pop / Wikimedia Commons · CC BY-SA 4.0” (texte aprobate, 12 oct. 2026).
 * Imaginile AI nu au mențiune (decizia proprietarului, 15 oct. 2026).
 */
export function RecipePhotoCredit({ recipe }: { recipe: Pick<Recipe, "image_url"> }) {
  const photo = catalogPhotoByUrl(recipe.image_url);
  if (!photo || photo.source === "ai") return null;
  const link = "-my-3 inline-block py-3 underline underline-offset-2";
  const license = recipePhotoLicenseLabel(photo.license);
  return (
    <p className="mt-1 text-xs text-ink-2">
      Foto: {photo.author} /{" "}
      <a href={photo.source_url} target="_blank" rel="noopener noreferrer" className={link}>
        {RECIPE_PHOTO_SOURCE_LABELS[photo.source]}
      </a>
      {photo.source === "wikimedia" && (
        <>
          {" · "}
          {photo.license_url ? (
            <a href={photo.license_url} target="_blank" rel="noopener noreferrer license" className={link}>
              {license}
            </a>
          ) : (
            license
          )}
        </>
      )}
    </p>
  );
}

export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "gluten",
  crustacee: "crustacee",
  oua: "ouă",
  peste: "pește",
  arahide: "arahide",
  soia: "soia",
  lapte: "lapte",
  fructe_coaja: "fructe cu coajă",
  telina: "țelină",
  mustar: "muștar",
  susan: "susan",
  sulfiti: "sulfiți",
  lupin: "lupin",
  moluste: "moluște",
};
