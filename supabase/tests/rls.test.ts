import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { addMember, asUser, closeDb, createHousehold, createUser, db, type TestUser } from "./helpers";

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

async function newList(user: TestUser, household: string, name = "Cumpărături săptămânale") {
  const id = randomUUID();
  await asUser(user, (q) => q("insert into shopping_lists (id, household_id, name) values ($1, $2, $3)", [id, household, name]));
  return id;
}

describe("gospodării și membri", () => {
  it("crearea gospodăriei îl face pe utilizator proprietar și creează setările", async () => {
    const rows = await asUser(ana, async (q) => (await q("select role from household_members where household_id = $1 and user_id = $2", [hA, ana.id])).rows);
    expect(rows).toEqual([{ role: "owner" }]);
    const settings = await asUser(ana, async (q) => (await q("select pantry_on_purchase from household_settings where household_id = $1", [hA])).rows);
    expect(settings).toEqual([{ pantry_on_purchase: "intreaba" }]);
  });

  it("un vizitator neautentificat nu poate crea gospodării și nu vede nimic", async () => {
    await expect(asUser(null, (q) => q("select public.create_household('X')"))).rejects.toThrow();
    await expect(asUser(null, (q) => q("select * from households"))).rejects.toThrow(/permission denied/);
  });

  it("profilul se creează la înregistrare cu numele dat", async () => {
    const r = await db().query("select display_name from profiles where id = $1", [ana.id]);
    expect(r.rows[0].display_name).toBe("Ana");
  });

  it("membrii își văd colegii, străinii nu", async () => {
    const forBogdan = await asUser(bogdan, async (q) => (await q("select display_name, role from household_member_list($1)", [hA])).rows);
    expect(forBogdan).toEqual([
      { display_name: "Ana", role: "owner" },
      { display_name: "Bogdan", role: "member" },
    ]);
    const forCarmen = await asUser(carmen, async (q) => (await q("select * from household_member_list($1)", [hA])).rows);
    expect(forCarmen).toEqual([]);
  });
});

