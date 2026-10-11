import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { exportHouseholdData, importHouseholdData } from "./backup";
import { addItem, createList, finalizeShopping, setActualPrice, setChecked, updateList } from "./shopping";
import { setPantryOnPurchase, toggleFavorite } from "./kitchen";
import { stableId } from "@/lib/db/ids";
import { SYNCED_TABLES } from "@/lib/db/database";
import { listItems, owned } from "./queries";

async function newCtx(householdId: string): Promise<AppCtx> {
  const db = new CamaraDB(`backup-${Math.random()}`);
  await seedCatalog(db);
  return { db, householdId, userId: "u1", sync: true };
}

let ctx: AppCtx;

beforeEach(async () => {
  setClock("2026-03-08T09:00:00.000Z");
  ctx = await newCtx("h1");
});
afterEach(() => setClock(null));

async function listWithItem(c: AppCtx) {
  const listId = await createList(c, { name: "Săptămâna 10" });
  await addItem(c, listId, { product_id: "piept-pui", quantity: 500, unit: "g" });
  return listId;
}

describe("importul copiei de siguranță", () => {
  it("readuce datele pe un dispozitiv gol, în aceeași gospodărie, și le pune la trimis", async () => {
    const listId = await listWithItem(ctx);
    const json = await exportHouseholdData(ctx);

    const fresh = await newCtx("h1");
    const r = await importHouseholdData(fresh, json);

    expect(r.added).toBeGreaterThanOrEqual(2);
    expect(await fresh.db.shopping_lists.get(listId)).toMatchObject({ name: "Săptămâna 10", household_id: "h1" });
    expect(await listItems(fresh.db, listId)).toHaveLength(1);
    expect(await fresh.db.outbox.where("[table+row_id]").equals(["shopping_lists", listId]).count()).toBe(1);
  });

  it("nu face dubluri și nu suprascrie modificările mai noi de pe dispozitiv", async () => {
    const listId = await listWithItem(ctx);
    const json = await exportHouseholdData(ctx);

    setClock("2026-03-09T09:00:00.000Z");
    await updateList(ctx, listId, { name: "Redenumită după copie" });

    const r = await importHouseholdData(ctx, json);
    expect(r).toMatchObject({ added: 0, updated: 0 });
    expect((await ctx.db.shopping_lists.get(listId))?.name).toBe("Redenumită după copie");
  });

  it("actualizează un rând când versiunea din copie e mai nouă", async () => {
    const listId = await listWithItem(ctx);
    const fresh = await newCtx("h1");
    await importHouseholdData(fresh, await exportHouseholdData(ctx));

    setClock("2026-03-09T09:00:00.000Z");
    await updateList(ctx, listId, { name: "Nume nou" });
    const r = await importHouseholdData(fresh, await exportHouseholdData(ctx));

    expect(r.updated).toBe(1);
    expect((await fresh.db.shopping_lists.get(listId))?.name).toBe("Nume nou");
  });

  it("o copie din altă gospodărie primește id-uri noi, cu legăturile păstrate, și nu se dublează la al doilea import", async () => {
    const listId = await listWithItem(ctx);
    const json = await exportHouseholdData(ctx);

    const other = await newCtx("h2");
    await importHouseholdData(other, json);
    const again = await importHouseholdData(other, json);
    expect(again.added).toBe(0);

    const lists = await owned(other.db, "shopping_lists", "h2");
    expect(lists).toHaveLength(1);
    expect(lists[0].id).not.toBe(listId);
    const items = await listItems(other.db, lists[0].id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ household_id: "h2", product_id: "piept-pui" }); // produsul din catalogul comun rămâne același
  });

  it("o copie din altă gospodărie cu setări, favorite și cumpărături finalizate respectă regulile de id și unicitatea", async () => {
    await setPantryOnPurchase(ctx, "mereu");
    const recipeId = (await ctx.db.recipes.toCollection().first())!.id;
    await toggleFavorite(ctx, recipeId);
    const listId = await listWithItem(ctx);
    const [item] = await listItems(ctx.db, listId);
    await setChecked(ctx, item.id, true);
    await setActualPrice(ctx, item.id, 25);
    await finalizeShopping(ctx, listId, { addToPantry: false });
    const json = await exportHouseholdData(ctx);

    const other = await newCtx("h2");
    await toggleFavorite(other, recipeId); // h2 are deja rețeta la favorite
    await importHouseholdData(other, json);

    // Toate rândurile importate sunt ale gospodăriei active.
    for (const t of SYNCED_TABLES) {
      for (const r of await other.db.table(t).toArray()) expect(r.household_id === null || r.household_id === "h2").toBe(true);
    }
    expect(await other.db.household_settings.get("h2")).toMatchObject({ household_id: "h2" });
    expect(await owned(other.db, "favorite_recipes", "h2")).toHaveLength(1);

    const [tx] = await owned(other.db, "shopping_transactions", "h2");
    const [txItem] = await owned(other.db, "shopping_transaction_items", "h2");
    const [newList] = await owned(other.db, "shopping_lists", "h2");
    expect(tx.id).toBe(await stableId("tura", newList.id, String(tx.list_cycle)));
    expect(txItem.transaction_id).toBe(tx.id);
    const prices = await owned(other.db, "product_prices", "h2");
    expect(prices.map((p) => p.id)).toContain(await stableId("pret", txItem.id));
  });

  it("refuză un fișier care nu e o copie Cămara", async () => {
    await expect(importHouseholdData(ctx, "nu e json")).rejects.toThrow("nu este o copie Cămara");
    await expect(importHouseholdData(ctx, JSON.stringify({ format: "altceva" }))).rejects.toThrow("nu este o copie Cămara");
    await expect(importHouseholdData(ctx, JSON.stringify({ format: "camara-export", version: 2, household_id: "h1", tables: {} }))).rejects.toThrow("versiune mai nouă");
  });
});
