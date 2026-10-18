import { z } from "zod";
import type { ItemOrigin, PurchaseSource, ShoppingListItem, UnitCode } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow, upsertRow } from "@/lib/db/write";
import { newId, stableId } from "@/lib/db/ids";
import { nowIso } from "@/lib/clock";
import { planMerge } from "@/lib/domain/shopping";
import type { ShoppingNeed } from "@/lib/domain/quantities";
import { sumMoney } from "@/lib/domain/money";
import { localDateOf } from "@/lib/domain/dates";
import { type AppCtx, UserError, w } from "./context";
import { parse, zMoney, zName, zNote, zQuantity, zSource, zUnit } from "./validation";
import { listItems, owned, productMap } from "./queries";
import { variantField } from "./catalog";

const listInput = z.object({
  name: zName(80, "Numele listei"),
  is_recurring: z.boolean().default(false),
  default_retailer_id: z.string().nullable().default(null),
});

export async function createList(ctx: AppCtx, input: z.input<typeof listInput>): Promise<string> {
  const v = parse(listInput, input);
  const lists = await owned(ctx.db, "shopping_lists", ctx.householdId);
  const id = newId();
  await insertRow(
    ctx.db,
    "shopping_lists",
    { id, household_id: ctx.householdId, name: v.name, is_recurring: v.is_recurring, cycle: 1, archived_at: null, default_retailer_id: v.default_retailer_id, sort_order: lists.length },
    w(ctx),
  );
  return id;
}

export async function updateList(ctx: AppCtx, id: string, patch: { name?: string; is_recurring?: boolean; default_retailer_id?: string | null }) {
  const v = parse(listInput.partial(), patch);
  await updateRow(ctx.db, "shopping_lists", id, v, w(ctx));
}

export async function archiveList(ctx: AppCtx, id: string) {
  await updateRow(ctx.db, "shopping_lists", id, { archived_at: nowIso() }, w(ctx));
}

export async function restoreList(ctx: AppCtx, id: string) {
  await updateRow(ctx.db, "shopping_lists", id, { archived_at: null }, w(ctx));
}

export async function deleteList(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "shopping_lists", id, w(ctx));
}

/** Copie a listei, cu toate produsele nebifate și fără prețurile plătite. */
export async function duplicateList(ctx: AppCtx, id: string, name?: string): Promise<string> {
  const source = await ctx.db.shopping_lists.get(id);
  if (!source) throw new UserError("Lista nu mai există.");
  const newListId = await createList(ctx, { name: name ?? `${source.name} (copie)`.slice(0, 80), is_recurring: source.is_recurring, default_retailer_id: source.default_retailer_id });
  for (const item of await listItems(ctx.db, id)) {
    await insertRow(
      ctx.db,
      "shopping_list_items",
      { ...pickItem(item), id: newId(), list_id: newListId, checked: false, checked_at: null, checked_by: null, actual_price: null },
      w(ctx),
    );
  }
  return newListId;
}

function pickItem(i: ShoppingListItem): Omit<ShoppingListItem, "created_at" | "updated_at" | "deleted_at"> {
  const { created_at: _c, updated_at: _u, deleted_at: _d, ...rest } = i;
  void _c;
  void _u;
  void _d;
  return rest;
}

const itemInput = z.object({
  product_id: z.string().nullable().default(null),
  name: zName(120, "Denumirea produsului").optional(),
  quantity: zQuantity.nullable().optional(),
  unit: zUnit.nullable().optional(),
  category_id: z.string().optional(),
  estimated_price: zMoney.nullable().optional(),
  actual_price: zMoney.nullable().optional(),
  retailer_id: z.string().nullable().optional(),
  source: zSource.optional(),
  priority: z.enum(["normala", "ridicata"]).optional(),
  note: zNote.nullable().optional(),
  origin: z.enum(["manual", "reteta", "plan", "recurent"]).optional(),
  variant_id: z.string().nullable().optional(),
});

export type ItemInput = z.input<typeof itemInput>;

/**
 * Adaugă un produs în listă. Dacă produsul din catalog e deja pe listă,
 * nebifat, cu unitate compatibilă, i se mărește cantitatea în loc să apară
 * de două ori. Cu o variantă aleasă, se unește doar cu linia aceleiași variante.
 */
