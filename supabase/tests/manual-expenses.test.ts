import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asUser, closeDb, createHousehold, createUser, db, type TestUser } from "./helpers";

let owner: TestUser, member: TestUser, outsider: TestUser;
let household: string, otherHousehold: string;
beforeAll(async () => {
  owner = await createUser("BugetOwner"); member = await createUser("BugetMember"); outsider = await createUser("BugetOther");
  household = await createHousehold(owner); otherHousehold = await createHousehold(outsider);
  // Fixture de apartenență: testăm RLS pentru cheltuieli, nu fluxul invitațiilor.
  await db().query("insert into household_members(household_id,user_id,role) values($1,$2,'member')", [household, member.id]);
});
afterAll(closeDb);

const add = async (user: TestUser | null, h = household, fields: { amount?: number; category?: string; description?: string; date?: string } = {}) => {
  const id = randomUUID();
  await asUser(user, (q) => q("insert into manual_expenses (id, household_id, description, amount, category_id, spent_on) values ($1,$2,$3,$4,$5,$6)", [id, h, fields.description ?? "Școală", fields.amount ?? 800, fields.category ?? "educatie", fields.date ?? "2026-03-05"]));
  return id;
};

describe("manual_expenses RLS și validare", () => {
  it("membrii pot crea/citi/modifica; alte gospodării și anon nu au acces", async () => {
    const id = await add(member);
    expect((await asUser(owner, (q) => q("select amount from manual_expenses where id=$1", [id]))).rows).toEqual([{ amount: "800.00" }]);
    expect((await asUser(outsider, (q) => q("select id from manual_expenses where id=$1", [id]))).rows).toEqual([]);
    expect((await asUser(outsider, (q) => q("update manual_expenses set amount=1 where id=$1", [id]))).rowCount).toBe(0);
    await expect(add(outsider)).rejects.toThrow(/row-level security/);
    await expect(add(null)).rejects.toThrow(/permission denied/);
    await asUser(owner, (q) => q("update manual_expenses set amount=850 where id=$1", [id]));
    expect((await asUser(member, (q) => q("select amount from manual_expenses where id=$1", [id]))).rows[0].amount).toBe("850.00");
  });

  it("nu permite mutarea gospodăriei sau ștergerea fizică; permite ștergerea logică", async () => {
    const id = await add(owner);
    await expect(asUser(owner, (q) => q("update manual_expenses set household_id=$1 where id=$2", [otherHousehold, id]))).rejects.toThrow();
    await expect(asUser(owner, (q) => q("delete from manual_expenses where id=$1", [id]))).rejects.toThrow(/permission denied/);
    await asUser(member, (q) => q("update manual_expenses set deleted_at=now() where id=$1", [id]));
    expect((await asUser(owner, (q) => q("select deleted_at from manual_expenses where id=$1", [id]))).rows[0].deleted_at).toBeTruthy();
  });

  it("refuză sume/categorii/descrieri/date invalide", async () => {
    for (const fields of [{ amount: 0 }, { amount: -1 }, { category: "unknown" }, { description: "   " }, { description: "x".repeat(121) }, { date: "2026-02-30" }]) {
      await expect(add(owner, household, fields)).rejects.toThrow();
    }
  });

  it("acceptă scopurile noi de buget, dar nu o categorie necunoscută", async () => {
    const insert = (scope: unknown) => asUser(owner, (q) => q("insert into budgets(id,household_id,name,period,scope,amount) values($1,$2,'Familie','lunar',$3,2000)", [randomUUID(), household, scope]));
    await insert({ kind: "familie" });
    await insert({ kind: "cheltuiala", category_id: "educatie" });
    await expect(insert({ kind: "cheltuiala", category_id: "unknown" })).rejects.toThrow(/check constraint/);
    await expect(insert({ kind: "cheltuiala" })).rejects.toThrow(/check constraint/);
    const allowed = (await db().query("select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='manual_expenses'")).rows;
    expect(allowed).toHaveLength(1);
  });
});
