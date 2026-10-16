// Fotografiile rețetelor din catalog: bănci de imagini cu licență liberă,
// aprobate de proprietar poză cu poză (.tasks/008, etapa 2). Fișierele stau
// în public/retete/{file}; pozele arată un fel asemănător, nu exact rețeta.
// Wikimedia Commons: doar CC0, domeniu public, CC BY și CC BY-SA (decizia
// proprietarului, 12 oct. 2026); fișierele micșorate păstrează licența originalului.

import { RECIPE_PHOTO_LIST } from "./recipe-photos-list";

/** `ai`: imagine generată (etapa 2c), fără autor, sursă sau licență (decizia proprietarului, 15 oct. 2026). */
export type RecipePhotoSource = "unsplash" | "pexels" | "wikimedia" | "ai";

export interface RecipePhotoSeed {
  recipe_id: string;
  /** Numele fișierului din public/retete/, de forma `{recipe_id}.webp`. */
  file: string;
  author: string;
  /** Pagina fotografiei pe bancă (nu adresa imaginii). */
  source_url: string;
  source: RecipePhotoSource;
  /** Licența, cum o scrie banca: „CC BY-SA 4.0”, „CC0”, „Public domain”; la Unsplash și Pexels, licența lor. */
  license: string;
  /** Textul licenței; obligatoriu la CC BY și CC BY-SA. */
  license_url: string | null;
}

export const RECIPE_PHOTO_SOURCE_LABELS: Record<RecipePhotoSource, string> = { unsplash: "Unsplash", pexels: "Pexels", wikimedia: "Wikimedia Commons", ai: "imagine AI" };

/** Fotografiile aprobate (în `recipe-photos-list.ts`); după fiecare schimbare, `npm run seed:sql`. */
export const RECIPE_PHOTOS: readonly RecipePhotoSeed[] = RECIPE_PHOTO_LIST;

/** Numele licenței, cum apare sub fotografie. */
export function recipePhotoLicenseLabel(license: string): string {
  return license === "Public domain" ? "domeniu public" : license;
}

/** Calea din aplicație a fotografiei, folosită ca `image_url`. */
export function recipePhotoUrl(seed: Pick<RecipePhotoSeed, "file">): string {
  return `/retete/${seed.file}`;
}

/** Fotografia din catalog cu această adresă (și pentru copiile rețetelor, care păstrează `image_url`). */
export function catalogPhotoByUrl(imageUrl: string | null): RecipePhotoSeed | null {
  if (!imageUrl) return null;
  return RECIPE_PHOTOS.find((p) => recipePhotoUrl(p) === imageUrl) ?? null;
}

const SOURCE: Record<Exclude<RecipePhotoSource, "ai">, RegExp> = {
  unsplash: /^https:\/\/unsplash\.com\/photos\/[A-Za-z0-9_-]+$/,
  pexels: /^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+\/?$/,
  wikimedia: /^https:\/\/commons\.wikimedia\.org\/wiki\/File:\S+$/,
};

/** Licențele acceptate de pe Wikimedia Commons; cele CC BY cer autorul și legătura către licență. */
const WIKIMEDIA_LICENSE = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/;

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
    if (p.source === "ai") {
      if (p.author || p.source_url || p.license || p.license_url) problems.push(`${at}: imaginea AI nu are autor, sursă sau licență`);
      continue;
    }
    if (!p.author.trim()) problems.push(`${at}: lipsește autorul`);
    if (!(p.source in SOURCE)) problems.push(`${at}: sursă necunoscută`);
    else if (!SOURCE[p.source].test(p.source_url)) problems.push(`${at}: sursa nu e o pagină ${RECIPE_PHOTO_SOURCE_LABELS[p.source]}`);
    if (p.source === "wikimedia" && !WIKIMEDIA_LICENSE.test(p.license)) problems.push(`${at}: licența „${p.license}” nu e acceptată`);
    if (p.license.startsWith("CC BY") && !p.license_url?.startsWith("https://creativecommons.org/")) problems.push(`${at}: lipsește legătura către licență`);
  }
  return problems;
}
