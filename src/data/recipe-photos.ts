// Fotografiile rețetelor din catalog: bănci de imagini cu licență liberă,
// aprobate de proprietar poză cu poză (.tasks/008, etapa 2). Fișierele stau
// în public/retete/{file}; pozele arată un fel asemănător, nu exact rețeta.

export type RecipePhotoLicense = "unsplash" | "pexels";

export interface RecipePhotoSeed {
  recipe_id: string;
  /** Numele fișierului din public/retete/, de forma `{recipe_id}.webp`. */
  file: string;
  author: string;
  /** Pagina fotografiei pe bancă (nu adresa imaginii). */
  source_url: string;
  license: RecipePhotoLicense;
}

export const RECIPE_PHOTO_LICENSE_LABELS: Record<RecipePhotoLicense, string> = { unsplash: "Unsplash", pexels: "Pexels" };

/** Fotografiile se mențin cu `npm run seed:sql` după fiecare schimbare. */
export const RECIPE_PHOTOS: RecipePhotoSeed[] = [];

/** Calea din aplicație a fotografiei, folosită ca `image_url`. */
export function recipePhotoUrl(seed: Pick<RecipePhotoSeed, "file">): string {
  return `/retete/${seed.file}`;
}

/** Fotografia din catalog cu această adresă (și pentru copiile rețetelor, care păstrează `image_url`). */
export function catalogPhotoByUrl(imageUrl: string | null): RecipePhotoSeed | null {
  if (!imageUrl) return null;
  return RECIPE_PHOTOS.find((p) => recipePhotoUrl(p) === imageUrl) ?? null;
}

const SOURCE: Record<RecipePhotoLicense, RegExp> = {
  unsplash: /^https:\/\/unsplash\.com\/photos\/[A-Za-z0-9_-]+$/,
  pexels: /^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+\/?$/,
};

/** Ce lipsește sau e greșit la fotografiile din listă; listă goală dacă totul e în regulă. */
export function recipePhotoProblems(photos: readonly RecipePhotoSeed[], recipeIds: ReadonlySet<string>, fileBytes: (file: string) => number | null, maxBytes = 250_000): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of photos) {
    const at = p.recipe_id || "(fără rețetă)";
    if (!recipeIds.has(p.recipe_id)) problems.push(`${at}: rețeta nu există în catalog`);
    if (seen.has(p.recipe_id)) problems.push(`${at}: are mai multe fotografii`);
    seen.add(p.recipe_id);
    if (p.file !== `${p.recipe_id}.webp`) problems.push(`${at}: fișierul trebuie să fie ${p.recipe_id}.webp`);
    const bytes = fileBytes(p.file);
    if (bytes === null) problems.push(`${at}: lipsește public/retete/${p.file}`);
    else if (bytes > maxBytes) problems.push(`${at}: fișierul are ${bytes} octeți (max. ${maxBytes})`);
    if (!p.author.trim()) problems.push(`${at}: lipsește autorul`);
    if (!(p.license in SOURCE)) problems.push(`${at}: licență necunoscută`);
    else if (!SOURCE[p.license].test(p.source_url)) problems.push(`${at}: sursa nu e o pagină ${RECIPE_PHOTO_LICENSE_LABELS[p.license]}`);
  }
  return problems;
}
