import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { addItem, createList, finalizeShopping, setActualPrice, updateItem } from "./shopping";
import { createProduct, createVariant, deleteVariant, updateVariant } from "./catalog";
import { recordPrice } from "./money";
import { exportHouseholdData, importHouseholdData } from "./backup";
import { listItems, owned, priceIndex } from "./queries";
import { lineEstimate } from "@/lib/domain/shopping";
import { compareVariants } from "@/lib/domain/variants";

// Variantele comerciale în baza locală (.tasks/007, etapa 3).

let ctx: AppCtx;

async function newCtx(householdId: string): Promise<AppCtx> {
  const db = new CamaraDB(`variants-${Math.random()}`);
  await seedCatalog(db);
  return { db, householdId, userId: "u1", sync: true };
}

beforeEach(async () => {
  setClock("2026-10-18T09:00:00.000Z");
  ctx = await newCtx("h1");
});
afterEach(() => setClock(null));

const sissi = { product_id: "piept-pui", brand: "Sissi", name: "Piept de pui feliat", net_quantity: 300, net_unit: "g" as const };

describe("variantele", () => {
  it("se adaugă cu marca (o singură dată, fără diacritice sau majuscule) și ajung la trimis", async () => {
    const a = await createVariant(ctx, sissi);
    const b = await createVariant(ctx, { ...sissi, brand: "SISSI", name: "Altă denumire" });
    const [va, vb] = await Promise.all([ctx.db.product_variants.get(a), ctx.db.product_variants.get(b)]);
    expect(va).toMatchObject({ household_id: "h1", product_id: "piept-pui", net_quantity: 300, net_unit: "g", ean: null });
    expect(va!.brand_id).toBe(vb!.brand_id);
    expect((await owned(ctx.db, "brands", "h1")).map((x) => x.name)).toEqual(["Sissi"]);
    const outbox = await ctx.db.outbox.toArray();
    expect(outbox.filter((e) => e.table === "product_variants")).toHaveLength(2);
  });

  it("refuză gramajul pe jumătate, codul de bare dublat și produsul inexistent", async () => {
    await expect(createVariant(ctx, { ...sissi, net_unit: null })).rejects.toThrow(/cantitatea, și unitatea/);
    await createVariant(ctx, { ...sissi, ean: "5940000000017" });
    await expect(createVariant(ctx, { ...sissi, ean: "5940000000017" })).rejects.toThrow(/Codul de bare/);
    await expect(createVariant(ctx, { ...sissi, ean: "123" })).rejects.toThrow(/8, 12, 13 sau 14 cifre/);
    await expect(createVariant(ctx, { ...sissi, product_id: "nu-exista" })).rejects.toThrow(/nu există/);
  });

  it("varianta globală doar la un produs global", async () => {
    const own = await createProduct(ctx, { name: "Zacusca bunicii", category_id: "conserve", default_unit: "borcan" });
    await expect(createVariant(ctx, { ...sissi, product_id: own }, { global: true })).rejects.toThrow(/catalogul comun/);
    const id = await createVariant(ctx, sissi, { global: true });
    expect((await ctx.db.product_variants.get(id))?.household_id).toBeNull();
  });

  it("se modifică și se șterge logic", async () => {
    const id = await createVariant(ctx, sissi);
    await updateVariant(ctx, id, { net_quantity: 250, brand: null });
    expect(await ctx.db.product_variants.get(id)).toMatchObject({ net_quantity: 250, brand_id: null });
    await expect(updateVariant(ctx, id, { net_unit: null })).rejects.toThrow(/cantitatea, și unitatea/);
    await deleteVariant(ctx, id);
    expect((await ctx.db.product_variants.get(id))?.deleted_at).not.toBeNull();
  });
});

