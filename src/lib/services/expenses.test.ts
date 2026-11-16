import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { budget } from "@/test/factories";
import { CamaraDB, setMeta } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { createExpense, deleteExpense, updateExpense } from "./expenses";
import { createBudget, updateBudget } from "./money";
import { exportHouseholdData, importHouseholdData } from "./backup";
import { householdSpendRecords } from "./queries";
import { seedCatalog } from "./bootstrap";
import { addItem, createList, finalizeShopping, setActualPrice, setChecked } from "./shopping";
import type { AppCtx } from "./context";

let ctx: AppCtx;
const input = { description: "After-school", amount: 800, category_id: "educatie" as const, spent_on: "2026-03-05" };
beforeEach(async () => {
  setClock("2026-03-08T09:00:00Z");
  ctx = { db: new CamaraDB(`expenses-${Math.random()}`), householdId: "h1", userId: "u1", sync: true };
  await seedCatalog(ctx.db);
  await setMeta(ctx.db, "server_missing:manual_expenses", false);
});
afterEach(async () => { await ctx.db.delete(); setClock(null); });

describe("plăți manuale", () => {
  it("actualizează o bază v4 fără să piardă bugetele existente", async () => {
    const name = `expenses-upgrade-${Math.random()}`;
    const stores = Object.fromEntries(ctx.db.tables.filter((t) => t.name !== "manual_expenses")
      .map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(",")]));
    const previous = new Dexie(name);
    previous.version(4).stores(stores);
    await previous.table("budgets").put(budget({ id: "legacy", household_id: "h1", amount: 2000 }));
    previous.close();
    const upgraded = new CamaraDB(name);
    try {
      expect(await upgraded.manual_expenses.count()).toBe(0);
      expect(await upgraded.budgets.get("legacy")).toMatchObject({ amount: 2000, scope: { kind: "total" } });
    } finally { await upgraded.delete(); }
  });
  it("salvează offline cu outbox, modifică doar câmpul trimis și șterge logic", async () => {
    const id = await createExpense(ctx, input);
    expect(await ctx.db.manual_expenses.get(id)).toMatchObject({ ...input, household_id: "h1", deleted_at: null });
    expect(await ctx.db.outbox.filter((e) => e.table === "manual_expenses").count()).toBe(1);
    await updateExpense(ctx, id, { amount: 850 });
    expect(await ctx.db.manual_expenses.get(id)).toMatchObject({ description: "After-school", amount: 850, category_id: "educatie" });
    await deleteExpense(ctx, id);
    expect((await ctx.db.manual_expenses.get(id))?.deleted_at).toBeTruthy();
    expect(await householdSpendRecords(ctx.db, "h1")).toEqual([]);
  });

  it.each([
    { amount: 0 }, { amount: -1 }, { amount: NaN }, { amount: 1.234 }, { amount: 10_000_000 },
    { description: "   " }, { description: "a".repeat(121) },
    { category_id: "unknown" }, { spent_on: "2026-02-30" }, { spent_on: "2026-03-09" },
  ])("refuză plata invalidă %j fără scriere", async (patch) => {
    await expect(createExpense(ctx, { ...input, ...patch } as never)).rejects.toThrow();
    expect(await ctx.db.manual_expenses.count()).toBe(0);
  });

  it("nu permite modificarea plății altei gospodării sau redeschiderea unei plăți șterse", async () => {
    const id = await createExpense(ctx, input);
    const other = { ...ctx, householdId: "h2" };
    await expect(updateExpense(other, id, { amount: 1 })).rejects.toThrow();
    await expect(deleteExpense(other, id)).rejects.toThrow();
    expect(await householdSpendRecords(ctx.db, "h2")).toEqual([]);
    await deleteExpense(ctx, id);
    await expect(updateExpense(ctx, id, { amount: 1 })).rejects.toThrow();
  });

  it("include cumpărăturile bifate o singură dată și după finalizare", async () => {
    await createExpense(ctx, input);
    const listId = await createList(ctx, { name: "Listă" });
    const itemId = await addItem(ctx, listId, { product_id: "rosii", quantity: 1, unit: "kg" });
    await setActualPrice(ctx, itemId, 100);
    await setChecked(ctx, itemId, true);
    expect((await householdSpendRecords(ctx.db, "h1")).reduce((n, i) => n + (i.amount ?? 0), 0)).toBe(900);
    await finalizeShopping(ctx, listId, { addToPantry: false });
    expect((await householdSpendRecords(ctx.db, "h1")).reduce((n, i) => n + (i.amount ?? 0), 0)).toBe(900);
    expect(await ctx.db.pantry_items.count()).toBe(0);
  });

  it("creează bugete de familie și categorie și le păstrează într-un backup repetat", async () => {
    await createExpense(ctx, input);
    const b = await createBudget(ctx, { name: "Familie", amount: 3000, period: "lunar", scope: { kind: "familie" } });
    await createBudget(ctx, { name: "Școală", amount: 1000, period: "lunar", scope: { kind: "cheltuiala", category_id: "educatie" } });
    await updateBudget(ctx, b, { amount: 3500 });
    const fresh = new CamaraDB(`expenses-backup-${Math.random()}`);
    try {
      const target = { ...ctx, db: fresh, householdId: "h2", sync: false };
      const backup = await exportHouseholdData(ctx);
      await importHouseholdData(target, backup);
      await importHouseholdData(target, backup);
      expect(await fresh.manual_expenses.count()).toBe(1);
      expect((await fresh.manual_expenses.toArray())[0]).toMatchObject({ household_id: "h2", amount: 800 });
      expect(await fresh.budgets.count()).toBe(2);
    } finally { await fresh.delete(); }
  });

  it("nu activează plăți și scopuri noi pe un server încă nemigrat", async () => {
    await setMeta(ctx.db, "server_missing:manual_expenses", true);
    await expect(createExpense(ctx, input)).rejects.toThrow();
    await expect(createBudget(ctx, { name: "Familie", amount: 3000, period: "lunar", scope: { kind: "familie" } })).rejects.toThrow();
    expect(await ctx.db.outbox.count()).toBe(0);
    const demo = { ...ctx, sync: false };
    await createExpense(demo, input);
    expect(await ctx.db.manual_expenses.count()).toBe(1);
    expect(await ctx.db.outbox.count()).toBe(0);
  });

  it("refuză o copie cu plăți invalide înainte de orice scriere", async () => {
    await createExpense(ctx, input);
    const payload = JSON.parse(await exportHouseholdData(ctx));
    payload.tables.manual_expenses.push({ ...payload.tables.manual_expenses[0], id: "invalid", amount: -10 });
    const fresh = new CamaraDB(`expenses-invalid-backup-${Math.random()}`);
    try {
      await expect(importHouseholdData({ ...ctx, db: fresh, sync: false }, JSON.stringify(payload))).rejects.toThrow();
      expect(await fresh.manual_expenses.count()).toBe(0);
    } finally { await fresh.delete(); }
  });
});
