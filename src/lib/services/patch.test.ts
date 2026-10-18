import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { addItem, createList, updateItem, updateList } from "./shopping";
import { addPantryItem, updatePantryItem } from "./kitchen";
import { createBudget, updateBudget } from "./money";
import { createCategory, createProduct, createRetailer, updateCategory, updateProduct, updateRetailer } from "./catalog";

// Modificările parțiale schimbă doar câmpurile trimise. Cu zod 4,
// `.partial()` aplica valorile implicite și reseta restul câmpurilor.

let ctx: AppCtx;

beforeEach(async () => {
  setClock("2026-10-18T09:00:00.000Z");
  const db = new CamaraDB(`patch-${Math.random()}`);
  await seedCatalog(db);
  ctx = { db, householdId: "h1", userId: "u1", sync: true };
});
afterEach(() => setClock(null));

describe("modificările parțiale păstrează restul câmpurilor", () => {
  it("linia din listă își păstrează produsul când îi schimbi cantitatea", async () => {
    const list = await createList(ctx, { name: "Săptămâna" });
    const id = await addItem(ctx, list, { product_id: "rosii", quantity: 1, unit: "kg" });
    await updateItem(ctx, id, { quantity: 2 });
    expect(await ctx.db.shopping_list_items.get(id)).toMatchObject({ product_id: "rosii", quantity: 2, unit: "kg" });
    // Ce trimiți explicit se schimbă, inclusiv golirea.
    await updateItem(ctx, id, { quantity: null });
    expect(await ctx.db.shopping_list_items.get(id)).toMatchObject({ product_id: "rosii", quantity: null, unit: null });
  });

  it("lista redenumită rămâne recurentă și cu magazinul ei", async () => {
    const retailer = await createRetailer(ctx, { name: "Piața Obor", kind: "piata" });
    const list = await createList(ctx, { name: "Săptămâna", is_recurring: true, default_retailer_id: retailer });
    await updateList(ctx, list, { name: "Săptămâna asta" });
    expect(await ctx.db.shopping_lists.get(list)).toMatchObject({ name: "Săptămâna asta", is_recurring: true, default_retailer_id: retailer });
  });

  it("produsul își păstrează sinonimele, codul și sezonul", async () => {
    const id = await createProduct(ctx, { name: "Zacusca bunicii", category_id: "conserve", default_unit: "borcan", ean: "5940000000017", season_months: [9, 10], aliases: ["zacusca"] });
    await updateProduct(ctx, id, { name: "Zacusca de vinete" });
    expect(await ctx.db.products.get(id)).toMatchObject({ name: "Zacusca de vinete", ean: "5940000000017", season_months: [9, 10] });
    const aliases = (await ctx.db.product_aliases.where("product_id").equals(id).toArray()).filter((a) => !a.deleted_at);
    expect(aliases.map((a) => a.alias)).toEqual(["zacusca"]);
  });

  it("magazinul și categoria își păstrează restul câmpurilor", async () => {
    const r = await createRetailer(ctx, { name: "Ion", kind: "producator", details: "ouă de țară, Bran" });
    await updateRetailer(ctx, r, { name: "Ion din Bran" });
    expect(await ctx.db.retailers.get(r)).toMatchObject({ details: "ouă de țară, Bran", kind: "producator" });
    const c = await createCategory(ctx, { name: "Animale", icon: "dog", is_food: false, sort_order: 10 });
    await updateCategory(ctx, c, { name: "Animale de companie" });
    expect(await ctx.db.product_categories.get(c)).toMatchObject({ icon: "dog", is_food: false, sort_order: 10 });
  });

  it("produsul din cămară își păstrează expirarea când îi schimbi cantitatea", async () => {
    const id = await addPantryItem(ctx, { product_id: "lapte", name: "Lapte", quantity: 2, unit: "l", location_id: "frigider", purchased_on: "2026-10-15", expires_on: "2026-10-22", note: "de la țară" });
    await updatePantryItem(ctx, id, { quantity: 1 });
    expect(await ctx.db.pantry_items.get(id)).toMatchObject({ product_id: "lapte", quantity: 1, purchased_on: "2026-10-15", expires_on: "2026-10-22", note: "de la țară" });
  });

  it("bugetul oprit rămâne oprit când îi schimbi suma", async () => {
    const id = await createBudget(ctx, { name: "Mâncare", period: "lunar", scope: { kind: "alimente" }, amount: 1500, active: false });
    await updateBudget(ctx, id, { amount: 1800 });
    expect(await ctx.db.budgets.get(id)).toMatchObject({ amount: 1800, active: false });
  });
});
