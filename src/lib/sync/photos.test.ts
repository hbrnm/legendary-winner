import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { CamaraDB, getMeta } from "@/lib/db/database";
import { insertRow } from "@/lib/db/write";
import { setClock } from "@/lib/clock";
import type { Recipe } from "@/lib/domain/types";
import type { AppCtx } from "@/lib/services/context";
import { addRecipePhoto, recipePhotoBlob, removeRecipePhoto } from "@/lib/services/recipe-photos";
import { exportHouseholdData, importHouseholdData } from "@/lib/services/backup";
import { SyncEngine, serverMissingKey } from "./engine";
import { FakeFiles, FakeRemote } from "./fake-remote";
import { MemoryPhotoCache } from "./files";
import { classifyStorage } from "./supabase-remote";
import { RemoteRejected, RemoteUnavailable } from "./remote";

// Fotografiile gospodăriei: coada de încărcare, sincronizarea și cache-ul (.tasks/008, etapa 4).

const H = "h1";
let n = 0;
let remote: FakeRemote;
let files: FakeFiles;

function device(user = "u1", opts: { sync?: boolean } = {}) {
  const db = new CamaraDB(`foto-${++n}-${Math.random()}`);
  const cache = new MemoryPhotoCache();
  const ctx: AppCtx = { db, householdId: H, userId: user, sync: opts.sync ?? true };
  const engine = new SyncEngine(db, remote, { overlapMs: 0, files, cache });
  return { db, ctx, cache, engine };
}

async function addRecipe(db: CamaraDB, id = "sarmale", household: string | null = null) {
  await db.recipes.put({ id, household_id: household, name: "Sarmale", servings: 4, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null } as unknown as Recipe);
}

const bytes = (...b: number[]) => new Uint8Array(b).buffer;
const photo = (data = bytes(1, 2, 3), recipeId = "sarmale") => ({ recipeId, data, contentType: "image/webp" as const, width: 1280, height: 960 });
const serverPhotos = () => [...(remote.tables.get("recipe_photos")?.values() ?? [])];

beforeEach(() => {
  remote = new FakeRemote();
  files = new FakeFiles();
  // Ca indexul unic parțial de pe server: o singură fotografie activă pe gospodărie și rețetă.
  remote.rejectIf = (table, row) =>
    table === "recipe_photos" && !row.deleted_at && serverPhotos().some((p) => p.id !== row.id && p.household_id === row.household_id && p.recipe_id === row.recipe_id && !p.deleted_at)
      ? 'duplicate key value violates unique constraint "recipe_photos_active"'
      : null;
  setClock("2026-10-15T09:00:00.000Z");
});
afterEach(() => setClock(null));

