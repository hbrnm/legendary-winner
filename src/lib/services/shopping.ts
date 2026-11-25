import { z } from "zod";
import type { ItemOrigin, Product, PurchaseSource, ShoppingListItem, UnitCode } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow, upsertRow, type WriteOptions } from "@/lib/db/write";
import type { RowWrite } from "@/lib/db/database";
import { newId, stableId } from "@/lib/db/ids";
import { nowIso } from "@/lib/clock";
import { planMerge } from "@/lib/domain/shopping";
import type { ShoppingNeed } from "@/lib/domain/quantities";
import { sumMoney } from "@/lib/domain/money";
import { localDateOf } from "@/lib/domain/dates";
import { autoConsumeOn, isLeafyGreen } from "@/lib/domain/pantry";
import { CONSUME_DAYS } from "@/data/consume-days";
import { type AppCtx, UserError, w } from "./context";
import { parse, parsePatch, zMoney, zName, zNote, zQuantity, zSource, zUnit } from "./validation";
import { listItems, owned, productMap } from "./queries";
import { normalize } from "@/lib/domain/search";
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
  const v = parsePatch(listInput, patch);
  await updateRow(ctx.db, "shopping_lists", id, v, w(ctx));
}

export async function archiveList(ctx: AppCtx, id: string) {
  await updateRow(ctx.db, "shopping_lists", id, { archived_at: nowIso() }, w(ctx));
}

export async function restoreList(ctx: AppCtx, id: string) {
  const list = await ctx.db.shopping_lists.get(id);
  if (!list || list.deleted_at) throw new UserError("Lista nu mai există.");
  await updateRow(ctx.db, "shopping_lists", id, { archived_at: null }, w(ctx));
  // Dacă lista a fost anterior finalizată (tura > 0), produsele se resetează pentru o tură nouă (F05)
  if (list.cycle > 0) {
    const items = await listItems(ctx.db, id);
    for (const item of items) {
      if (item.checked || item.actual_price != null || item.receipt_name) {
        await updateRow(
          ctx.db,
          "shopping_list_items",
          item.id,
          { checked: false, checked_at: null, checked_by: null, actual_price: null, ...(item.receipt_name ? { receipt_name: null } : {}) },
          w(ctx),
        );
      }
    }
  }
}

export async function deleteList(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "shopping_lists", id, w(ctx));
}

/** „Anulează” după ștergere: lista revine, cu produsele ei (ștergerea e logică). */
export async function restoreDeletedList(ctx: AppCtx, id: string) {
  await updateRow(ctx.db, "shopping_lists", id, { deleted_at: null }, w(ctx));
}

/** Copie a listei, cu toate produsele nebifate și fără prețurile plătite. */
export async function duplicateList(ctx: AppCtx, id: string, name?: string): Promise<string> {
  const source = await ctx.db.shopping_lists.get(id);
  if (!source) throw new UserError("Lista nu mai există.");
  return copyShoppingSource(ctx, { kind: "list", id }, name ?? `${source.name} (copie)`.slice(0, 80));
}

export type ShoppingSource =
  | { kind: "list"; id: string }
  | { kind: "transaction"; id: string };

/**
 * Copiază o listă (inclusiv arhivată/recurentă) sau o tranzacție din istoric într-o listă nouă.
 * Resetează stările de bifat, prețurile plătite și nu include ajustări sintetice de buget.
 * Operație atomică protejată la eșec.
 */
