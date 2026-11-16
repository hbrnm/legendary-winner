import { afterEach, describe, expect, it } from "vitest";
import { CamaraDB, setMeta } from "@/lib/db/database";
import { insertRow } from "@/lib/db/write";
import { setClock } from "@/lib/clock";
import { createExpense, deleteExpense, updateExpense } from "@/lib/services/expenses";
import { householdSpendRecords } from "@/lib/services/queries";
import { FakeRemote } from "./fake-remote";
import { SyncEngine } from "./engine";
import { budget } from "@/test/factories";

const opened: CamaraDB[] = [];
const db = () => { const value = new CamaraDB(`family-sync-${Math.random()}`); opened.push(value); return value; };
afterEach(async () => { await Promise.all(opened.splice(0).map((d) => d.delete())); setClock(null); });

describe("sincronizarea plăților manuale", () => {
  it("păstrează rândurile/scopurile noi în coadă fără a bloca datele vechi până la migrare", async () => {
    const local = db(), remote = new FakeRemote();
    remote.missingTables.add("manual_expenses");
    const fields = { id: "expense1", household_id: "h1", description: "Școală", amount: 800, category_id: "educatie" as const, spent_on: "2026-03-05" };
    await insertRow(local, "manual_expenses", fields, { outbox: true });
    const { created_at: _c, updated_at: _u, ...newBudget } = budget({ id: "family", household_id: "h1", scope: { kind: "familie" } });
    void _c; void _u;
    await insertRow(local, "budgets", newBudget, { outbox: true });
    await insertRow(local, "budgets", { ...newBudget, id: "old", scope: { kind: "total" } }, { outbox: true });
    const engine = new SyncEngine(local, remote);
    await engine.syncNow();
    expect(await local.manual_expenses.get("expense1")).toMatchObject({ amount: 800 });
    expect(await local.outbox.count()).toBe(2);
    expect(await local.sync_errors.count()).toBe(0);
    expect(remote.tables.get("budgets")?.has("old")).toBe(true);
    remote.missingTables.delete("manual_expenses");
    await engine.syncNow(); // confirmă tabela prin pull
    await engine.syncNow(); // trimite bugetul după confirmare
    expect(await local.outbox.count()).toBe(0);
    expect(remote.tables.get("manual_expenses")?.get("expense1")).toMatchObject({ amount: 800 });
    expect(remote.tables.get("budgets")?.get("family")?.scope).toEqual({ kind: "familie" });
  });

  it("un alt dispozitiv primește adăugarea, modificarea și ștergerea", async () => {
    setClock("2026-03-08T09:00:00Z");
    const first = db(), second = db(), remote = new FakeRemote();
    const ctx = { db: first, householdId: "h1", userId: "u1", sync: true };
    await setMeta(first, "server_missing:manual_expenses", false);
    const a = new SyncEngine(first, remote), b = new SyncEngine(second, remote);
    const id = await createExpense(ctx, { description: "Autobuz", amount: 50, category_id: "transport", spent_on: "2026-03-08" });
    await a.syncNow(); await b.syncNow();
    expect(await second.manual_expenses.get(id)).toMatchObject({ amount: 50 });
    await updateExpense(ctx, id, { amount: 60 });
    await a.syncNow(); await b.syncNow();
    expect(await second.manual_expenses.get(id)).toMatchObject({ amount: 60 });
    await deleteExpense(ctx, id);
    await a.syncNow(); await b.syncNow();
    expect(await householdSpendRecords(second, "h1")).toEqual([]);
  });
});