describe("încărcarea fotografiilor", () => {
  it("o poză făcută offline urcă la revenirea internetului, iar alt membru o vede", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    remote.online = false;
    files.online = false;
    const id = await addRecipePhoto(ana.ctx, photo());
    await ana.engine.syncNow();
    expect(ana.engine.getStatus().state).toBe("offline");
    expect(serverPhotos()).toEqual([]);

    remote.online = true;
    files.online = true;
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0 });
    const path = `${H}/sarmale/${id}.webp`;
    expect(serverPhotos()).toMatchObject([{ id, storage_path: path, created_by: "ana" }]);
    expect([...files.files.keys()]).toEqual([path]);
    // Pe telefonul Anei poza trece din coadă în cache.
    expect(await ana.db.photo_uploads.count()).toBe(0);
    expect(ana.cache.files.has(path)).toBe(true);

    const bogdan = device("bogdan");
    await bogdan.engine.syncNow();
    const row = (await bogdan.db.recipe_photos.get(id))!;
    const blob = await recipePhotoBlob(bogdan.ctx, row, { files, cache: bogdan.cache });
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    // Deschisă o dată, se vede și fără internet.
    files.online = false;
    expect(await recipePhotoBlob(bogdan.ctx, row, { files, cache: bogdan.cache })).not.toBeNull();
  });

  it("rândul așteaptă fișierul: dacă Storage nu răspunde, restul datelor se sincronizează", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    files.online = false;
    const id = await addRecipePhoto(ana.ctx, photo());
    await insertRow(ana.db, "shopping_lists", { id: "lista", household_id: H, name: "Săptămâna", is_recurring: false, cycle: 1, archived_at: null, default_retailer_id: null, sort_order: 0 }, { outbox: true });
    await ana.engine.syncNow();
    expect(ana.engine.getStatus().state).toBe("offline");
    expect(remote.tables.get("shopping_lists")?.has("lista")).toBe(true);
    expect(serverPhotos()).toEqual([]);
    expect((await ana.db.photo_uploads.get(id))?.attempts).toBe(1);

    files.online = true;
    await ana.engine.syncNow();
    expect(serverPhotos().map((p) => p.id)).toEqual([id]);
  });

  it("un fișier care dă eroare nu le oprește pe celelalte", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    await addRecipe(ana.db, "mici");
    const stuck = await addRecipePhoto(ana.ctx, photo(bytes(1)));
    const ok = await addRecipePhoto(ana.ctx, photo(bytes(2), "mici"));
    files.failIf = (path) => path.includes(stuck);
    await ana.engine.syncNow();
    expect(ana.engine.getStatus().state).toBe("offline");
    expect(serverPhotos().map((p) => p.id)).toEqual([ok]);
    expect(await ana.db.photo_uploads.get(stuck)).toBeDefined();
  });

  it("o poză refuzată de Storage nu mai pleacă și apare la modificările refuzate", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    files.rejectIf = () => "new row violates row-level security policy";
    const id = await addRecipePhoto(ana.ctx, photo());
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: 1, rejected_photos: 1 });
    expect(serverPhotos()).toEqual([]);
    expect(await ana.db.recipe_photos.get(id)).toBeUndefined();
    expect(await ana.db.photo_uploads.count()).toBe(0);
  });

  it("doi membri pun offline câte o poză la aceeași rețetă: rămâne prima ajunsă, fișierul celeilalte se șterge", async () => {
    const ana = device("ana");
    const bogdan = device("bogdan");
    await addRecipe(ana.db);
    await addRecipe(bogdan.db);
    const first = await addRecipePhoto(ana.ctx, photo(bytes(1)));
    const second = await addRecipePhoto(bogdan.ctx, photo(bytes(2)));
    await ana.engine.syncNow();
    await bogdan.engine.syncNow();
    expect(bogdan.engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: 1 });
    expect(serverPhotos().map((p) => p.id)).toEqual([first]);
    expect([...files.files.keys()]).toEqual([`${H}/sarmale/${first}.webp`]);
    expect(await bogdan.db.recipe_photos.get(second)).toBeUndefined();
    expect((await bogdan.db.recipe_photos.get(first))?.deleted_at).toBeNull();
    expect(bogdan.cache.files.size).toBe(0);
  });
});

