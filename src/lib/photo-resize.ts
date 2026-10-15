import { fitWithin } from "@/lib/domain/recipe-photos";
import { RECIPE_PHOTO_MAX_BYTES, type NewRecipePhoto } from "@/lib/services/recipe-photos";

// Micșorarea fotografiei pe telefon, înainte de salvare (.tasks/008): latura
// mare max. 1280 px, WebP (JPEG dacă browserul nu poate), țintă ~200 KB.
// Recodarea prin canvas pierde metadatele (EXIF, locația GPS).

/** Calitățile încercate pe rând, până fișierul trece sub țintă. */
export const PHOTO_QUALITIES = [0.82, 0.7, 0.58, 0.46] as const;
export const PHOTO_TARGET_BYTES = 220_000;

/** Prima variantă sub țintă; altfel cea mai mică, dacă încape în limita bucketului. */
export function pickEncoding<T extends { size: number }>(attempts: readonly T[]): T | null {
  const ok = attempts.find((a) => a.size > 0 && a.size <= PHOTO_TARGET_BYTES);
  if (ok) return ok;
  const smallest = [...attempts].filter((a) => a.size > 0).sort((a, b) => a.size - b.size)[0];
  return smallest && smallest.size <= RECIPE_PHOTO_MAX_BYTES ? smallest : null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** null dacă poza nu se poate citi sau nu încape în limită. */
export async function resizePhoto(file: Blob, recipeId: string): Promise<NewRecipePhoto | null> {
  let bitmap: ImageBitmap;
  try {
    // Orientarea din EXIF se aplică (pozele făcute în picioare rămân în picioare).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) {
    bitmap.close();
    return null;
  }
  g.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Safari mai vechi întoarce PNG când nu știe WebP: atunci trecem pe JPEG.
  const probe = await toBlob(canvas, "image/webp", PHOTO_QUALITIES[0]);
  const type = probe?.type === "image/webp" ? "image/webp" : "image/jpeg";
  const attempts: Blob[] = [];
  for (const q of PHOTO_QUALITIES) {
    const blob = q === PHOTO_QUALITIES[0] && type === "image/webp" ? probe : await toBlob(canvas, type, q);
    if (!blob || blob.type !== type) continue;
    attempts.push(blob);
    if (blob.size <= PHOTO_TARGET_BYTES) break;
  }
  const best = pickEncoding(attempts);
  if (!best) return null;
  return { recipeId, data: await best.arrayBuffer(), contentType: type, width, height };
}