export async function addItem(ctx: AppCtx, listId: string, input: ItemInput): Promise<string> {
  const v = parse(itemInput, input);
  const list = await ctx.db.shopping_lists.get(listId);
  if (!list || list.deleted_at) throw new UserError("Lista nu mai există.");
  const product = v.product_id ? await ctx.db.products.get(v.product_id) : undefined;
  if (v.product_id && !product) throw new UserError("Produsul nu există în catalog.");
  const name = v.name ?? product?.name;
  if (!name) throw new UserError("Scrie numele produsului.");
  const variant = await variantField(ctx, v.variant_id, product?.id ?? null);

  if (product) {
    const existing = (await listItems(ctx.db, listId)).filter((i) => !variant.variant_id || i.variant_id === variant.variant_id);
    const quantity = v.quantity === undefined ? null : v.quantity;
    const unit = v.unit === undefined ? (quantity == null ? null : product.default_unit) : v.unit;
    const ops = planMerge(existing, [{ product_id: product.id, quantity, unit }]);
    const update = ops.find((o) => o.kind === "update");
    if (update && update.kind === "update") {
      await updateRow(ctx.db, "shopping_list_items", update.item_id, { quantity: update.quantity, unit: update.unit }, w(ctx));
      return update.item_id;
    }
    if (ops.length === 0) {
      // Produsul (fără cantitate) e deja pe listă.
      return existing.find((i) => i.product_id === product.id && !i.checked)!.id;
    }
  }

  const items = await listItems(ctx.db, listId);
  const id = newId();
  await insertRow(
    ctx.db,
    "shopping_list_items",
    {
      id,
      household_id: ctx.householdId,
      list_id: listId,
      product_id: product?.id ?? null,
      name,
      quantity: v.quantity ?? null,
      unit: v.quantity == null ? null : (v.unit ?? product?.default_unit ?? "buc"),
      category_id: v.category_id ?? product?.category_id ?? "diverse",
      estimated_price: v.estimated_price ?? null,
      actual_price: v.actual_price ?? null,
      retailer_id: v.retailer_id ?? list.default_retailer_id ?? null,
      source: (v.source ?? "supermarket") as PurchaseSource,
      priority: v.priority ?? "normala",
      note: v.note ?? null,
      checked: false,
      checked_at: null,
      checked_by: null,
      origin: (v.origin ?? "manual") as ItemOrigin,
      sort_order: items.length,
      ...variant,
    },
    w(ctx),
  );
  return id;
}

export async function updateItem(ctx: AppCtx, id: string, patch: ItemInput) {
  const v = parse(itemInput.partial(), patch);
  const clean: Record<string, unknown> = Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined));
  if ("quantity" in clean && clean.quantity == null) clean.unit = null;
  if ("variant_id" in clean || "product_id" in clean) {
    const item = await ctx.db.shopping_list_items.get(id);
    if (!item) throw new UserError("Produsul nu mai există în listă.");
    const productId = "product_id" in clean ? (clean.product_id as string | null) : item.product_id;
    const variantId = "variant_id" in clean ? (clean.variant_id as string | null) : item.variant_id;
    // Varianta e a produsului: la alt produs, varianta veche se scoate.
    const keep = variantId && (await ctx.db.product_variants.get(variantId))?.product_id === productId;
    if ("variant_id" in clean && clean.variant_id) Object.assign(clean, await variantField(ctx, variantId, productId));
    else if (!keep && item.variant_id) clean.variant_id = null;
    // O linie care n-a avut variantă nu trimite câmpul (server fără migrația variantelor).
    else if (!item.variant_id) delete clean.variant_id;
  }
  await updateRow(ctx.db, "shopping_list_items", id, clean as Partial<ShoppingListItem>, w(ctx));
}

export async function setChecked(ctx: AppCtx, id: string, checked: boolean) {
  await updateRow(
    ctx.db,
    "shopping_list_items",
    id,
    checked ? { checked: true, checked_at: nowIso(), checked_by: ctx.userId } : { checked: false, checked_at: null, checked_by: null },
    w(ctx),
  );
}

/** Prețul plătit pentru toată linia; bifează automat produsul. */
export async function setActualPrice(ctx: AppCtx, id: string, amount: number | null) {
  if (amount != null) parse(zMoney, amount);
  const item = await ctx.db.shopping_list_items.get(id);
  if (!item) throw new UserError("Produsul nu mai există în listă.");
  const patch: Partial<ShoppingListItem> = { actual_price: amount };
  if (amount != null && !item.checked) Object.assign(patch, { checked: true, checked_at: nowIso(), checked_by: ctx.userId });
  await updateRow(ctx.db, "shopping_list_items", id, patch, w(ctx));
}

