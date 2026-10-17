import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, closeDb, createHousehold, createUser, db, type TestUser } from "./helpers";

// Importul rețetelor (.tasks/009, etapa 2): sursa rețetei și limita de
// cereri pentru funcția Edge import-recipe.

let ana: TestUser;
let bogdan: TestUser;
let hA: string;

beforeAll(async () => {
  ana = await createUser("Ana");
  bogdan = await createUser("Bogdan");
  hA = await createHousehold(ana, "Familia Popescu");
});

afterAll(closeDb);

describe("recipes.source_url", () => {
  it("rețeta importată păstrează pagina de pe site", async () => {
    await asUser(ana, (q) =>
      q("insert into recipes (id, household_id, name, servings, source_url) values ('importata', $1, 'Importată', 4, 'https://www.exemplu.ro/reteta')", [hA]),
    );
    const { rows } = await asUser(ana, (q) => q("select source_url from recipes where id = 'importata'"));
    expect(rows[0].source_url).toBe("https://www.exemplu.ro/reteta");
  });

  it("refuză adresele care nu sunt https sau sunt prea lungi", async () => {
    for (const url of ["http://www.exemplu.ro/reteta", "javascript:alert(1)", "https://exemplu.ro/" + "a".repeat(500)]) {
      await expect(asUser(ana, (q) => q("insert into recipes (id, household_id, name, servings, source_url) values ('rea', $1, 'Rea', 2, $2)", [hA, url]))).rejects.toThrow(/source_url/);
    }
  });
});

describe("take_recipe_import_quota", () => {
  const take = (u: TestUser | null) => asUser(u, async (q) => (await q("select public.take_recipe_import_quota() as ok")).rows[0].ok as boolean);

  it("dă voie la 20 de cereri pe oră, apoi refuză; ceilalți nu sunt afectați", async () => {
    for (let i = 0; i < 20; i++) expect(await take(ana)).toBe(true);
    expect(await take(ana)).toBe(false);
    expect(await take(bogdan)).toBe(true);
  });

  it("cererile mai vechi de o oră nu se mai numără, iar cele de peste o zi se șterg", async () => {
    await db().query("update recipe_import_requests set created_at = now() - interval '2 days' where user_id = $1", [ana.id]);
    expect(await take(ana)).toBe(true);
    const { rows } = await db().query("select count(*)::int as n from recipe_import_requests where user_id = $1", [ana.id]);
    expect(rows[0].n).toBe(1);
  });

  it("anonimii nu o pot chema, iar tabelul nu se citește prin API", async () => {
    await expect(take(null)).rejects.toThrow(/permission denied/);
    await expect(asUser(ana, (q) => q("select * from recipe_import_requests"))).rejects.toThrow(/permission denied/);
    await expect(asUser(ana, (q) => q("insert into recipe_import_requests (user_id) values ($1)", [ana.id]))).rejects.toThrow(/permission denied/);
  });
});

describe("take_recipe_translate_quota (.tasks/012)", () => {
  const take = (u: TestUser | null, fn: string) => asUser(u, async (q) => (await q(`select public.${fn}() as ok`)).rows[0].ok as boolean);

  it("are limita ei: traducerile nu consumă din importuri și invers", async () => {
    await db().query("delete from recipe_import_requests where user_id = $1", [bogdan.id]);
    for (let i = 0; i < 20; i++) expect(await take(bogdan, "take_recipe_translate_quota")).toBe(true);
    expect(await take(bogdan, "take_recipe_translate_quota")).toBe(false);
    expect(await take(bogdan, "take_recipe_import_quota")).toBe(true);
    const { rows } = await db().query("select kind, count(*)::int as n from recipe_import_requests where user_id = $1 group by kind order by kind", [bogdan.id]);
    expect(rows).toEqual([{ kind: "import", n: 1 }, { kind: "translate", n: 20 }]);
  });

  it("cererile vechi se șterg doar din felul lor", async () => {
    await db().query("update recipe_import_requests set created_at = now() - interval '2 days' where user_id = $1", [bogdan.id]);
    expect(await take(bogdan, "take_recipe_translate_quota")).toBe(true);
    const { rows } = await db().query("select kind, count(*)::int as n from recipe_import_requests where user_id = $1 group by kind order by kind", [bogdan.id]);
    expect(rows).toEqual([{ kind: "import", n: 1 }, { kind: "translate", n: 1 }]);
  });

  it("anonimii nu o pot chema, iar limita comună nu se cheamă direct", async () => {
    await expect(take(null, "take_recipe_translate_quota")).rejects.toThrow(/permission denied/);
    await expect(asUser(ana, (q) => q("select public.take_recipe_request_quota('translate')"))).rejects.toThrow(/permission denied/);
  });
});