describe("izolarea datelor între gospodării", () => {
  it("membrii aceleiași gospodării văd aceleași liste", async () => {
    const listId = await newList(ana, hA);
    const seen = await asUser(bogdan, async (q) => (await q("select id from shopping_lists where id = $1", [listId])).rows);
    expect(seen).toHaveLength(1);
  });

  it("o altă gospodărie nu vede, nu modifică și nu adaugă în datele tale", async () => {
    const listId = await newList(ana, hA, "Lista Anei");
    const seen = await asUser(carmen, async (q) => (await q("select id from shopping_lists where household_id = $1", [hA])).rows);
    expect(seen).toEqual([]);
    const upd = await asUser(carmen, (q) => q("update shopping_lists set name = 'furat' where id = $1", [listId]));
    expect(upd.rowCount).toBe(0);
    await expect(newList(carmen, hA)).rejects.toThrow(/row-level security/);
  });

  it("un rând nu poate fi mutat în altă gospodărie", async () => {
    const listId = await newList(carmen, hB);
    await expect(asUser(carmen, (q) => q("update shopping_lists set household_id = $1 where id = $2", [hA, listId]))).rejects.toThrow();
  });

  it("nu poți adăuga un produs într-o listă a altei gospodării, nici prin id-ul listei", async () => {
    const listA = await newList(ana, hA);
    await expect(
      asUser(carmen, (q) =>
        q("insert into shopping_list_items (id, household_id, list_id, name, category_id) values ($1, $2, $3, 'Lapte', 'lactate')", [randomUUID(), hB, listA]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("produsele proprii ale unei gospodării nu pot fi folosite de alta", async () => {
    await asUser(ana, (q) =>
      q("insert into products (id, household_id, name, category_id, default_unit) values ('zacusca-bunicii', $1, 'Zacusca bunicii', 'conserve', 'borcan')", [hA]),
    );
    const visible = await asUser(carmen, async (q) => (await q("select id from products where id = 'zacusca-bunicii'")).rows);
    expect(visible).toEqual([]);
    const listB = await newList(carmen, hB);
    await expect(
      asUser(carmen, (q) =>
        q("insert into shopping_list_items (id, household_id, list_id, product_id, name, category_id) values ($1, $2, $3, 'zacusca-bunicii', 'Zacuscă', 'conserve')", [
          randomUUID(),
          hB,
          listB,
        ]),
      ),
    ).rejects.toThrow(/altă gospodărie/);
  });

  it("ștergerea fizică nu e permisă clientului (se folosește deleted_at)", async () => {
    const listId = await newList(ana, hA);
    const del = await asUser(ana, (q) => q("delete from shopping_lists where id = $1", [listId]));
    expect(del.rowCount).toBe(0);
    const soft = await asUser(ana, (q) => q("update shopping_lists set deleted_at = now() where id = $1", [listId]));
    expect(soft.rowCount).toBe(1);
  });
});

describe("catalogul global", () => {
  it("toți utilizatorii autentificați citesc catalogul", async () => {
    const r = await asUser(carmen, async (q) => (await q("select count(*)::int as n from products where household_id is null")).rows[0].n);
    expect(r).toBeGreaterThanOrEqual(300);
  });

  it("doar administratorii aplicației modifică produsele globale", async () => {
    await expect(
      asUser(ana, (q) => q("insert into products (id, name, category_id, default_unit) values ('produs-global-nou', 'Nou', 'diverse', 'buc')")),
    ).rejects.toThrow(/row-level security/);
    const upd = await asUser(ana, (q) => q("update products set name = 'Altceva' where id = 'rosii'"));
    expect(upd.rowCount).toBe(0);

    await db().query("insert into app_admins (user_id) values ($1) on conflict do nothing", [carmen.id]);
    await asUser(carmen, (q) => q("insert into products (id, name, category_id, default_unit) values ('produs-global-nou', 'Nou', 'diverse', 'buc')"));
    await db().query("delete from app_admins where user_id = $1", [carmen.id]);
  });
});

describe("invitații și roluri", () => {
  it("o invitație folosită, revocată sau expirată nu mai funcționează", async () => {
    const dana = await createUser("Dana");
    const token = await asUser(ana, async (q) => (await q("insert into household_invitations (household_id) values ($1) returning token", [hA])).rows[0].token);
    await asUser(dana, (q) => q("select accept_invitation($1)", [token]));
    const eve = await createUser("Eva");
    await expect(asUser(eve, (q) => q("select accept_invitation($1)", [token]))).rejects.toThrow(/nu mai este valabilă/);

    const revoked = await asUser(ana, async (q) => (await q("insert into household_invitations (household_id) values ($1) returning id, token", [hA])).rows[0]);
    await asUser(ana, (q) => q("update household_invitations set revoked_at = now() where id = $1", [revoked.id]));
    await expect(asUser(eve, (q) => q("select accept_invitation($1)", [revoked.token]))).rejects.toThrow(/nu mai este valabilă/);

    const expired = await asUser(ana, async (q) =>
      (await q("insert into household_invitations (household_id, expires_at) values ($1, now() - interval '1 minute') returning token", [hA])).rows[0].token,
    );
    await expect(asUser(eve, (q) => q("select accept_invitation($1)", [expired]))).rejects.toThrow(/nu mai este valabilă/);
  });

  it("o invitație pe email poate fi acceptată doar de acel email", async () => {
    const fane = await createUser("Fane");
    const gina = await createUser("Gina");
    const token = await asUser(ana, async (q) =>
      (await q("insert into household_invitations (household_id, email) values ($1, $2) returning token", [hA, fane.email])).rows[0].token,
    );
    await expect(asUser(gina, (q) => q("select accept_invitation($1)", [token]))).rejects.toThrow(/altă adresă/);
    await asUser(fane, (q) => q("select accept_invitation($1)", [token]));
  });

  it("previzualizarea arată gospodăria doar pentru un token valabil", async () => {
    const token = await asUser(ana, async (q) => (await q("insert into household_invitations (household_id) values ($1) returning token", [hA])).rows[0].token);
    const stranger = await createUser("Ion");
    const r = await asUser(stranger, async (q) => (await q("select household_name, invited_by, role from invitation_preview($1)", [token])).rows);
    expect(r).toEqual([{ household_name: "Familia Popescu", invited_by: "Ana", role: "member" }]);
    expect(await asUser(stranger, async (q) => (await q("select * from invitation_preview('inexistent')")).rows)).toEqual([]);
  });

  it("un membru simplu nu poate invita și nu vede invitațiile", async () => {
    await expect(asUser(bogdan, (q) => q("insert into household_invitations (household_id) values ($1)", [hA]))).rejects.toThrow(/row-level security/);
    const r = await asUser(bogdan, async (q) => (await q("select * from household_invitations where household_id = $1", [hA])).rows);
    expect(r).toEqual([]);
  });

  it("un administrator invită membri, dar nu administratori", async () => {
    const h = await createHousehold(ana, "Casa de vacanță");
    const admin = await createUser("Admin");
    await addMember(ana, h, admin, "admin");
    await asUser(admin, (q) => q("insert into household_invitations (household_id, role) values ($1, 'member')", [h]));
    await expect(asUser(admin, (q) => q("insert into household_invitations (household_id, role) values ($1, 'admin')", [h]))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("doar proprietarul schimbă rolurile și nu poate exista un al doilea proprietar", async () => {
    const h = await createHousehold(ana, "Roluri");
    const m = await createUser("Mihai");
    await addMember(ana, h, m);
    const byMember = await asUser(m, (q) => q("update household_members set role = 'admin' where household_id = $1 and user_id = $2", [h, m.id]));
    expect(byMember.rowCount).toBe(0);
    await asUser(ana, (q) => q("update household_members set role = 'admin' where household_id = $1 and user_id = $2", [h, m.id]));
    await expect(asUser(ana, (q) => q("update household_members set role = 'owner' where household_id = $1 and user_id = $2", [h, m.id]))).rejects.toThrow();
    await asUser(ana, (q) => q("select transfer_ownership($1, $2)", [h, m.id]));
    const roles = await asUser(m, async (q) => (await q("select display_name, role from household_member_list($1)", [h])).rows);
    expect(roles).toEqual([
      { display_name: "Mihai", role: "owner" },
      { display_name: "Ana", role: "admin" },
    ]);
  });

  it("un membru poate pleca, proprietarul nu; doar proprietarul șterge gospodăria", async () => {
    const h = await createHousehold(ana, "Temporară");
    const m = await createUser("Nicu");
    await addMember(ana, h, m);
    expect((await asUser(ana, (q) => q("delete from household_members where household_id = $1 and user_id = $2", [h, ana.id]))).rowCount).toBe(0);
    expect((await asUser(m, (q) => q("delete from households where id = $1", [h]))).rowCount).toBe(0);
    expect((await asUser(m, (q) => q("delete from household_members where household_id = $1 and user_id = $2", [h, m.id]))).rowCount).toBe(1);
    const listId = await newList(ana, h);
    expect((await asUser(ana, (q) => q("delete from households where id = $1", [h]))).rowCount).toBe(1);
    const left = await db().query("select count(*)::int as n from shopping_lists where id = $1", [listId]);
    expect(left.rows[0].n).toBe(0);
  });
});

describe("integritatea datelor", () => {
  it("serverul stabilește updated_at, nu clientul", async () => {
    const listId = randomUUID();
    const r = await asUser(ana, async (q) =>
      (await q("insert into shopping_lists (id, household_id, name, updated_at) values ($1, $2, 'X', '2000-01-01') returning updated_at", [listId, hA])).rows[0],
    );
    expect(new Date(r.updated_at).getFullYear()).toBeGreaterThan(2020);
  });

  it("respinge sume negative, unități necunoscute și bugete invalide", async () => {
    const listId = await newList(ana, hA);
    const insertItem = (extra: string, values: unknown[]) =>
      asUser(ana, (q) =>
        q(`insert into shopping_list_items (id, household_id, list_id, name, category_id${extra}) values ($1, $2, $3, 'X', 'diverse'${values.map((_, i) => `, $${i + 4}`).join("")})`, [
          randomUUID(),
          hA,
          listId,
          ...values,
        ]),
      );
    await expect(insertItem(", actual_price", [-5])).rejects.toThrow(/check/);
    await expect(insertItem(", unit", ["galon"])).rejects.toThrow(/foreign key/);
    await expect(insertItem(", quantity", [0])).rejects.toThrow(/check/);
    await expect(
      asUser(ana, (q) => q(`insert into budgets (id, household_id, name, period, scope, amount) values ($1, $2, 'B', 'lunar', '{"kind":"orice"}', 100)`, [randomUUID(), hA])),
    ).rejects.toThrow(/check/);
    await asUser(ana, (q) =>
      q(`insert into budgets (id, household_id, name, period, scope, amount) values ($1, $2, 'Piață', 'lunar', '{"kind":"sursa","source":"piata"}', 800)`, [randomUUID(), hA]),
    );
  });

  it("o tură de cumpărături și un produs într-o tură se înregistrează o singură dată", async () => {
    const listId = await newList(ana, hA);
    const itemId = randomUUID();
    await asUser(ana, (q) => q("insert into shopping_list_items (id, household_id, list_id, name, category_id) values ($1, $2, $3, 'Lapte', 'lactate')", [itemId, hA, listId]));
    const txId = randomUUID();
    await asUser(ana, (q) => q("insert into shopping_transactions (id, household_id, list_id, list_cycle, started_at) values ($1, $2, $3, 1, now())", [txId, hA, listId]));
    await expect(
      asUser(bogdan, (q) => q("insert into shopping_transactions (id, household_id, list_id, list_cycle, started_at) values ($1, $2, $3, 1, now())", [randomUUID(), hA, listId])),
    ).rejects.toThrow(/duplicate key/);
    const addTxItem = () =>
      asUser(ana, (q) =>
        q("insert into shopping_transaction_items (id, household_id, transaction_id, list_item_id, name, category_id, amount, purchased_at) values ($1, $2, $3, $4, 'Lapte', 'lactate', 8.5, now())", [
          randomUUID(),
          hA,
          txId,
          itemId,
        ]),
      );
    await addTxItem();
    await expect(addTxItem()).rejects.toThrow(/duplicate key/);
  });

  it("ingredientele unei rețete proprii stau în aceeași gospodărie cu rețeta", async () => {
    await asUser(ana, (q) => q("insert into recipes (id, household_id, name, servings) values ('reteta-ana', $1, 'Rețeta Anei', 2)", [hA]));
    await expect(
      asUser(carmen, (q) =>
        q("insert into recipe_ingredients (id, household_id, recipe_id, product_id, quantity, unit) values ('ing-x', $1, 'reteta-ana', 'rosii', 1, 'kg')", [hB]),
      ),
    ).rejects.toThrow(/altă gospodărie/);
    await asUser(ana, (q) =>
      q("insert into recipe_ingredients (id, household_id, recipe_id, product_id, quantity, unit) values ('ing-ana', $1, 'reteta-ana', 'rosii', 1, 'kg')", [hA]),
    );
  });

  it("preferințele pot indica doar o gospodărie din care faci parte", async () => {
    await expect(asUser(carmen, (q) => q("update user_preferences set active_household_id = $1", [hA]))).rejects.toThrow(/row-level security/);
  });
});

describe("funcțiile din baza de date", () => {
  // Doar funcțiile noastre, nu și cele ale extensiilor (pgcrypto).
  const OURS = "p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')";
  const RPC = ["accept_invitation", "create_household", "household_member_list", "invitation_preview", "transfer_ownership"];

  async function callable(role: string) {
    const r = await db().query(
      `select p.proname, p.prorettype = 'trigger'::regtype as is_trigger
       from pg_proc p where ${OURS} and has_function_privilege($1, p.oid, 'execute')
       order by 1`,
      [role],
    );
    return r.rows as { proname: string; is_trigger: boolean }[];
  }

  it("un vizitator neautentificat nu poate chema nicio funcție", async () => {
    expect(await callable("anon")).toEqual([]);
  });

  it("utilizatorul autentificat cheamă funcțiile aplicației, dar nu și pe cele de trigger", async () => {
    const fns = await callable("authenticated");
    expect(fns.filter((f) => f.is_trigger)).toEqual([]);
    expect(fns.map((f) => f.proname)).toEqual(expect.arrayContaining(RPC));
  });

  it("toate funcțiile au search_path fix", async () => {
    const r = await db().query(
      `select p.proname from pg_proc p where ${OURS}
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(r.rows).toEqual([]);
  });
});
