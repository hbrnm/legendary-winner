"use client";

import type { MealSlot, Recipe, RecipeCategoryId } from "@/lib/domain/types";
import { RECIPE_PHOTO_SOURCE_LABELS, catalogPhotoByUrl, recipePhotoLicenseLabel } from "@/data/recipe-photos";

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
export type RecipeVisualSize = "sm" | "md" | "lg";

/** Dimensiunile imaginii unei rețete, la fel pentru fotografia din catalog și cea a gospodăriei. */
export const visualDims = (size: RecipeVisualSize) => (size === "lg" ? "h-44 w-full rounded-3xl" : size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl");

export function RecipeVisual({ recipe, size = "md" }: { recipe: Pick<Recipe, "image_url">; size?: RecipeVisualSize }) {
  if (!recipe.image_url) return null;
  // O poză din catalog scoasă din listă nu se mai arată, chiar dacă baza de pe server o mai are (15 oct. 2026).
  if (recipe.image_url.startsWith("/retete/") && !catalogPhotoByUrl(recipe.image_url)) return null;
  const dims = visualDims(size);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={recipe.image_url} alt="" className={`${dims} shrink-0 object-cover`} loading="lazy" />;
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
