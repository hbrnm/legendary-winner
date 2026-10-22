import { z } from "zod";
import type { ISODate, PurchaseSource, UnitCode } from "@/lib/domain/types";
import { insertRow, updateRow, upsertRow } from "@/lib/db/write";
import { newId, stableId } from "@/lib/db/ids";
import { localDateOf } from "@/lib/domain/dates";
import { guessCategory, receiptKey, proposeMatch, type MatchProposal } from "@/lib/domain/receipt-match";
import { normalize } from "@/lib/domain/search";
import { diverseGroups, type DiverseGroup } from "@/lib/domain/budget";
import { type AppCtx, UserError, w } from "./context";
import { listItems, owned, spendRecords, visible } from "./queries";
import { parse, zDate, zMoney, zName, zQuantity, zUnit } from "./validation";
import { addItem } from "./shopping";
import { createProduct, productSearchIndex, updateProduct } from "./catalog";

// Bonurile fiscale (.tasks/005): potrivirea care învață din confirmări.

/** Id-ul determinist: același text, la același magazin, învățat pe două telefoane, e un singur rând. */
export function receiptAliasId(householdId: string, retailerId: string | null, key: string): Promise<string> {
  return stableId("bon-alias", householdId, retailerId ?? "", key);
}

/**
 * Ține minte că textul de pe bon înseamnă produsul (la confirmarea unei linii).
 * O confirmare nouă pentru același text îl leagă de noul produs.
 */
export async function learnReceiptAlias(ctx: AppCtx, input: { retailer_id: string | null; receipt_text: string; product_id: string }): Promise<string> {
  const key = receiptKey(input.receipt_text);
  if (!key) throw new UserError("Textul de pe bon e gol.");
  const product = await ctx.db.products.get(input.product_id);
  if (!product || product.deleted_at) throw new UserError("Produsul nu există în catalog.");
  const id = await receiptAliasId(ctx.householdId, input.retailer_id, key);
  await upsertRow(ctx.db, "receipt_aliases", { id, household_id: ctx.householdId, retailer_id: input.retailer_id, receipt_text: key, product_id: product.id }, w(ctx));
  return id;
}

/** Propunerile pentru liniile unui bon, în ordine (null = fără propunere). */
export async function proposeReceiptMatches(ctx: AppCtx, names: string[], retailerId: string | null): Promise<(MatchProposal | null)[]> {
  const [aliases, index, products] = await Promise.all([owned(ctx.db, "receipt_aliases", ctx.householdId), productSearchIndex(ctx), visible(ctx.db, "products", ctx.householdId)]);
  const alive = new Set(products.map((p) => p.id));
  return names.map((n) => (n ? proposeMatch(n, retailerId, aliases, index, alive) : null));
}

/** Categoria propusă pentru fiecare linie, după catalog (fără internet; .tasks/016); null = „Diverse”. */
export async function proposeReceiptCategories(ctx: AppCtx, names: string[]): Promise<(string | null)[]> {
  const [index, products] = await Promise.all([productSearchIndex(ctx), visible(ctx.db, "products", ctx.householdId)]);
  const categoryOf = new Map(products.map((p) => [p.id, p.category_id]));
  return names.map((n) => (n ? guessCategory(n, index, (id) => categoryOf.get(id)) : null));
}

const applyInput = z.object({
  retailer_id: z.string().nullable(),
  date: zDate,
  /** Lista pe care se bifează produsele; null = cumpărătură direct în istoric. */
  list_id: z.string().nullable(),
  lines: z
    .array(
      z.object({
        product_id: z.string().nullable(),
        name: zName(120, "Denumirea produsului"),
        /** Textul de pe bon, ca aplicația să învețe potrivirea. */
        receipt_text: z.string().max(200).default(""),
        /** Numele tipărit pe bon, păstrat în istoric (.tasks/016); null = linia nu vine de pe un bon. */
        receipt_name: z.string().trim().max(200).nullable().default(null),
        /** Categoria produsului nou, când linia nu are produs; null = „Diverse”. */
        category_id: z.string().nullable().default(null),
        quantity: zQuantity.nullable(),
        unit: zUnit.nullable(),
        /** Suma plătită pe linie, după reducere. */
        amount: zMoney,
      }),
    )
    .min(1, "Bifează cel puțin un produs de pe bon."),
});

export type ReceiptApplyInput = z.input<typeof applyInput>;

export interface ReceiptApplyResult {
  /** Produse de pe listă bifate cu prețul de pe bon. */
  checked: number;
  /** Linii noi (pe listă sau în cumpărătură). */
  added: number;
  /** Cumpărătura din istoric, când bonul nu merge pe o listă. */
  transaction_id: string | null;
  /** Produse noi în catalogul gospodăriei, din liniile fără produs. */
  created: number;
}

