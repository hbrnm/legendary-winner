import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { addMember, asUser, closeDb, createHousehold, createUser, db, type TestUser } from "./helpers";

// Variantele comerciale (.tasks/007, etapa 2): product_variants și
// variant_id pe liniile din listă, cumpărături și prețuri.

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

async function addVariant(user: TestUser, household: string | null, product = "rosii", extra: { net_quantity?: number; net_unit?: string; ean?: string } = {}) {
  const id = randomUUID();
  await asUser(user, (q) =>
    q("insert into product_variants (id, household_id, product_id, name, net_quantity, net_unit, ean) values ($1, $2, $3, 'Cherry', $4, $5, $6)", [
      id,
      household,
      product,
      extra.net_quantity ?? null,
      extra.net_unit ?? null,
      extra.ean ?? null,
    ]),
  );
  return id;
}

async function addPrice(user: TestUser, household: string, variantId: string | null, product = "rosii") {
  await asUser(user, (q) =>
    q(
      "insert into product_prices (id, household_id, product_id, source, amount, quantity, unit, price_type, confidence, observed_on, variant_id) values ($1, $2, $3, 'supermarket', 9.5, 1, 'caserola', 'platit', 'ridicata', '2026-10-18', $4)",
      [randomUUID(), household, product, variantId],
    ),
  );
}

describe("product_variants", () => {
  it("un membru adaugă o variantă; colegii o văd, alte gospodării nu", async () => {
    const id = await addVariant(ana, hA, "rosii", { net_quantity: 250, net_unit: "g" });
    const forBogdan = await asUser(bogdan, async (q) => (await q("select net_quantity, net_unit from product_variants where id = $1", [id])).rows);
    expect(forBogdan).toEqual([{ net_quantity: "250.000", net_unit: "g" }]);
    const forCarmen = await asUser(carmen, async (q) => (await q("select id from product_variants where id = $1", [id])).rows);
    expect(forCarmen).toEqual([]);
    const upd = await asUser(carmen, (q) => q("update product_variants set name = 'furat' where id = $1", [id]));
    expect(upd.rowCount).toBe(0);
    await expect(addVariant(carmen, hA)).rejects.toThrow(/row-level security/);
  });

  it("variantele globale le scriu doar administratorii aplicației, le văd toți", async () => {
    await expect(addVariant(ana, null)).rejects.toThrow(/row-level security/);
    await db().query("insert into app_admins (user_id) values ($1) on conflict do nothing", [carmen.id]);
    const id = await addVariant(carmen, null);
    await db().query("delete from app_admins where user_id = $1", [carmen.id]);
    const forAna = await asUser(ana, async (q) => (await q("select id from product_variants where id = $1", [id])).rows);
    expect(forAna).toHaveLength(1);
    const upd = await asUser(ana, (q) => q("update product_variants set name = 'Altceva' where id = $1", [id]));
    expect(upd.rowCount).toBe(0);
  });

  it("nu se leagă de produsul propriu al altei gospodării; nu se șterge, nu se mută", async () => {
    await asUser(carmen, (q) => q("insert into products (id, household_id, name, category_id, default_unit) values ('dulceata-carmen', $1, 'Dulceața Carmen', 'diverse', 'borcan')", [hB]));
    await expect(addVariant(ana, hA, "dulceata-carmen")).rejects.toThrow(/altă gospodărie/);
    const id = await addVariant(ana, hA);
    await expect(asUser(ana, (q) => q("delete from product_variants where id = $1", [id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(ana, (q) => q("update product_variants set household_id = $1 where id = $2", [hB, id]))).rejects.toThrow();
  });

  it("gramajul: ambele sau niciunul, doar g/kg/ml/l, pozitiv; codul de bare unic pe gospodărie", async () => {
    await expect(addVariant(ana, hA, "rosii", { net_quantity: 300 })).rejects.toThrow(/check constraint/);
    await expect(addVariant(ana, hA, "rosii", { net_quantity: 2, net_unit: "pachet" })).rejects.toThrow(/check constraint/);
    await expect(addVariant(ana, hA, "rosii", { net_quantity: 0, net_unit: "g" })).rejects.toThrow(/check constraint/);
    await addVariant(ana, hA, "rosii", { ean: "5940000000017" });
    await expect(addVariant(bogdan, hA, "rosii", { ean: "5940000000017" })).rejects.toThrow(/duplicate key/);
    await addVariant(carmen, hB, "rosii", { ean: "5940000000017" });
  });
});

describe("variant_id pe prețuri, liste și cumpărături", () => {
  it("prețul se leagă de varianta gospodăriei sau de una globală", async () => {
    const own = await addVariant(ana, hA);
    await addPrice(bogdan, hA, own);
    await addPrice(bogdan, hA, null);
    const r = await asUser(ana, async (q) => (await q("select count(*)::int as n from product_prices where variant_id = $1", [own])).rows[0]);
    expect(r.n).toBe(1);
  });

  it("nu poți folosi varianta altei gospodării", async () => {
    const foreign = await addVariant(carmen, hB);
    await expect(addPrice(ana, hA, foreign)).rejects.toThrow(/altă gospodărie/);
    const list = randomUUID();
    await asUser(ana, (q) => q("insert into shopping_lists (id, household_id, name) values ($1, $2, 'Săptămâna')", [list, hA]));
    await expect(
      asUser(ana, (q) =>
        q("insert into shopping_list_items (id, household_id, list_id, product_id, name, category_id, variant_id) values ($1, $2, $3, 'rosii', 'Roșii', 'legume', $4)", [
          randomUUID(),
          hA,
          list,
          foreign,
        ]),
      ),
    ).rejects.toThrow(/altă gospodărie/);
  });

  it("varianta trebuie să fie a produsului de pe rând", async () => {
    const rosii = await addVariant(ana, hA, "rosii");
    await expect(addPrice(ana, hA, rosii, "ceapa-galbena")).rejects.toThrow(/nu e a acestui produs/);
    const list = randomUUID();
    await asUser(ana, (q) => q("insert into shopping_lists (id, household_id, name) values ($1, $2, 'Săptămâna 2')", [list, hA]));
    const item = randomUUID();
    await asUser(ana, (q) =>
      q("insert into shopping_list_items (id, household_id, list_id, product_id, name, category_id, variant_id) values ($1, $2, $3, 'rosii', 'Roșii', 'legume', $4)", [item, hA, list, rosii]),
    );
    await expect(asUser(ana, (q) => q("update shopping_list_items set product_id = 'ceapa-galbena' where id = $1", [item]))).rejects.toThrow(/nu e a acestui produs/);
    await expect(
      asUser(ana, (q) => q("insert into shopping_list_items (id, household_id, list_id, name, category_id, variant_id) values ($1, $2, $3, 'Ceva', 'legume', $4)", [randomUUID(), hA, list, rosii])),
    ).rejects.toThrow(/nu e a acestui produs/);
  });
});
