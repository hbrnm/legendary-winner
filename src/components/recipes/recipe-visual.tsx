"use client";

import type { MealSlot, Recipe, RecipeCategoryId } from "@/lib/domain/types";
import { RECIPE_PHOTO_LICENSE_LABELS, catalogPhotoByUrl } from "@/data/recipe-photos";

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
  salate: "Salate",
  deserturi: "Deserturi",
  rapide: "Rapide",
  meal_prep: "Meal prep",
};

export const DIFFICULTY_LABELS = { usor: "Ușor", mediu: "Mediu", dificil: "Dificil" } as const;

/**
 * Fotografia rețetei, dacă există. Fără fotografie nu se afișează nimic:
 * pătrățelele colorate cu pictograme au fost scoase (decizia proprietarului, 12 oct. 2026).
 */
export function RecipeVisual({ recipe, size = "md" }: { recipe: Pick<Recipe, "image_url">; size?: "sm" | "md" | "lg" }) {
  if (!recipe.image_url) return null;
  const dims = size === "lg" ? "h-44 w-full rounded-3xl" : size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={recipe.image_url} alt="" className={`${dims} shrink-0 object-cover`} loading="lazy" />;
}

/** Mențiunea autorului, sub o fotografie din catalog: „Foto: Ana Pop / Unsplash” (text aprobat, 12 oct. 2026). */
export function RecipePhotoCredit({ recipe }: { recipe: Pick<Recipe, "image_url"> }) {
  const photo = catalogPhotoByUrl(recipe.image_url);
  if (!photo) return null;
  return (
    <p className="mt-1 text-xs text-ink-2">
      Foto: {photo.author} /{" "}
      <a href={photo.source_url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 underline underline-offset-2">
        {RECIPE_PHOTO_LICENSE_LABELS[photo.license]}
      </a>
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
