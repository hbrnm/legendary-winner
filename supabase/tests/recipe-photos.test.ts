import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { addMember, asUser, closeDb, createHousehold, createUser, db, type TestUser } from "./helpers";

// Fotografiile gospodăriei la rețete (.tasks/008, etapa 3): rândurile din
// recipe_photos și fișierele din bucketul privat recipe-photos.

let ana: TestUser; // proprietara gospodăriei A
let bogdan: TestUser; // membru în A
let carmen: TestUser; // proprietara gospodăriei B, străină de A
let hA: string;
let hB: string;

beforeAll(async () => {
  ana = await createUser("Ana");
  bogdan = await createUser("Bogdan");
  carmen = await createUser("Carmen");
  hA = await createHousehold(ana, "Familia Popescu");
  hB = await createHousehold(carmen, "Familia Ionescu");
  await addMember(ana, hA, bogdan);
  await asUser(ana, (q) => q("insert into recipes (id, household_id, name, servings) values ('ciorba-anei', $1, 'Ciorba Anei', 4)", [hA]));
});

afterAll(closeDb);

async function addPhoto(user: TestUser, household: string, recipeId: string, path?: string) {
  const id = randomUUID();
  await asUser(user, (q) =>
    q("insert into recipe_photos (id, household_id, recipe_id, storage_path, width, height) values ($1, $2, $3, $4, 1280, 960)", [
      id,
      household,
      recipeId,
      path ?? `${household}/${recipeId}/${id}.webp`,
    ]),
  );
  return id;
}

async function softDelete(user: TestUser, id: string) {
  await asUser(user, (q) => q("update recipe_photos set deleted_at = now() where id = $1", [id]));
}

describe("rândurile recipe_photos", () => {
  it("un membru pune o fotografie la o rețetă din catalog; colegii o văd, alte gospodării nu", async () => {
    const id = await addPhoto(ana, hA, "sarmale");
    const forBogdan = await asUser(bogdan, async (q) => (await q("select created_by from recipe_photos where id = $1", [id])).rows);
    expect(forBogdan).toEqual([{ created_by: ana.id }]);
    const forCarmen = await asUser(carmen, async (q) => (await q("select id from recipe_photos where household_id = $1", [hA])).rows);
    expect(forCarmen).toEqual([]);
    const upd = await asUser(carmen, (q) => q("update recipe_photos set deleted_at = now() where id = $1", [id]));
    expect(upd.rowCount).toBe(0);
    await softDelete(ana, id);
  });

  it("nu poți adăuga fotografii în gospodăria altcuiva", async () => {
    await expect(addPhoto(carmen, hA, "sarmale")).rejects.toThrow(/row-level security/);
  });

  it("nu poți pune o fotografie la rețeta proprie a altei gospodării", async () => {
    await expect(addPhoto(carmen, hB, "ciorba-anei")).rejects.toThrow(/altă gospodărie/);
  });

  it("calea fișierului trebuie să fie a rândului (gospodăria, rețeta și id-ul lui)", async () => {
    await expect(addPhoto(ana, hA, "ciorba-anei", `${hB}/ciorba-anei/${randomUUID()}.webp`)).rejects.toThrow(/check constraint/);
    await expect(addPhoto(ana, hA, "ciorba-anei", `${hA}/ciorba-anei/alt-id.webp`)).rejects.toThrow(/check constraint/);
    await expect(addPhoto(ana, hA, "ciorba-anei", `${hA}/sarmale/x.png`)).rejects.toThrow(/check constraint/);
  });

  it("dimensiunile sunt între 1 și 1280 px", async () => {
    const id = randomUUID();
    await expect(
      asUser(ana, (q) =>
        q("insert into recipe_photos (id, household_id, recipe_id, storage_path, width, height) values ($1, $2, 'ciorba-anei', $3, 2000, 900)", [
          id,
          hA,
          `${hA}/ciorba-anei/${id}.jpg`,
        ]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("o singură fotografie activă pe rețetă; după ștergerea logică se poate pune alta", async () => {
    const first = await addPhoto(ana, hA, "ciorba-anei");
    await expect(addPhoto(bogdan, hA, "ciorba-anei")).rejects.toThrow(/duplicate key/);
    // Altă gospodărie își pune fotografia ei la aceeași rețetă din catalog.
    await addPhoto(carmen, hB, "sarmale");
    await softDelete(bogdan, first);
    await addPhoto(bogdan, hA, "ciorba-anei");
  });

  it("ștergerea fizică nu e permisă, iar rândul nu se mută în altă gospodărie", async () => {
    const id = await addPhoto(carmen, hB, "ciorba-de-legume");
    await expect(asUser(carmen, (q) => q("delete from recipe_photos where id = $1", [id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(carmen, (q) => q("update recipe_photos set household_id = $1 where id = $2", [hA, id]))).rejects.toThrow();
  });
});

describe("fișierele din bucketul recipe-photos", () => {
  async function upload(user: TestUser | null, name: string, bucket = "recipe-photos") {
    await asUser(user, (q) => q("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]));
  }
  const names = async (user: TestUser, prefix: string) =>
    asUser(user, async (q) => (await q("select name from storage.objects where name like $1 || '%'", [prefix])).rows.map((r) => r.name));

  it("bucketul e privat, cu limită de mărime și doar WebP sau JPEG", async () => {
    const r = await db().query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recipe-photos'");
    expect(r.rows).toEqual([{ public: false, file_size_limit: "1048576", allowed_mime_types: ["image/webp", "image/jpeg"] }]);
  });

  it("membrii încarcă, văd și șterg fișierele gospodăriei; o altă gospodărie nu", async () => {
    const name = `${hA}/sarmale/${randomUUID()}.webp`;
    await upload(ana, name);
    expect(await names(bogdan, name)).toEqual([name]);
    expect(await names(carmen, hA)).toEqual([]);
    const stolen = await asUser(carmen, (q) => q("delete from storage.objects where name = $1", [name]));
    expect(stolen.rowCount).toBe(0);
    const renamed = await asUser(carmen, (q) => q("update storage.objects set name = $1 where name = $2", [`${hB}/sarmale/x.webp`, name]));
    expect(renamed.rowCount).toBe(0);
    const del = await asUser(bogdan, (q) => q("delete from storage.objects where name = $1", [name]));
    expect(del.rowCount).toBe(1);
  });

  it("nu poți încărca în dosarul altei gospodării și nici muta un fișier acolo", async () => {
    await expect(upload(carmen, `${hA}/sarmale/${randomUUID()}.webp`)).rejects.toThrow(/row-level security/);
    const name = `${hB}/sarmale/${randomUUID()}.webp`;
    await upload(carmen, name);
    await expect(asUser(carmen, (q) => q("update storage.objects set name = $1 where name = $2", [`${hA}/sarmale/x.webp`, name]))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("căile fără gospodărie, alte bucketuri și vizitatorii neautentificați sunt refuzați", async () => {
    await db().query("insert into storage.buckets (id, name) values ('altceva', 'altceva') on conflict do nothing");
    await expect(upload(ana, `sarmale/${randomUUID()}.webp`)).rejects.toThrow(/row-level security/);
    await expect(upload(ana, `${hA}/sarmale/${randomUUID()}.webp`, "altceva")).rejects.toThrow(/row-level security/);
    await expect(upload(null, `${hA}/sarmale/${randomUUID()}.webp`)).rejects.toThrow(/row-level security/);
    await expect(asUser(null, (q) => q("select * from recipe_photos"))).rejects.toThrow(/permission denied/);
  });
});
