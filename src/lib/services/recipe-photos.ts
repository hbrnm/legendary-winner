import type { RecipePhoto } from "@/lib/domain/types";
import { RECIPE_PHOTO_MAX_SIDE, recipePhotoPath } from "@/lib/domain/recipe-photos";
import { insertRow, softDelete } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { nowIso } from "@/lib/clock";
import type { PhotoCache, RemoteFiles } from "@/lib/sync/files";
import { type AppCtx, UserError, w } from "./context";

// Fotografiile gospodăriei la rețete (.tasks/008, etapa 4). Fișierul stă
// întâi în coada locală (photo_uploads); motorul de sincronizare îl urcă în
// Storage și abia apoi trimite rândul. Ecranele vin la etapa 5.

/** Limita bucketului `recipe-photos` (migrația 20261015000001). */
export const RECIPE_PHOTO_MAX_BYTES = 1024 * 1024;

export interface NewRecipePhoto {
  recipeId: string;
  /** Poza deja micșorată pe telefon (fără EXIF). */
  data: ArrayBuffer;
  contentType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
}

const PHOTO_TABLES = (ctx: AppCtx) => [ctx.db.recipe_photos, ctx.db.outbox, ctx.db.photo_uploads, ctx.db.photo_removals];

/** Fotografia activă a gospodăriei la rețetă, dacă există. */
export async function activeRecipePhoto(ctx: AppCtx, recipeId: string): Promise<RecipePhoto | null> {
  const rows = await ctx.db.recipe_photos.where("recipe_id").equals(recipeId).toArray();
  return rows.find((p) => p.household_id === ctx.householdId && !p.deleted_at) ?? null;
}

/** Pune (sau înlocuiește) fotografia gospodăriei la o rețetă. Merge și offline. */
export async function addRecipePhoto(ctx: AppCtx, input: NewRecipePhoto): Promise<string> {
  const recipe = await ctx.db.recipes.get(input.recipeId);
  if (!recipe || recipe.deleted_at || (recipe.household_id !== null && recipe.household_id !== ctx.householdId)) throw new UserError("Rețeta nu mai există.");
  for (const side of [input.width, input.height]) {
    if (!Number.isInteger(side) || side < 1 || side > RECIPE_PHOTO_MAX_SIDE) throw new Error("Fotografia nu e micșorată.");
  }
  if (input.data.byteLength === 0 || input.data.byteLength > RECIPE_PHOTO_MAX_BYTES) throw new Error("Fotografia e prea mare.");

  const id = newId();
  const storage_path = recipePhotoPath(ctx.householdId, input.recipeId, id, input.contentType === "image/webp" ? "webp" : "jpg");
  await ctx.db.transaction("rw", PHOTO_TABLES(ctx), async () => {
    // Cel mult una activă pe rețetă (și pe server, index unic): cea veche se șterge întâi.
    const old = await activeRecipePhoto(ctx, input.recipeId);
    if (old) await dropPhoto(ctx, old);
    await insertRow(ctx.db, "recipe_photos", { id, household_id: ctx.householdId, recipe_id: input.recipeId, storage_path, width: input.width, height: input.height, created_by: ctx.userId }, w(ctx));
    await ctx.db.photo_uploads.put({ photo_id: id, storage_path, content_type: input.contentType, data: input.data, created_at: nowIso(), attempts: 0 });
  });
  return id;
}

/** Șterge fotografia gospodăriei; la rețetă revine fotografia din catalog, dacă are. */
export async function removeRecipePhoto(ctx: AppCtx, photoId: string): Promise<void> {
  await ctx.db.transaction("rw", PHOTO_TABLES(ctx), async () => {
    const photo = await ctx.db.recipe_photos.get(photoId);
    if (!photo || photo.deleted_at || photo.household_id !== ctx.householdId) return;
    await dropPhoto(ctx, photo);
  });
}

async function dropPhoto(ctx: AppCtx, photo: RecipePhoto) {
  await softDelete(ctx.db, "recipe_photos", photo.id, w(ctx));
  // Dacă fișierul n-a urcat încă, nu mai urcă. Altfel se șterge din Storage
  // după ce ștergerea rândului ajunge pe server (și dacă urca chiar acum).
  await ctx.db.photo_uploads.delete(photo.id);
  if (ctx.sync) await ctx.db.photo_removals.put({ storage_path: photo.storage_path, photo_id: photo.id, created_at: nowIso() });
}

/**
 * Fișierul fotografiei, pentru afișare: din coada locală (încă neurcat sau
 * mod demonstrativ), din cache, altfel descărcat (și pus în cache). null
 * dacă nu se poate acum (ex. offline și nedeschis înainte).
 */
export async function recipePhotoBlob(ctx: AppCtx, photo: RecipePhoto, deps: { files: RemoteFiles | null; cache: PhotoCache | null }): Promise<Blob | null> {
  const local = await ctx.db.photo_uploads.get(photo.id);
  if (local) return new Blob([local.data], { type: local.content_type });
  const cached = await deps.cache?.get(photo.storage_path).catch(() => null);
  if (cached) return cached;
  if (!deps.files) return null;
  try {
    const blob = await deps.files.download(photo.storage_path);
    await deps.cache?.put(photo.storage_path, blob).catch(() => {});
    return blob;
  } catch {
    return null;
  }
}