describe("ștergerea și înlocuirea", () => {
  it("după ștergere, fișierul dispare din Storage și din cache-ul ambilor membri", async () => {
    const ana = device("ana");
    const bogdan = device("bogdan");
    await addRecipe(ana.db);
    const id = await addRecipePhoto(ana.ctx, photo());
    await ana.engine.syncNow();
    await bogdan.engine.syncNow();
    const path = `${H}/sarmale/${id}.webp`;
    await recipePhotoBlob(bogdan.ctx, (await bogdan.db.recipe_photos.get(id))!, { files, cache: bogdan.cache });
    expect(bogdan.cache.files.has(path)).toBe(true);

    // Offline, fișierul nu se șterge înaintea rândului.
    remote.online = false;
    await removeRecipePhoto(ana.ctx, id);
    await ana.engine.syncNow();
    expect(files.files.has(path)).toBe(true);
    remote.online = true;
    await ana.engine.syncNow();
    expect(serverPhotos()[0].deleted_at).not.toBeNull();
    expect(files.files.size).toBe(0);
    expect(ana.cache.files.size).toBe(0);
    expect(await ana.db.photo_removals.count()).toBe(0);

    await bogdan.engine.syncNow();
    expect(bogdan.cache.files.size).toBe(0);
  });

  it("dacă serverul refuză ștergerea, fișierul rămâne", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    const id = await addRecipePhoto(ana.ctx, photo());
    await ana.engine.syncNow();
    remote.rejectIf = (table, row) => (table === "recipe_photos" && row.deleted_at ? "new row violates row-level security policy" : null);
    await removeRecipePhoto(ana.ctx, id);
    await ana.engine.syncNow();
    expect(ana.engine.getStatus().rejected).toBe(1);
    expect((await ana.db.recipe_photos.get(id))?.deleted_at).toBeNull();
    expect(files.files.size).toBe(1);
    expect(await ana.db.photo_removals.count()).toBe(0);
  });

  it("o poză ștearsă înainte să urce nu mai urcă deloc", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    files.online = false;
    const id = await addRecipePhoto(ana.ctx, photo());
    await removeRecipePhoto(ana.ctx, id);
    files.online = true;
    await ana.engine.syncNow();
    expect(files.uploads).toBe(0);
    expect(serverPhotos()).toMatchObject([{ id }]);
    expect(serverPhotos()[0].deleted_at).not.toBeNull();
  });

  it("o poză nouă o înlocuiește pe cea veche, iar fișierul vechi se șterge", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    const old = await addRecipePhoto(ana.ctx, photo(bytes(1)));
    await ana.engine.syncNow();
    const next = await addRecipePhoto(ana.ctx, photo(bytes(2)));
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: 0 });
    expect(serverPhotos().filter((p) => !p.deleted_at).map((p) => p.id)).toEqual([next]);
    expect(serverPhotos().find((p) => p.id === old)?.deleted_at).not.toBeNull();
    expect([...files.files.keys()]).toEqual([`${H}/sarmale/${next}.webp`]);
  });

  it("refuză rețeta altei gospodării și poza nemicșorată", async () => {
    const ana = device("ana");
    await addRecipe(ana.db, "a-altora", "h2");
    await expect(addRecipePhoto(ana.ctx, photo(bytes(1), "a-altora"))).rejects.toThrow("Rețeta nu mai există.");
    await addRecipe(ana.db);
    await expect(addRecipePhoto(ana.ctx, { ...photo(), width: 4000 })).rejects.toThrow("Nu am putut folosi această fotografie. Încearcă alta.");
    await expect(addRecipePhoto(ana.ctx, photo(new ArrayBuffer(1024 * 1024 + 1)))).rejects.toThrow("Nu am putut folosi această fotografie. Încearcă alta.");
  });
});

