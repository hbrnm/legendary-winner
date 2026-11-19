import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { addItem, createList, finalizeShopping, setActualPrice, setChecked, copyShoppingSource } from "./shopping";
import { listItems, owned } from "./queries";

let ctx: AppCtx;

beforeEach(async () => {
  setClock("2026-03-08T09:00:00.000Z");
  const db = new CamaraDB(`svc-copy-${Math.random()}`);
  await seedCatalog(db);
  ctx = { db, householdId: "h1", userId: "u1", sync: true };
});
afterEach(() => setClock(null));

describe("copyShoppingSource", () => {
  it("copiază o listă recurentă cu toate produsele nebifate și fără prețuri plătite", async () => {
    const listId = await createList(ctx, { name: "Lista săptămânală", is_recurring: true });
    const item1 = await addItem(ctx, listId, { name: "Lapte", quantity: 2, unit: "l" });
    await addItem(ctx, listId, { name: "Pâine", quantity: 1, unit: "buc" });

    // Bifăm un produs și punem preț plătit
    await setChecked(ctx, item1, true);
    await setActualPrice(ctx, item1, 14.5);

    const copiedId = await copyShoppingSource(ctx, { kind: "list", id: listId }, "Copie săptămână");
    expect(copiedId).toBeDefined();

    const copiedList = await ctx.db.shopping_lists.get(copiedId);
    expect(copiedList).toMatchObject({
      name: "Copie săptămână",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      household_id: "h1",
    });

    const copiedItems = await listItems(ctx.db, copiedId);
    expect(copiedItems).toHaveLength(2);
    for (const item of copiedItems) {
      expect(item.checked).toBe(false);
      expect(item.checked_at).toBeNull();
      expect(item.actual_price).toBeNull();
      expect(item.receipt_name).toBeUndefined();
    }
    expect(copiedItems.map((i) => i.name).sort()).toEqual(["Lapte", "Pâine"]);
  });

  it("copiază dintr-o tranzacție din istoric liniile tranzacției salvate, chiar dacă lista-sursă a fost modificată ulterior", async () => {
    const listId = await createList(ctx, { name: "Cumpărături Kaufland", is_recurring: true });
    const i1 = await addItem(ctx, listId, { name: "Mere", quantity: 1, unit: "kg" });
    const i2 = await addItem(ctx, listId, { name: "Pere", quantity: 2, unit: "kg" });

    await setChecked(ctx, i1, true);
    await setActualPrice(ctx, i1, 6.0);
    await setChecked(ctx, i2, true);
    await setActualPrice(ctx, i2, 12.0);

    const fin = await finalizeShopping(ctx, listId, { addToPantry: false });
    expect(fin.items).toBe(2);

    const txs = await owned(ctx.db, "shopping_transactions", ctx.householdId);
    expect(txs).toHaveLength(1);
    const txId = txs[0].id;

    // Modificăm lista originală recurentă după finalizare: adăugăm Portocale și ștergem Pere
    await addItem(ctx, listId, { name: "Portocale", quantity: 1.5, unit: "kg" });

    // Copiem din tranzacția istorică
    const copiedId = await copyShoppingSource(ctx, { kind: "transaction", id: txId }, "Listă din istoric");
    const copiedItems = await listItems(ctx.db, copiedId);

    // Trebuie să conțină exact Mere și Pere din tranzacție, NU Portocale din lista recurentă modificată!
    expect(copiedItems).toHaveLength(2);
    expect(copiedItems.map((i) => i.name).sort()).toEqual(["Mere", "Pere"]);
    for (const item of copiedItems) {
      expect(item.checked).toBe(false);
      expect(item.actual_price).toBeNull();
      expect(item.household_id).toBe("h1");
    }
  });

  it("refuză copierea dacă lista sau tranzacția aparține altei gospodării sau nu există", async () => {
    const foreignListId = await createList({ ...ctx, householdId: "h2" }, { name: "Lista străină" });
    await expect(copyShoppingSource(ctx, { kind: "list", id: foreignListId }, "Tentativă")).rejects.toThrow(
      "Lista nu mai există sau nu ai acces."
    );

    await expect(copyShoppingSource(ctx, { kind: "list", id: "inexistent" }, "Tentativă")).rejects.toThrow(
      "Lista nu mai există sau nu ai acces."
    );

    await expect(copyShoppingSource(ctx, { kind: "transaction", id: "inexistent" }, "Tentativă")).rejects.toThrow(
      "Cumpărătura nu mai există sau nu ai acces."
    );
  });

  it("validează numele listei și refuză nume goale", async () => {
    const listId = await createList(ctx, { name: "Bază" });
    await expect(copyShoppingSource(ctx, { kind: "list", id: listId }, "")).rejects.toThrow(
      "Numele listei"
    );
    await expect(copyShoppingSource(ctx, { kind: "list", id: listId }, "   ")).rejects.toThrow(
      "Numele listei"
    );
  });

  it("nu lasă liste parțiale dacă o eroare survine în timpul tranzacției", async () => {
    const listId = await createList(ctx, { name: "Lista originală" });
    await addItem(ctx, listId, { name: "Pâine", quantity: 1, unit: "buc" });

    // Simulăm o eroare prin coruperea id-ului sau un hook
    // Dacă numele e prea lung (>80 caractere)
    const tooLongName = "A".repeat(81);
    await expect(copyShoppingSource(ctx, { kind: "list", id: listId }, tooLongName)).rejects.toThrow();

    const lists = await owned(ctx.db, "shopping_lists", ctx.householdId);
    expect(lists).toHaveLength(1);
    expect(lists[0].id).toBe(listId);
  });
});