/**
 * Aplică bonul confirmat de om (.tasks/005, etapa 4). Cu o listă: produsele
 * de pe ea (întâi cele nebifate, apoi cele bifate deja în magazin) primesc
 * prețul de pe bon și se bifează, iar celelalte se adaugă bifate; apoi „Termină cumpărăturile” le înregistrează ca acum, deci nimic nu
 * se numără de două ori. Fără listă: o cumpărătură în istoric, cu prețurile
 * plătite. Potrivirile confirmate se țin minte pentru bonul următor. O linie
 * fără produs devine produs nou al gospodăriei, cu numele de pe bon, în
 * categoria aleasă pe „Verifică bonul” (.tasks/016; altfel „Diverse”), deci prețul ei intră în
 * istoricul de prețuri și bonul următor o recunoaște.
 */
export async function applyReceipt(ctx: AppCtx, input: ReceiptApplyInput): Promise<ReceiptApplyResult> {
  const v = parse(applyInput, input);
  const retailer = v.retailer_id ? await ctx.db.retailers.get(v.retailer_id) : undefined;
  if (v.retailer_id && !retailer) throw new UserError("Magazinul ales nu mai există.");
  const source: PurchaseSource = retailer?.kind === "piata" ? "piata" : retailer?.kind === "producator" ? "producator" : "supermarket";
  // Ora din mijlocul zilei, ca data locală să rămână ziua de pe bon.
  const purchasedAt = new Date(`${v.date}T12:00:00`).toISOString();
  const products = new Map((await visible(ctx.db, "products", ctx.householdId)).map((p) => [p.id, p]));
  for (const l of v.lines) if (l.product_id && !products.has(l.product_id)) throw new UserError("Un produs ales nu mai există în catalog. Alege-l din nou.");
  const categories = new Set((await visible(ctx.db, "product_categories", ctx.householdId)).map((c) => c.id));

  // Lista se verifică înainte de produsele noi, ca un bon refuzat să nu lase produse în catalog.
  const list = v.list_id ? await ctx.db.shopping_lists.get(v.list_id) : undefined;
  if (v.list_id && (!list || list.deleted_at || list.household_id !== ctx.householdId || list.archived_at)) throw new UserError("Lista aleasă nu mai există.");

  const result: ReceiptApplyResult = { checked: 0, added: 0, transaction_id: null, created: 0 };
  // Același nume (de pe acest bon sau din catalog) e același produs, nu o dublură.
  const byName = new Map([...products.values()].map((p) => [normalize(p.name), p]));
  // Numele de pe bon se păstrează doar când spune altceva decât numele produsului.
  const receiptName = (l: (typeof v.lines)[number]) => (l.receipt_name && normalize(l.receipt_name) !== normalize(l.name) ? { receipt_name: l.receipt_name } : {});
  for (const l of v.lines) {
    if (l.product_id) continue;
    let product = byName.get(normalize(l.name));
    if (!product) {
      const category_id = l.category_id && categories.has(l.category_id) ? l.category_id : "diverse";
      const id = await createProduct(ctx, { name: l.name, category_id, default_unit: (l.unit as UnitCode | null) ?? "buc" });
      product = (await ctx.db.products.get(id))!;
      products.set(id, product);
      byName.set(normalize(product.name), product);
      result.created++;
    }
    l.product_id = product.id;
  }
  if (v.list_id) {
    // Nebifatele întâi; un produs bifat deja în magazin primește doar prețul, nu un rând nou
    // (altfel „Gata” l-ar număra de două ori).
    const open = (await listItems(ctx.db, v.list_id)).sort((a, b) => Number(a.checked) - Number(b.checked));
    for (const l of v.lines) {
      const paid = { ...receiptName(l), checked: true, checked_at: purchasedAt, checked_by: ctx.userId, actual_price: l.amount, retailer_id: v.retailer_id, source };
      const qty = l.quantity != null && l.unit ? { quantity: l.quantity, unit: l.unit as UnitCode } : {};
      const match = l.product_id ? open.find((i) => i.product_id === l.product_id) : undefined;
      if (match) {
        open.splice(open.indexOf(match), 1);
        // Un nume de pe un bon mai vechi nu rămâne pe linie.
        const stale = match.receipt_name && !paid.receipt_name ? { receipt_name: null } : {};
        await updateRow(ctx.db, "shopping_list_items", match.id, { ...paid, ...qty, ...stale }, w(ctx));
        result.checked++;
      } else {
        const id = await addItem(ctx, v.list_id, { product_id: l.product_id, name: l.name, quantity: l.quantity, unit: l.unit as UnitCode | null, retailer_id: v.retailer_id, source });
        await updateRow(ctx.db, "shopping_list_items", id, paid, w(ctx));
        result.added++;
      }
    }
  } else {
    const txId = newId();
    await insertRow(ctx.db, "shopping_transactions", { id: txId, household_id: ctx.householdId, list_id: null, list_cycle: null, started_at: purchasedAt, completed_at: purchasedAt, note: null }, w(ctx));
    for (const l of v.lines) {
      const product = l.product_id ? products.get(l.product_id) : undefined;
      const itemId = newId();
      await insertRow(
        ctx.db,
        "shopping_transaction_items",
        { id: itemId, household_id: ctx.householdId, transaction_id: txId, list_item_id: null, product_id: product?.id ?? null, name: l.name, ...receiptName(l), quantity: l.quantity, unit: l.unit as UnitCode | null, category_id: product?.category_id ?? "diverse", amount: l.amount, retailer_id: v.retailer_id, source, purchased_at: purchasedAt },
        w(ctx),
      );
      if (product) {
        await insertRow(
          ctx.db,
          "product_prices",
          {
            id: await stableId("pret", itemId),
            household_id: ctx.householdId,
            product_id: product.id,
            retailer_id: v.retailer_id,
            source,
            amount: l.amount,
            currency: "RON",
            quantity: l.quantity ?? 1,
            unit: (l.unit as UnitCode | null) ?? product.default_unit,
            price_type: "platit",
            confidence: l.quantity == null ? "medie" : "ridicata",
            observed_on: localDateOf(purchasedAt) as ISODate,
            transaction_item_id: itemId,
          },
          w(ctx),
        );
      }
      result.added++;
    }
    result.transaction_id = txId;
  }
  for (const l of v.lines) if (l.product_id && receiptKey(l.receipt_text)) await learnReceiptAlias(ctx, { retailer_id: v.retailer_id, receipt_text: l.receipt_text, product_id: l.product_id });
  return result;
}

