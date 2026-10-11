import { inject } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";

export interface TestUser {
  id: string;
  email: string;
}

let pool: pg.Pool | null = null;

export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: inject("dbUrl"), max: 4 });
  return pool;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

/** Creează un utilizator în auth.users (ca la înregistrarea în Supabase). */
export async function createUser(name: string): Promise<TestUser> {
  const id = randomUUID();
  const email = `${name.toLowerCase()}-${id.slice(0, 6)}@exemplu.ro`;
  await db().query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, { display_name: name }]);
  return { id, email };
}

/**
 * Rulează `fn` ca utilizatorul dat, cu rolul `authenticated` și RLS activ,
 * exact ca o cerere PostgREST din aplicație. Tranzacția se anulează la final.
 */
export async function asUser<T>(user: TestUser | null, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${user ? "authenticated" : "anon"}`);
    if (user) {
      await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [
        user.id,
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
    }
    const result = await fn((sql, params) => client.query(sql, params as unknown[]));
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function createHousehold(owner: TestUser, name = "Acasă"): Promise<string> {
  return asUser(owner, async (q) => (await q("select public.create_household($1) as id", [name])).rows[0].id);
}

export async function addMember(owner: TestUser, householdId: string, member: TestUser, role: "member" | "admin" = "member") {
  const token = await asUser(owner, async (q) => (await q("insert into household_invitations (household_id, role) values ($1, $2) returning token", [householdId, role])).rows[0].token);
  await asUser(member, (q) => q("select public.accept_invitation($1)", [token]));
}
