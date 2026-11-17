import { afterEach, beforeEach, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import type { AppCtx } from "./context";
import { seedCatalog } from "./bootstrap";
import { addPantryItem, cookRecipe, saveRecipe } from "./kitchen";
let ctx: AppCtx;
let id: string;
beforeEach(async () => {
  const db = new CamaraDB(`cooking-${Math.random()}`);
  await seedCatalog(db);
  ctx = { db, householdId: "h1", userId: "u1", sync: true };
  id = await saveRecipe(ctx, { name: "Pui cu ceapă", categories: ["cina"], servings: 4, prep_minutes: 10, cook_minutes: 20, difficulty: "usor", ingredients: [{ product_id: "piept-pui", quantity: 500, unit: "g" }, { product_id: "ceapa-galbena", quantity: 1, unit: "buc" }], steps: ["Gătește."] });
});
afterEach(async () => { await ctx.db.delete(); });
it("rolls back all ingredient quantities and outbox entries if the second stock write fails", async () => {
  const a = await addPantryItem(ctx, { product_id: "piept-pui", name: "Pui", quantity: 1, unit: "kg", location_id: "frigider" });
  const b = await addPantryItem(ctx, { product_id: "ceapa-galbena", name: "Ceapă", quantity: 5, unit: "buc", location_id: "camara" });
  await ctx.db.outbox.clear();
  let writes = 0;
  const hook = () => { if (++writes === 2) throw new Error("stock write failed"); };
  ctx.db.pantry_items.hook("updating", hook);
  try {
    await expect(cookRecipe(ctx, id, 4)).rejects.toThrow("stock write failed");
    expect((await ctx.db.pantry_items.get(a))?.quantity).toBe(1);
    expect((await ctx.db.pantry_items.get(b))?.quantity).toBe(5);
    expect(await ctx.db.outbox.count()).toBe(0);
  } finally { ctx.db.pantry_items.hook("updating").unsubscribe(hook); }
});
it("rejects invalid servings and a different household's recipe", async () => {
  await expect(cookRecipe(ctx, id, 0)).rejects.toThrow();
  await expect(cookRecipe(ctx, id, NaN)).rejects.toThrow();
  await expect(cookRecipe({ ...ctx, householdId: "h2" }, id, 4)).rejects.toThrow();
});
