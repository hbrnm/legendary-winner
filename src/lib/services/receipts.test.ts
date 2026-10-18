import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { applyReceipt, learnReceiptAlias, proposeReceiptMatches } from "./receipts";
import { addItem, createList, finalizeShopping, setChecked } from "./shopping";
import { listItems, spendRecords } from "./queries";
import { createProduct, deleteProduct } from "./catalog";
import { exportHouseholdData, importHouseholdData } from "./backup";
import { owned } from "./queries";
import { receiptKey } from "@/lib/domain/receipt-match";

// Potrivirea care învață, cu catalogul real (.tasks/005, etapa 3).

async function newCtx(householdId: string): Promise<AppCtx> {
  const db = new CamaraDB(`bon-${Math.random()}`);
  await seedCatalog(db);
  return { db, householdId, userId: "u1", sync: true };
}

let ctx: AppCtx;
beforeEach(async () => {
  setClock("2026-10-18T09:00:00.000Z");
  ctx = await newCtx("h1");
});
afterEach(() => setClock(null));

describe("potrivirea liniilor de pe bon", () => {
  it("prima dată propune din catalog, chiar cu abrevieri și resturi OCR", async () => {
    const [ceapa, dovleac, nimic] = await proposeReceiptMatches(ctx, ["CEAPA GALBENA KG", "Dovleac Hokkaido", "XQZW 410G"], "kaufland");
    expect(ceapa).toEqual({ product_id: "ceapa-galbena", source: "catalog" });
    expect(dovleac?.source).toBe("catalog");
    expect(nimic).toBeNull();
  });

  it("după confirmare, propune ce a învățat, la același magazin; altă confirmare îl schimbă", async () => {
    await learnReceiptAlias(ctx, { retailer_id: "kaufland", receipt_text: "VDR.LAP.3,5%1L", product_id: "lapte-integral" });
    expect(await proposeReceiptMatches(ctx, ["VDR.LAP.3,5%1L"], "kaufland")).toEqual([{ product_id: "lapte-integral", source: "invatat" }]);
    // La alt magazin, același text învățat tot ajută.
    expect((await proposeReceiptMatches(ctx, ["vdr lap 3 5 1l"], "lidl"))[0]).toEqual({ product_id: "lapte-integral", source: "invatat" });
    await learnReceiptAlias(ctx, { retailer_id: "kaufland", receipt_text: "VDR.LAP.3,5%1L", product_id: "lapte-semidegresat" });
    expect((await proposeReceiptMatches(ctx, ["VDR.LAP.3,5%1L"], "kaufland"))[0]?.product_id).toBe("lapte-semidegresat");
    // Același text, același magazin: un singur rând (id determinist), pus la trimis.
    const rows = await owned(ctx.db, "receipt_aliases", "h1");
    expect(rows).toHaveLength(1);
    expect(rows[0].receipt_text).toBe(receiptKey("VDR.LAP.3,5%1L"));
    expect((await ctx.db.outbox.toArray()).some((e) => e.table === "receipt_aliases")).toBe(true);
  });

  it("nu propune un produs șters; la alt magazin, cea mai recentă confirmare", async () => {
    const own = await createProduct(ctx, { name: "Zacusca bunicii", category_id: "conserve", default_unit: "borcan" });
    await learnReceiptAlias(ctx, { retailer_id: "lidl", receipt_text: "ZACUSCA VINETE", product_id: own });
    await deleteProduct(ctx, own);
    expect((await proposeReceiptMatches(ctx, ["ZACUSCA VINETE"], "lidl"))[0]?.source).not.toBe("invatat");
    await learnReceiptAlias(ctx, { retailer_id: "lidl", receipt_text: "PAINE NEAGRA", product_id: "lapte-integral" });
    setClock("2026-10-18T10:00:00.000Z");
    await learnReceiptAlias(ctx, { retailer_id: "kaufland", receipt_text: "PAINE NEAGRA", product_id: "lapte-semidegresat" });
    expect((await proposeReceiptMatches(ctx, ["PAINE NEAGRA"], "penny"))[0]?.product_id).toBe("lapte-semidegresat");
  });

  it("refuză textul gol și produsul inexistent", async () => {
    await expect(learnReceiptAlias(ctx, { retailer_id: null, receipt_text: " .. ", product_id: "lapte-integral" })).rejects.toThrow(/gol/);
    await expect(learnReceiptAlias(ctx, { retailer_id: null, receipt_text: "lapte", product_id: "nu-exista" })).rejects.toThrow(/nu există/);
  });

  it("intră în copia de siguranță și se mută în altă gospodărie cu id-ul ei determinist", async () => {
    await learnReceiptAlias(ctx, { retailer_id: "lidl", receipt_text: "Iaurt in stil grecesc", product_id: "lapte-integral" });
    const other = await newCtx("h2");
    await importHouseholdData(other, await exportHouseholdData(ctx));
    expect((await proposeReceiptMatches(other, ["IAURT IN STIL GRECESC"], "lidl"))[0]).toEqual({ product_id: "lapte-integral", source: "invatat" });
    await importHouseholdData(other, await exportHouseholdData(ctx));
    expect(await owned(other.db, "receipt_aliases", "h2")).toHaveLength(1);
  });
});