/**
 * Ce a ajuns în „Diverse” din oficiu (.tasks/016): cumpărăturile încheiate cu
 * produse ale gospodăriei sau fără produs. Produsele din catalogul comun aflate
 * în „Diverse” (baterii, becuri) sunt acolo pe bună dreptate și nu se arată.
 */
export async function diverseToSort(ctx: AppCtx): Promise<DiverseGroup[]> {
  const [spend, own] = await Promise.all([spendRecords(ctx.db, ctx.householdId), owned(ctx.db, "products", ctx.householdId)]);
  const mine = new Set(own.map((p) => p.id));
  return diverseGroups(
    spend.filter((i) => !i.transaction_id.startsWith("in-curs") && (!i.product_id || mine.has(i.product_id))),
    normalize,
  );
}

/**
 * Mută un produs din „Diverse” în categoria potrivită (.tasks/016): produsul
 * gospodăriei, liniile lui din liste și cumpărăturile de până acum, ca bugetul
 * să arate unde s-au dus banii. Un produs din catalogul comun nu se schimbă;
 * se mută doar cumpărăturile gospodăriei. `key` vine din `diverseToSort`.
 */
export async function moveOutOfDiverse(ctx: AppCtx, key: string, categoryId: string): Promise<number> {
  const category = await ctx.db.product_categories.get(categoryId);
  if (!category || category.deleted_at || (category.household_id && category.household_id !== ctx.householdId)) throw new UserError("Categoria aleasă nu mai există.");
  if (categoryId === "diverse") return 0;
  const productId = key.startsWith("nume:") ? null : key;
  const name = productId ? null : key.slice("nume:".length);
  const same = (i: { product_id: string | null; name: string; category_id: string }) =>
    i.category_id === "diverse" && (productId ? i.product_id === productId : !i.product_id && normalize(i.name) === name);
  if (productId) {
    const product = await ctx.db.products.get(productId);
    if (product && product.household_id === ctx.householdId && product.category_id === "diverse") await updateProduct(ctx, productId, { category_id: categoryId });
  }
  let moved = 0;
  for (const i of (await owned(ctx.db, "shopping_transaction_items", ctx.householdId)).filter(same)) {
    await updateRow(ctx.db, "shopping_transaction_items", i.id, { category_id: categoryId }, w(ctx));
    moved++;
  }
  for (const i of (await owned(ctx.db, "shopping_list_items", ctx.householdId)).filter(same)) await updateRow(ctx.db, "shopping_list_items", i.id, { category_id: categoryId }, w(ctx));
  return moved;
}