export async function moveItem(ctx: AppCtx, id: string, toListId: string) {
  const target = await ctx.db.shopping_lists.get(toListId);
  if (!target || target.deleted_at || target.household_id !== ctx.householdId) throw new UserError("Lista aleasă nu mai există.");
  await updateRow(ctx.db, "shopping_list_items", id, { list_id: toListId }, w(ctx));
}

export async function deleteItem(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "shopping_list_items", id, w(ctx));
}

/** Adaugă în listă nevoile calculate (din rețete sau din plan), fără dubluri. */
export async function addNeeds(ctx: AppCtx, listId: string, needs: ShoppingNeed[], origin: ItemOrigin): Promise<{ added: number; updated: number }> {
  const products = await productMap(ctx.db, ctx.householdId);
  const existing = await listItems(ctx.db, listId);
  const ops = planMerge(existing, needs);
  let added = 0;
  let updated = 0;
  for (const op of ops) {
    if (op.kind === "update") {
      await updateRow(ctx.db, "shopping_list_items", op.item_id, { quantity: op.quantity, unit: op.unit }, w(ctx));
      updated++;
    } else {
      const p = products.get(op.need.product_id);
      if (!p) continue;
      const note = (op.need as ShoppingNeed).note ?? null;
      await addItem(ctx, listId, { product_id: p.id, quantity: op.need.quantity, unit: op.need.unit as UnitCode | null, note, origin });
      added++;
    }
  }
  return { added, updated };
}

const COLD = new Set(["lactate", "branzeturi", "carne", "peste", "mezeluri", "oua"]);

function guessLocation(categoryId: string): string {
  if (categoryId === "congelate") return "congelator";
  if (COLD.has(categoryId)) return "frigider";
  return "camara";
}

export interface FinalizeResult {
  transaction_id: string;
  total: number;
  items: number;
  without_price: number;
  added_to_pantry: number;
}

/**
 * Încheie tura de cumpărături: produsele bifate devin cheltuieli înregistrate,
 * prețurile plătite intră în istoricul de prețuri, iar (la cerere) produsele
 * alimentare intră în cămară. Lista recurentă se golește de bifări pentru data
 * viitoare; cea obișnuită se arhivează.
 *
 * Id-urile sunt deterministe (listă + tură), deci dacă doi membri finalizează
 * aceeași tură de pe telefoane diferite, cheltuiala nu se dublează.
 */
