import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { addMember, asUser, closeDb, createHousehold, createUser, type TestUser } from "./helpers";

// Potrivirile învățate de pe bonuri (.tasks/005, etapa 3).

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
});

afterAll(closeDb);

async function learn(user: TestUser, household: string, text: string, product = "lapte-integral", retailer: string | null = "lidl") {
  const id = randomUUID();
  await asUser(user, (q) => q("insert into receipt_aliases (id, household_id, retailer_id, receipt_text, product_id) values ($1, $2, $3, $4, $5)", [id, household, retailer, text, product]));
  return id;
}

describe("receipt_aliases", () => {
  it("un membru învață o potrivire; colegii o văd, alte gospodării nu", async () => {
    const id = await learn(ana, hA, "lapte zuzu 1 5 1l");
    const forBogdan = await asUser(bogdan, async (q) => (await q("select product_id from receipt_aliases where id = $1", [id])).rows);
    expect(forBogdan).toEqual([{ product_id: "lapte-integral" }]);
    const forCarmen = await asUser(carmen, async (q) => (await q("select id from receipt_aliases where household_id = $1", [hA])).rows);
    expect(forCarmen).toEqual([]);
    const upd = await asUser(carmen, (q) => q("update receipt_aliases set product_id = 'rosii' where id = $1", [id]));
    expect(upd.rowCount).toBe(0);
    await expect(learn(carmen, hA, "altceva")).rejects.toThrow(/row-level security/);
  });

  it("un singur produs pe text și magazin; alt magazin sau altă gospodărie pot avea altul", async () => {
    await learn(ana, hA, "paine alba", "paine-alba", "kaufland");
    await expect(learn(bogdan, hA, "paine alba", "paine-alba", "kaufland")).rejects.toThrow(/duplicate key/);
    await learn(bogdan, hA, "paine alba", "paine-alba", null);
    await learn(carmen, hB, "paine alba", "paine-alba", "kaufland");
  });

  it("textul e normalizat, produsul și magazinul din aceeași gospodărie sau globale", async () => {
    await expect(learn(ana, hA, "LAPTE ZUZU")).rejects.toThrow(/check constraint/);
    await expect(learn(ana, hA, "")).rejects.toThrow(/check constraint/);
    await asUser(carmen, (q) => q("insert into products (id, household_id, name, category_id, default_unit) values ('zacusca-carmen', $1, 'Zacusca Carmen', 'diverse', 'borcan')", [hB]));
    await expect(learn(ana, hA, "zacusca", "zacusca-carmen")).rejects.toThrow(/altă gospodărie/);
  });

  it("nu se șterge, nu se mută", async () => {
    const id = await learn(ana, hA, "rosii cherry", "rosii");
    await expect(asUser(ana, (q) => q("delete from receipt_aliases where id = $1", [id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(ana, (q) => q("update receipt_aliases set household_id = $1 where id = $2", [hB, id]))).rejects.toThrow();
  });
});