describe("compatibilitatea", () => {
  it("dacă serverul nu are încă tabelul recipe_photos, restul sincronizării merge", async () => {
    remote.missingTables.add("recipe_photos");
    const ana = device("ana");
    await insertRow(ana.db, "shopping_lists", { id: "lista", household_id: H, name: "Săptămâna", is_recurring: false, cycle: 1, archived_at: null, default_retailer_id: null, sort_order: 0 }, { outbox: true });
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ state: "sincronizat", last_error: null });
    expect(remote.tables.get("shopping_lists")?.has("lista")).toBe(true);
    // Ecranele ascund fotografiile până când serverul are tabelul.
    expect(await getMeta(ana.db, serverMissingKey("recipe_photos"))).toBe(true);
    remote.missingTables.clear();
    await ana.engine.syncNow();
    expect(await getMeta(ana.db, serverMissingKey("recipe_photos"))).toBe(false);
  });

  it("o poză pusă cât timp serverul nu are tabelul așteaptă, nu se pierde", async () => {
    remote.missingTables.add("recipe_photos");
    const ana = device("ana");
    await addRecipe(ana.db);
    const id = await addRecipePhoto(ana.ctx, photo());
    await insertRow(ana.db, "shopping_lists", { id: "lista", household_id: H, name: "Săptămâna", is_recurring: false, cycle: 1, archived_at: null, default_retailer_id: null, sort_order: 0 }, { outbox: true });
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ pending: 1, rejected: 0 });
    expect(remote.tables.get("shopping_lists")?.has("lista")).toBe(true);
    expect(await ana.db.recipe_photos.get(id)).toBeDefined();

    remote.missingTables.clear();
    await ana.engine.syncNow();
    expect(ana.engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: 0 });
    expect(serverPhotos().map((p) => p.id)).toEqual([id]);
  });

  it("în modul demonstrativ poza rămâne pe telefon și se vede, fără nimic de trimis", async () => {
    const demo = device("demo", { sync: false });
    await addRecipe(demo.db);
    const id = await addRecipePhoto(demo.ctx, photo());
    expect(await demo.db.outbox.count()).toBe(0);
    const blob = await recipePhotoBlob(demo.ctx, (await demo.db.recipe_photos.get(id))!, { files: null, cache: null });
    expect(blob?.type).toBe("image/webp");
    await removeRecipePhoto(demo.ctx, id);
    expect(await demo.db.photo_uploads.count()).toBe(0);
    expect(await demo.db.photo_removals.count()).toBe(0);
  });

  it("copia de siguranță are rândurile fotografiilor, dar nu le readuce", async () => {
    const ana = device("ana");
    await addRecipe(ana.db);
    const id = await addRecipePhoto(ana.ctx, photo());
    const json = await exportHouseholdData(ana.ctx);
    expect(JSON.parse(json).tables.recipe_photos).toMatchObject([{ id, storage_path: `${H}/sarmale/${id}.webp` }]);
    expect(json).not.toContain("photo_uploads");

    const other = device("carmen");
    await addRecipe(other.db);
    await importHouseholdData({ ...other.ctx, householdId: "h2" }, json);
    expect(await other.db.recipe_photos.count()).toBe(0);
    // Nici în aceeași gospodărie, pe un telefon nou: fișierul poate lipsi din Storage.
    const fresh = device("ana");
    await importHouseholdData(fresh.ctx, json);
    expect(await fresh.db.recipe_photos.count()).toBe(0);
  });

  it("baza locală veche (versiunea 1) primește tabelele noi și își păstrează datele", async () => {
    const name = `veche-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ shopping_lists: "&id, household_id", outbox: "++seq, [table+row_id]", meta: "&key" });
    await v1.table("shopping_lists").put({ id: "lista", household_id: H, name: "Veche" });
    v1.close();
    const db = new CamaraDB(name);
    expect((await db.shopping_lists.get("lista"))?.name).toBe("Veche");
    expect(await db.recipe_photos.count()).toBe(0);
    expect(await db.photo_uploads.count()).toBe(0);
  });

  it("erorile Storage: refuz definitiv doar pentru drepturi, mărime și tip", () => {
    expect(classifyStorage({ message: "new row violates row-level security policy", statusCode: "403" })).toBeInstanceOf(RemoteRejected);
    expect(classifyStorage({ message: "The object exceeded the maximum allowed size", statusCode: "413" })).toBeInstanceOf(RemoteRejected);
    expect(classifyStorage({ message: "mime type image/png is not supported", statusCode: "415" })).toBeInstanceOf(RemoteRejected);
    expect(classifyStorage({ message: "Bucket not found", statusCode: "404" })).toBeInstanceOf(RemoteUnavailable);
    expect(classifyStorage({ message: "jwt expired", statusCode: "400" })).toBeInstanceOf(RemoteUnavailable);
    expect(classifyStorage({ message: "Internal Server Error", status: 500 })).toBeInstanceOf(RemoteUnavailable);
    expect(classifyStorage({ message: "Invalid key", status: 400, statusCode: "InvalidKey" })).toBeInstanceOf(RemoteRejected);
    expect(classifyStorage({ message: '"exp" claim timestamp check failed', statusCode: "403" })).toBeInstanceOf(RemoteUnavailable);
  });
});