export async function finalizeShopping(ctx: AppCtx, listId: string, opts: { addToPantry: boolean }): Promise<FinalizeResult> {
  const list = await ctx.db.shopping_lists.get(listId);
  if (!list || list.deleted_at) throw new UserError("Lista nu mai există.");
  const checked = (await listItems(ctx.db, listId)).filter((i) => i.checked);
  if (checked.length === 0) throw new UserError("Bifează întâi produsele pe care le-ai cumpărat.");
  const products = await productMap(ctx.db, ctx.householdId);
  const categories = new Map((await ctx.db.product_categories.toArray()).map((c) => [c.id, c]));

  const txId = await stableId("tura", listId, String(list.cycle));
  const startedAt = checked.map((i) => i.checked_at ?? nowIso()).sort()[0];
  await upsertRow(
    ctx.db,
    "shopping_transactions",
    { id: txId, household_id: ctx.householdId, list_id: listId, list_cycle: list.cycle, started_at: startedAt, completed_at: nowIso(), note: null },
    w(ctx),
  );

  let added = 0;
  for (const item of checked) {
    const txItemId = await stableId("tura-produs", txId, item.id);
    const purchasedAt = item.checked_at ?? nowIso();
    await upsertRow(
      ctx.db,
      "shopping_transaction_items",
      {
        id: txItemId,
        household_id: ctx.householdId,
        transaction_id: txId,
        list_item_id: item.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category_id: item.category_id,
        amount: item.actual_price,
        retailer_id: item.retailer_id,
        source: item.source,
        purchased_at: purchasedAt,
        ...(item.variant_id ? { variant_id: item.variant_id } : {}),
      },
      w(ctx),
    );
    const product = item.product_id ? products.get(item.product_id) : undefined;
    if (product && item.actual_price != null) {
      await upsertRow(
        ctx.db,
        "product_prices",
        {
          id: await stableId("pret", txItemId),
          household_id: ctx.householdId,
          product_id: product.id,
          retailer_id: item.retailer_id,
          source: item.source,
          amount: item.actual_price,
          currency: "RON",
          quantity: item.quantity ?? 1,
          unit: item.unit ?? product.default_unit,
          price_type: "platit",
          confidence: item.quantity == null ? "medie" : "ridicata",
          observed_on: localDateOf(purchasedAt),
          transaction_item_id: txItemId,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
        },
        w(ctx),
      );
    }
    if (opts.addToPantry && product && categories.get(product.category_id)?.is_food !== false) {
      await upsertRow(
        ctx.db,
        "pantry_items",
        {
          id: await stableId("camara", txItemId),
          household_id: ctx.householdId,
          product_id: product.id,
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? product.default_unit,
          location_id: guessLocation(product.category_id),
          purchased_on: localDateOf(purchasedAt),
          expires_on: null,
          note: null,
        },
        w(ctx),
      );
      added++;
    }
  }

  await updateRow(ctx.db, "shopping_lists", listId, list.is_recurring ? { cycle: list.cycle + 1 } : { cycle: list.cycle + 1, archived_at: nowIso() }, w(ctx));
  if (list.is_recurring) {
    for (const item of checked) {
      await updateRow(ctx.db, "shopping_list_items", item.id, { checked: false, checked_at: null, checked_by: null, actual_price: null }, w(ctx));
    }
  }

  return {
    transaction_id: txId,
    total: sumMoney(checked.map((i) => i.actual_price ?? 0)),
    items: checked.length,
    without_price: checked.filter((i) => i.actual_price == null).length,
    added_to_pantry: added,
  };
}

/** Anulează ștergerea unui produs din listă (butonul „Anulează” de după ștergere). */
export async function restoreItem(ctx: AppCtx, id: string) {
  await updateRow(ctx.db, "shopping_list_items", id, { deleted_at: null }, w(ctx));
}

/**
 * Completează sau corectează suma plătită pentru un produs dintr-o
 * cumpărătură finalizată (ex. prețul uitat în magazin). Actualizează și
 * istoricul de prețuri.
 */
export async function setTransactionItemAmount(ctx: AppCtx, id: string, amount: number | null) {
  if (amount != null) parse(zMoney, amount);
  const item = await ctx.db.shopping_transaction_items.get(id);
  if (!item || item.deleted_at) throw new UserError("Produsul nu mai există în istoric.");
  await updateRow(ctx.db, "shopping_transaction_items", id, { amount }, w(ctx));
  if (!item.product_id) return;
  const product = await ctx.db.products.get(item.product_id);
  const priceId = await stableId("pret", id);
  if (amount == null) {
    if (await ctx.db.product_prices.get(priceId)) await softDelete(ctx.db, "product_prices", priceId, w(ctx));
    return;
  }
  await upsertRow(
    ctx.db,
    "product_prices",
    {
      id: priceId,
      household_id: ctx.householdId,
      product_id: item.product_id,
      retailer_id: item.retailer_id,
      source: item.source,
      amount,
      currency: "RON",
      quantity: item.quantity ?? 1,
      unit: item.unit ?? product?.default_unit ?? "buc",
      price_type: "platit",
      confidence: item.quantity == null ? "medie" : "ridicata",
      observed_on: localDateOf(item.purchased_at),
      transaction_item_id: id,
      ...(item.variant_id ? { variant_id: item.variant_id } : {}),
    },
    w(ctx),
  );
}

/** Șterge o cumpărătură din istoric (ex. introdusă din greșeală); cheltuiala dispare din buget. */
export async function deleteTransaction(ctx: AppCtx, id: string) {
  for (const item of await ctx.db.shopping_transaction_items.where("transaction_id").equals(id).toArray()) {
    if (item.deleted_at) continue;
    await softDelete(ctx.db, "shopping_transaction_items", item.id, w(ctx));
    const priceId = await stableId("pret", item.id);
    if (await ctx.db.product_prices.get(priceId)) await softDelete(ctx.db, "product_prices", priceId, w(ctx));
  }
  await softDelete(ctx.db, "shopping_transactions", id, w(ctx));
}