describe("varianta pe listă, la cumpărare și la preț", () => {
  it("Cum verific: Sissi 300 g la 21 lei → 70 lei/kg, iar data viitoare linia e estimată la 21 lei", async () => {
    const v = await createVariant(ctx, sissi);
    const listId = await createList(ctx, { name: "Săptămâna", is_recurring: true });
    const item = await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: v });
    await setActualPrice(ctx, item, 21);
    await finalizeShopping(ctx, listId, { addToPantry: false });

    const [tx] = await owned(ctx.db, "shopping_transaction_items", "h1");
    expect(tx.variant_id).toBe(v);
    const [price] = await owned(ctx.db, "product_prices", "h1");
    expect(price).toMatchObject({ variant_id: v, amount: 21, quantity: 1, unit: "pachet" });

    const idx = await priceIndex(ctx.db, "h1");
    const row = compareVariants(idx, "piept-pui").find((r) => r.variant_id === v);
    expect(row?.per).toBeCloseTo(70);
    const [again] = await listItems(ctx.db, listId);
    expect(lineEstimate(again, idx)).toMatchObject({ amount: 21, kind: "calculat" });
  });

  it("fără variantă, rândurile nu au deloc câmpul (merg și pe un server fără migrație)", async () => {
    const listId = await createList(ctx, { name: "Săptămâna" });
    const item = await addItem(ctx, listId, { product_id: "piept-pui", quantity: 500, unit: "g" });
    await setActualPrice(ctx, item, 15);
    await finalizeShopping(ctx, listId, { addToPantry: false });
    await recordPrice(ctx, { product_id: "piept-pui", amount: 30, quantity: 1, unit: "kg", source: "supermarket", observed_on: "2026-10-18" });
    await updateItem(ctx, item, { variant_id: null, note: "fără marcă" });
    for (const e of await ctx.db.outbox.toArray()) expect(e.payload).not.toHaveProperty("variant_id");
  });

  it("varianta altui produs nu se poate pune; la schimbarea produsului varianta se scoate", async () => {
    const v = await createVariant(ctx, sissi);
    const listId = await createList(ctx, { name: "Săptămâna" });
    await expect(addItem(ctx, listId, { product_id: "ceapa-galbena", variant_id: v })).rejects.toThrow(/Varianta aleasă/);
    await expect(recordPrice(ctx, { product_id: "ceapa-galbena", amount: 3, quantity: 1, unit: "kg", source: "piata", observed_on: "2026-10-18", variant_id: v })).rejects.toThrow(/Varianta aleasă/);
    const item = await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: v });
    await updateItem(ctx, item, { product_id: "ceapa-galbena" });
    expect((await ctx.db.shopping_list_items.get(item))?.variant_id).toBeNull();
  });

  it("aceeași variantă se adună pe linie; altă variantă face linie nouă", async () => {
    const v = await createVariant(ctx, sissi);
    const listId = await createList(ctx, { name: "Săptămâna" });
    const a = await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: v });
    const b = await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: v });
    expect(b).toBe(a);
    expect((await ctx.db.shopping_list_items.get(a))?.quantity).toBe(2);
    const w = await createVariant(ctx, { ...sissi, brand: "Agricola", name: "Piept de pui" });
    expect(await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: w })).not.toBe(a);
  });
});

describe("copia de siguranță", () => {
  it("variantele trec în altă gospodărie, cu legăturile păstrate", async () => {
    const v = await createVariant(ctx, sissi);
    const listId = await createList(ctx, { name: "Săptămâna" });
    await addItem(ctx, listId, { product_id: "piept-pui", quantity: 1, unit: "pachet", variant_id: v });
    const other = await newCtx("h2");
    await importHouseholdData(other, await exportHouseholdData(ctx));
    const [variant] = await owned(other.db, "product_variants", "h2");
    const [brand] = await owned(other.db, "brands", "h2");
    const [item] = await owned(other.db, "shopping_list_items", "h2");
    expect(variant).toMatchObject({ name: "Piept de pui feliat", brand_id: brand.id });
    expect(variant.id).not.toBe(v);
    expect(item.variant_id).toBe(variant.id);
  });
});
