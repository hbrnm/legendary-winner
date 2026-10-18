import { z } from "zod";
import type { ISODate, PurchaseSource, UnitCode } from "@/lib/domain/types";
import { insertRow, updateRow, upsertRow } from "@/lib/db/write";
import { newId, stableId } from "@/lib/db/ids";
import { localDateOf } from "@/lib/domain/dates";
import { receiptKey, proposeMatch, type MatchProposal } from "@/lib/domain/receipt-match";
import { type AppCtx, UserError, w } from "./context";
import { listItems, owned, visible } from "./queries";
import { parse, zDate, zMoney, zName, zQuantity, zUnit } from "./validation";
import { addItem } from "./shopping";
import { productSearchIndex } from "./catalog";

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
}

/**
 * Aplică bonul confirmat de om (.tasks/005, etapa 4). Cu o listă: produsele
 * de pe ea (întâi cele nebifate, apoi cele bifate deja în magazin) primesc
 * prețul de pe bon și se bifează, iar celelalte se adaugă bifate; apoi „Termină cumpărăturile” le înregistrează ca acum, deci nimic nu
 * se numără de două ori. Fără listă: o cumpărătură în istoric, cu prețurile
 * plătite. Potrivirile confirmate se țin minte pentru bonul următor.
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

  const result: ReceiptApplyResult = { checked: 0, added: 0, transaction_id: null };
  if (v.list_id) {
    const list = await ctx.db.shopping_lists.get(v.list_id);
    if (!list || list.deleted_at || list.household_id !== ctx.householdId || list.archived_at) throw new UserError("Lista aleasă nu mai există.");
    // Nebifatele întâi; un produs bifat deja în magazin primește doar prețul, nu un rând nou
    // (altfel „Gata” l-ar număra de două ori).
    const open = (await listItems(ctx.db, v.list_id)).sort((a, b) => Number(a.checked) - Number(b.checked));
    for (const l of v.lines) {
      const paid = { checked: true, checked_at: purchasedAt, checked_by: ctx.userId, actual_price: l.amount, retailer_id: v.retailer_id, source };
      const qty = l.quantity != null && l.unit ? { quantity: l.quantity, unit: l.unit as UnitCode } : {};
      const match = l.product_id ? open.find((i) => i.product_id === l.product_id) : undefined;
      if (match) {
        open.splice(open.indexOf(match), 1);
        await updateRow(ctx.db, "shopping_list_items", match.id, { ...paid, ...qty }, w(ctx));
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
        { id: itemId, household_id: ctx.householdId, transaction_id: txId, list_item_id: null, product_id: product?.id ?? null, name: l.name, quantity: l.quantity, unit: l.unit as UnitCode | null, category_id: product?.category_id ?? "diverse", amount: l.amount, retailer_id: v.retailer_id, source, purchased_at: purchasedAt },
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
