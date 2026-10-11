"use client";

import { Beef, CakeSlice, Coffee, Fish, Leaf, Salad, Soup, Cookie, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { MealSlot, Recipe, RecipeCategoryId } from "@/lib/domain/types";

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

const VISUALS: { cat: RecipeCategoryId; icon: LucideIcon; tone: string }[] = [
  { cat: "deserturi", icon: CakeSlice, tone: "bg-accent-soft text-accent" },
  { cat: "supe_ciorbe", icon: Soup, tone: "bg-warn-soft text-warn" },
  { cat: "salate", icon: Salad, tone: "bg-brand-soft text-brand" },
  { cat: "peste", icon: Fish, tone: "bg-info-soft text-info" },
  { cat: "mic_dejun", icon: Coffee, tone: "bg-warn-soft text-warn" },
  { cat: "gustari", icon: Cookie, tone: "bg-warn-soft text-warn" },
  { cat: "carne", icon: Beef, tone: "bg-accent-soft text-accent" },
  { cat: "vegetariene", icon: Leaf, tone: "bg-brand-soft text-brand" },
];

/** Ilustrația rețetei: fotografia, dacă există, altfel o pictogramă după categorie. */
export function RecipeVisual({ recipe, size = "md" }: { recipe: Pick<Recipe, "categories" | "image_url" | "name">; size?: "sm" | "md" | "lg" }) {
  const v = VISUALS.find((x) => recipe.categories.includes(x.cat));
  const Icon = v?.icon ?? UtensilsCrossed;
  const dims = size === "lg" ? "h-44 w-full rounded-3xl" : size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl";
  if (recipe.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={recipe.image_url} alt="" className={`${dims} shrink-0 object-cover`} loading="lazy" />;
  }
  return (
    <div className={`${dims} ${v?.tone ?? "bg-surface-2 text-ink-2"} flex shrink-0 items-center justify-center`} aria-hidden>
      <Icon size={size === "lg" ? 56 : size === "sm" ? 22 : 28} strokeWidth={1.6} />
    </div>
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
