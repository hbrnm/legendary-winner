// Fotografiile rețetelor din catalog: bănci de imagini cu licență liberă
// (Unsplash, Pexels), fiecare aprobată de proprietar (.tasks/008, etapa 2).
// Fișierele stau în public/retete/ și se servesc din aplicație.

export interface RecipePhotoSeed {
  recipe_id: string;
  /** Numele fișierului din public/retete/, ex. „ciorba-perisoare.webp”. */
  file: string;
  author: string;
  /** Pagina fotografiei pe site-ul băncii. */
  source_url: string;
  license: "Unsplash" | "Pexels";
}

export const RECIPE_PHOTO_SEEDS: RecipePhotoSeed[] = [];

export function recipeImageUrl(recipeId: string): string | null {
  const seed = RECIPE_PHOTO_SEEDS.find((p) => p.recipe_id === recipeId);
  return seed ? `/retete/${seed.file}` : null;
}