export async function copyShoppingSource(
  ctx: AppCtx,
  source: ShoppingSource,
  name: string
): Promise<string> {
  const v = parse(listInput.pick({ name: true }), { name });
  return await ctx.db.transaction(
    "rw",
    [
      ctx.db.shopping_lists,
      ctx.db.shopping_list_items,
      ctx.db.shopping_transactions,
      ctx.db.shopping_transaction_items,
      ctx.db.outbox,
    ],
    async () => {
      const lists = await owned(ctx.db, "shopping_lists", ctx.householdId);
      const newListId = newId();

      if (source.kind === "list") {
        const sourceList = await ctx.db.shopping_lists.get(source.id);
        if (!sourceList || sourceList.deleted_at || sourceList.household_id !== ctx.householdId) {
          throw new UserError("Lista nu mai există sau nu ai acces.");
        }

        await insertRow(
          ctx.db,
          "shopping_lists",
          {
            id: newListId,
            household_id: ctx.householdId,
            name: v.name,
            is_recurring: false,
            cycle: 1,
            archived_at: null,
            default_retailer_id: sourceList.default_retailer_id,
            sort_order: lists.length,
          },
          w(ctx),
        );

        const items = await listItems(ctx.db, source.id);
        for (const item of items) {
          if (item.household_id !== ctx.householdId || item.deleted_at) continue;
          await insertRow(
            ctx.db,
            "shopping_list_items",
            {
              id: newId(),
              household_id: ctx.householdId,
              list_id: newListId,
              product_id: item.product_id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category_id: item.category_id,
              estimated_price: item.estimated_price,
              actual_price: null,
              retailer_id: item.retailer_id,
              source: item.source,
              priority: item.priority ?? "normala",
              note: item.note,
              checked: false,
              checked_at: null,
              checked_by: null,
              origin: "recurent",
              sort_order: item.sort_order,
              ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            },
            w(ctx),
          );
        }
      } else {
        const tx = await ctx.db.shopping_transactions.get(source.id);
        if (!tx || tx.deleted_at || tx.household_id !== ctx.householdId) {
          throw new UserError("Cumpărătura nu mai există sau nu ai acces.");
        }

        await insertRow(
          ctx.db,
          "shopping_lists",
          {
            id: newListId,
            household_id: ctx.householdId,
            name: v.name,
            is_recurring: false,
            cycle: 1,
            archived_at: null,
            default_retailer_id: tx.retailer_id ?? null,
            sort_order: lists.length,
          },
          w(ctx),
        );

        const txItems = await ctx.db.shopping_transaction_items
          .where("transaction_id")
          .equals(source.id)
          .toArray();

        let order = 0;
        for (const item of txItems) {
          if (
            item.deleted_at ||
            item.household_id !== ctx.householdId ||
            item.category_id === "nealocat" ||
            item.name === "Diferență nealocată"
          ) {
            continue;
          }

          await insertRow(
            ctx.db,
            "shopping_list_items",
            {
              id: newId(),
              household_id: ctx.householdId,
              list_id: newListId,
              product_id: item.product_id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category_id: item.category_id,
              estimated_price: null,
              actual_price: null,
              retailer_id: item.retailer_id ?? tx.retailer_id ?? null,
              source: item.source ?? "supermarket",
              priority: "normala",
              note: null,
              checked: false,
              checked_at: null,
              checked_by: null,
              origin: "recurent",
              sort_order: order++,
              ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            },
            w(ctx),
          );
        }
      }

      return newListId;
    }
  );
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
export async function addItem(ctx: AppCtx, listId: string, input: ItemInput, opts: { merge?: boolean } = {}): Promise<string> {
  const v = parse(itemInput, input);
  const list = await ctx.db.shopping_lists.get(listId);
  if (!list || list.deleted_at || list.archived_at || list.household_id !== ctx.householdId) throw new UserError("Lista nu mai este disponibilă. Alege o listă activă.");
  const product = v.product_id ? await ctx.db.products.get(v.product_id) : undefined;
  if (v.product_id && !product) throw new UserError("Produsul nu există în catalog.");
  const name = v.name ?? product?.name;
  if (!name) throw new UserError("Scrie numele produsului.");
  const variant = await variantField(ctx, v.variant_id, product?.id ?? null);

  if (product && opts.merge !== false) {
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
  const v = parsePatch(itemInput, patch);
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
  // Debifat, produsul nu mai e cel de pe bon (.tasks/016).
  const fromReceipt = !checked && Boolean((await ctx.db.shopping_list_items.get(id))?.receipt_name);
  await updateRow(
    ctx.db,
    "shopping_list_items",
    id,
    checked ? { checked: true, checked_at: nowIso(), checked_by: ctx.userId } : { checked: false, checked_at: null, checked_by: null, ...(fromReceipt ? { receipt_name: null } : {}) },
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

/**
 * Pune în cămară un aliment cumpărat (id determinist după linia cumpărăturii),
 * cu ziua de la care se consideră consumat, după categorie (.tasks/016).
 */
export async function addPurchaseToPantry(
  ctx: AppCtx,
  txItemId: string,
  product: Product,
  line: { name: string; quantity: number | null; unit: UnitCode | null; purchased_at: string },
  precomputedId?: string,
  writeOptions = w(ctx),
): Promise<void> {
  if (line.quantity == null || line.unit == null) return;
  const purchasedOn = localDateOf(line.purchased_at);
  const consumeOn = autoConsumeOn(product.category_id, purchasedOn, CONSUME_DAYS);
  await upsertRow(
    ctx.db,
    "pantry_items",
    {
      id: precomputedId ?? (await stableId("camara", txItemId)),
      household_id: ctx.householdId,
      product_id: product.id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      location_id: isLeafyGreen(product.id) ? "frigider" : guessLocation(product.category_id),
      purchased_on: purchasedOn,
      expires_on: null,
      note: null,
      ...(consumeOn ? { auto_consume_on: consumeOn } : {}),
    },
    writeOptions,
  );
}

export interface FinalizeResult {
  transaction_id: string;
  attempt_id?: string;
  total: number;
  items: number;
  without_price: number;
  added_to_pantry: number;
  pending_pantry: number;
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
export async function finalizeShopping(ctx: AppCtx, listId: string, opts: { addToPantry: boolean; totalPaid?: number | null; retailerId?: string | null }): Promise<FinalizeResult> {
  if (opts.totalPaid != null) parse(zMoney, opts.totalPaid);
  if (opts.retailerId) {
    const place = await ctx.db.retailers.get(opts.retailerId);
    if (!place || place.deleted_at || (place.household_id !== null && place.household_id !== ctx.householdId)) throw new UserError("Locul nu este disponibil în această gospodărie.");
  }
  const list = await ctx.db.shopping_lists.get(listId);
  if (!list || list.deleted_at || list.household_id !== ctx.householdId || list.archived_at) throw new UserError("Lista nu mai există.");
  const allItems = await listItems(ctx.db, listId);
  const checked = allItems.filter((i) => i.checked);
  if (checked.length === 0) throw new UserError("Bifează întâi produsele pe care le-ai cumpărat.");
  const products = await productMap(ctx.db, ctx.householdId);
  const categories = new Map((await ctx.db.product_categories.toArray()).map((c) => [c.id, c]));

  const txId = await stableId("tura", listId, String(list.cycle));
  const checkoutWrites: RowWrite[] = [];
  const checkoutOptions: WriteOptions = { ...w(ctx), checkoutWrites };
  const attemptId = newId();
  const startedAt = checked.map((i) => i.checked_at ?? nowIso()).sort()[0];

  // Pre-calculăm toate id-urile stabile înainte de tranzacția Dexie
  const itemsData = await Promise.all(
    checked.map(async (item) => {
      const txItemId = await stableId("tura-produs", txId, item.id);
      const purchasedAt = item.checked_at ?? nowIso();
      let product = item.product_id ? products.get(item.product_id) : undefined;
      let createProduct = false;
      if (!product && !item.product_id && opts.addToPantry && item.quantity != null && item.unit != null && categories.get(item.category_id)?.is_food === true) {
        product = [...products.values()].find(p => normalize(p.name) === normalize(item.name));
        if (!product) {
          const id = await stableId("cumparat-produs", ctx.householdId, normalize(item.name));
          product = { id, household_id: ctx.householdId, name: item.name, category_id: item.category_id,
            default_unit: item.unit, subcategory: null, brand_id: null, ean: null, season_months: [], is_traditional: false,
            is_market_typical: item.source === "piata" || item.source === "producator", allergens: [], piece_grams: null, grams_per_ml: null,
            created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
          products.set(id, product); createProduct = true;
        }
      }
      const priceId = product && item.actual_price != null && item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0 && zUnit.safeParse(item.unit).success ? await stableId("pret", txItemId) : null;
      const pantryEligible = opts.addToPantry && categories.get(product?.category_id ?? item.category_id)?.is_food === true;
      const shouldAddToPantry = pantryEligible && product && item.quantity != null && item.unit != null;
      const pantryItemId = shouldAddToPantry ? await stableId("camara", txItemId) : null;
      return { item, txItemId, purchasedAt, product, priceId, shouldAddToPantry, pantryItemId, createProduct, pantryEligible };
    }),
  );

  let added = 0;

  // Tranzacție atomică pe toate tabelele: dacă o scriere eșuează sau este întreruptă,
  // baza de date și outbox-ul fac rollback complet, fără stări parțiale (F06).
  await ctx.db.transaction(
    "rw",
    [
      ctx.db.products,
      ctx.db.shopping_transactions,
      ctx.db.shopping_transaction_items,
      ctx.db.product_prices,
      ctx.db.pantry_items,
      ctx.db.shopping_lists,
      ctx.db.shopping_list_items,
      ctx.db.outbox,
    ],
    async () => {
      const current = await ctx.db.shopping_lists.get(listId);
      if (!current || current.deleted_at || current.archived_at || current.cycle !== list.cycle || await ctx.db.shopping_transactions.get(txId)) throw new UserError("Tura a fost deja finalizată.");
      if (ctx.sync) {
        // Bifările netrimise fac parte din plata de pe acest dispozitiv.
        for (const item of checked) {
          const pending = await ctx.db.outbox.where("[table+row_id]").equals(["shopping_list_items", item.id]).toArray();
          for (const entry of pending) {
            const payload = { ...entry.payload };
            for (const field of ["checked", "checked_at", "checked_by", "actual_price"]) delete payload[field];
            if (Object.keys(payload).length) await ctx.db.outbox.update(entry.seq!, { payload });
            else await ctx.db.outbox.delete(entry.seq!);
          }
        }
      }
      await upsertRow(
        ctx.db,
        "shopping_transactions",
        { id: txId, household_id: ctx.householdId, list_id: listId, list_cycle: list.cycle, started_at: startedAt, completed_at: nowIso(), note: null, ...(opts.totalPaid != null ? { declared_total: opts.totalPaid } : {}), ...(opts.retailerId ? { retailer_id: opts.retailerId } : {}) },
        checkoutOptions,
      );

      for (const d of itemsData) {
        if (d.createProduct && d.product) await upsertRow(ctx.db, "products", d.product, checkoutOptions);
        await upsertRow(
          ctx.db,
          "shopping_transaction_items",
          {
            id: d.txItemId,
            household_id: ctx.householdId,
            transaction_id: txId,
            list_item_id: d.item.id,
            product_id: d.product?.id ?? d.item.product_id,
            name: d.item.name,
            quantity: d.item.quantity,
            unit: d.item.unit,
            category_id: d.item.category_id,
            amount: d.item.actual_price,
            retailer_id: d.item.retailer_id ?? opts.retailerId ?? null,
            source: d.item.source,
            purchased_at: d.purchasedAt,
            ...(d.item.variant_id ? { variant_id: d.item.variant_id } : {}),
            ...(d.item.receipt_name ? { receipt_name: d.item.receipt_name } : {}),
          },
          checkoutOptions,
        );

        if (d.product && d.priceId && d.item.actual_price != null) {
          await upsertRow(
            ctx.db,
            "product_prices",
            {
              id: d.priceId,
              household_id: ctx.householdId,
              product_id: d.product.id,
              retailer_id: d.item.retailer_id ?? opts.retailerId ?? null,
              source: d.item.source,
              amount: d.item.actual_price,
              currency: "RON",
              quantity: d.item.quantity!,
              unit: d.item.unit!,
              price_type: "platit",
              confidence: "ridicata",
              observed_on: localDateOf(d.purchasedAt),
              transaction_item_id: d.txItemId,
              ...(d.item.variant_id ? { variant_id: d.item.variant_id } : {}),
            },
            checkoutOptions,
          );
        }

        if (d.shouldAddToPantry && d.product && d.pantryItemId) {
          await addPurchaseToPantry(
            ctx,
            d.txItemId,
            d.product,
            { name: d.item.receipt_name || d.item.name, quantity: d.item.quantity, unit: d.item.unit, purchased_at: d.purchasedAt },
            d.pantryItemId,
            checkoutOptions,
          );
          added++;
        }
      }

      await updateRow(ctx.db, "shopping_lists", listId, list.is_recurring || allItems.some(i => !i.checked) ? { cycle: list.cycle + 1 } : { cycle: list.cycle + 1, archived_at: nowIso() }, checkoutOptions);
      if (list.is_recurring) {
        for (const item of checked) {
          await updateRow(ctx.db, "shopping_list_items", item.id, { checked: false, checked_at: null, checked_by: null, actual_price: null, ...(item.receipt_name ? { receipt_name: null } : {}) }, checkoutOptions);
        }
      } else if (allItems.some(i => !i.checked)) {
        for (const item of checked) await softDelete(ctx.db, "shopping_list_items", item.id, checkoutOptions);
      } else if (ctx.sync) {
        for (const item of checked) checkoutWrites.push({
          table: "shopping_list_items", row_id: item.id, op: "update",
          payload: { checked: true, checked_at: item.checked_at, checked_by: item.checked_by, actual_price: item.actual_price },
        });
      }
      if (ctx.sync) {
        await ctx.db.shopping_transactions.update(txId, { checkout_attempt_id: attemptId });
        await ctx.db.outbox.add({
          table: "shopping_transactions", row_id: txId, op: "insert",
          payload: { household_id: ctx.householdId }, attempts: 0, created_at: nowIso(),
          checkout: { attemptId, householdId: ctx.householdId, listId, cycle: list.cycle, writes: checkoutWrites },
        });
      }
    },
  );

  return {
    transaction_id: txId,
    ...(ctx.sync ? { attempt_id: attemptId } : {}),
    total: opts.totalPaid ?? sumMoney(checked.map((i) => i.actual_price ?? 0)),
    items: checked.length,
    without_price: checked.filter((i) => i.actual_price == null).length,
    added_to_pantry: added,
    pending_pantry: itemsData.filter(d => d.pantryEligible && !d.shouldAddToPantry).length,
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
  const priceId = await stableId("pret", id);
  if (amount == null || item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0 || !zUnit.safeParse(item.unit).success) {
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
      quantity: item.quantity,
      unit: item.unit!,
      price_type: "platit",
      confidence: "ridicata",
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