describe("aplicarea bonului", () => {
  const lines = [
    { product_id: "ceapa-galbena", name: "Ceapă galbenă", receipt_text: "CEAPA GALBENA KG", quantity: 1.014, unit: "kg" as const, amount: 2.32 },
    { product_id: "lapte-integral", name: "Lapte integral", receipt_text: "VDR.LAP.3,5%1L", quantity: 1, unit: "buc" as const, amount: 5.29 },
    { product_id: null, name: "Pungă hârtie", receipt_text: "PUNGA HARTIE", quantity: 1, unit: "buc" as const, amount: 1.89 },
  ];

  it("pe o listă: bifează ce era pe ea, adaugă restul; finalizarea le numără o singură dată", async () => {
    const listId = await createList(ctx, { name: "Săptămâna" });
    const ceapa = await addItem(ctx, listId, { product_id: "ceapa-galbena", quantity: 1, unit: "kg" });
    await addItem(ctx, listId, { product_id: "rosii", quantity: 1, unit: "kg" });
    const r = await applyReceipt(ctx, { retailer_id: "kaufland", date: "2026-10-12", list_id: listId, lines });
    expect(r).toEqual({ checked: 1, added: 2, transaction_id: null });
    const items = await listItems(ctx.db, listId);
    expect(items.find((i) => i.id === ceapa)).toMatchObject({ checked: true, actual_price: 2.32, quantity: 1.014, retailer_id: "kaufland" });
    expect(items.find((i) => i.product_id === "rosii")?.checked).toBe(false);
    expect(items.find((i) => i.name === "Pungă hârtie")).toMatchObject({ checked: true, actual_price: 1.89, product_id: null });

    await finalizeShopping(ctx, listId, { addToPantry: false });
    const spent = (await spendRecords(ctx.db, "h1")).filter((s) => s.amount != null);
    expect(spent.map((s) => s.amount).sort()).toEqual([1.89, 2.32, 5.29]);
    const prices = await owned(ctx.db, "product_prices", "h1");
    expect(prices.map((p) => [p.product_id, p.amount, p.observed_on, p.retailer_id])).toEqual(
      expect.arrayContaining([["ceapa-galbena", 2.32, "2026-10-12", "kaufland"], ["lapte-integral", 5.29, "2026-10-12", "kaufland"]]),
    );
  });

  it("un produs bifat deja în magazin primește prețul de pe bon, fără rând nou", async () => {
    const listId = await createList(ctx, { name: "Săptămâna" });
    const ceapa = await addItem(ctx, listId, { product_id: "ceapa-galbena", quantity: 1, unit: "kg" });
    await setChecked(ctx, ceapa, true);
    const r = await applyReceipt(ctx, { retailer_id: "kaufland", date: "2026-10-12", list_id: listId, lines: [lines[0]] });
    expect(r).toMatchObject({ checked: 1, added: 0 });
    const items = await listItems(ctx.db, listId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ checked: true, actual_price: 2.32 });
    await finalizeShopping(ctx, listId, { addToPantry: false });
    expect((await spendRecords(ctx.db, "h1")).map((s) => s.amount)).toEqual([2.32]);
  });

  it("fără listă: o cumpărătură în istoric, cu prețurile plătite la data bonului", async () => {
    const r = await applyReceipt(ctx, { retailer_id: "kaufland", date: "2026-10-12", list_id: null, lines });
    expect(r.added).toBe(3);
    const tx = await ctx.db.shopping_transactions.get(r.transaction_id!);
    expect(tx).toMatchObject({ list_id: null, list_cycle: null });
    const items = await owned(ctx.db, "shopping_transaction_items", "h1");
    expect(items).toHaveLength(3);
    const prices = await owned(ctx.db, "product_prices", "h1");
    expect(prices).toHaveLength(2);
    expect(prices.every((p) => p.price_type === "platit" && p.observed_on === "2026-10-12" && p.source === "supermarket")).toBe(true);
    expect((await spendRecords(ctx.db, "h1")).length).toBe(3);
  });

  it("ține minte potrivirile confirmate pentru bonul următor", async () => {
    await applyReceipt(ctx, { retailer_id: "kaufland", date: "2026-10-12", list_id: null, lines });
    const [lapte, punga] = await proposeReceiptMatches(ctx, ["VDR.LAP.3,5%1L", "PUNGA HARTIE"], "kaufland");
    expect(lapte).toEqual({ product_id: "lapte-integral", source: "invatat" });
    // Linia fără produs („nu e din catalog”) nu se învață.
    expect(punga?.source).not.toBe("invatat");
    expect(await owned(ctx.db, "receipt_aliases", "h1")).toHaveLength(2);
  });

  it("refuză bonul gol, lista și magazinul inexistente, produsul șters", async () => {
    await expect(applyReceipt(ctx, { retailer_id: null, date: "2026-10-12", list_id: null, lines: [] })).rejects.toThrow(/cel puțin un produs/);
    await expect(applyReceipt(ctx, { retailer_id: "nu-exista", date: "2026-10-12", list_id: null, lines })).rejects.toThrow(/Magazinul/);
    await expect(applyReceipt(ctx, { retailer_id: null, date: "2026-10-12", list_id: "nu-exista", lines })).rejects.toThrow(/Lista/);
    await expect(applyReceipt(ctx, { retailer_id: null, date: "2026-10-12", list_id: null, lines: [{ ...lines[0], product_id: "nu-exista" }] })).rejects.toThrow(/nu mai există în catalog/);
  });
});
