import { afterEach, beforeEach, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { addPantryItem } from "./kitchen";
import { createList } from "./shopping";
import { finishPantryToList } from "./pantry-exceptions";
import { listItems } from "./queries";
let ctx: AppCtx;
beforeEach(async () => { const db = new CamaraDB(`exception-${Math.random()}`); await seedCatalog(db); ctx = { db, householdId: "h1", userId: "u1", sync: true }; });
afterEach(async () => { await ctx.db.delete(); });
it("zeros stock and adds one unknown-quantity shopping line, including repeated taps", async () => {
  const id = await addPantryItem(ctx, { product_id: "sare", name: "Sare", quantity: 2, unit: "buc", location_id: "camara" });
  const list = await finishPantryToList(ctx, id);
  await finishPantryToList(ctx, id, list);
  expect((await ctx.db.pantry_items.get(id))?.quantity).toBe(0);
  expect(await listItems(ctx.db, list)).toMatchObject([{ product_id: "sare", quantity: null, unit: null }]);
});
it("rolls back stock and outbox when shopping insertion fails", async () => {
  const id = await addPantryItem(ctx, { product_id: "missing-product", name: "Sare", quantity: 2, unit: "buc", location_id: "camara" });
  const list = await createList(ctx, { name: "Lista" });
  const before = await ctx.db.outbox.count();
  await expect(finishPantryToList(ctx, id, list)).rejects.toThrow("Produsul nu există");
  expect((await ctx.db.pantry_items.get(id))?.quantity).toBe(2);
  expect(await ctx.db.outbox.count()).toBe(before);
  expect(await listItems(ctx.db, list)).toHaveLength(0);
});
it("rejects a pantry item or target list from another household without changing stock", async () => {
  const id = await addPantryItem(ctx, { name: "Mere", quantity: 2, unit: "buc", location_id: "camara" });
  const other = { ...ctx, householdId: "h2" };
  await expect(finishPantryToList(other, id)).rejects.toThrow();
  const list = await createList(other, { name: "Altă casă" });
  await expect(finishPantryToList(ctx, id, list)).rejects.toThrow();
  expect((await ctx.db.pantry_items.get(id))?.quantity).toBe(2);
});
