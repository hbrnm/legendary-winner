import type { CamaraDB, SyncedTables, TableName } from "@/lib/db/database";
import type { Product, ShoppingListItem, ShoppingTransactionItem, SpendRecord } from "@/lib/domain/types";
import { roundMoney, sumMoney } from "@/lib/domain/money";
import { manualExpenseRecord } from "@/lib/domain/budget";
import { buildPriceIndex, type PriceIndex } from "@/lib/domain/pricing";
import { productUnitsOf } from "@/lib/domain/quantities";

/** Rândurile vizibile gospodăriei: cele globale și ale ei, fără cele șterse. */
export async function visible<T extends TableName>(db: CamaraDB, table: T, householdId: string): Promise<SyncedTables[T][]> {
  const t = db.table(table);
  const rows = (await t.toArray()) as SyncedTables[T][];
  return rows.filter((r) => !r.deleted_at && (r.household_id === null || r.household_id === householdId));
}

/** Doar rândurile gospodăriei (fără catalogul global). */
export async function owned<T extends TableName>(db: CamaraDB, table: T, householdId: string): Promise<SyncedTables[T][]> {
  const rows = (await db.table(table).where("household_id").equals(householdId).toArray()) as SyncedTables[T][];
  return rows.filter((r) => !r.deleted_at);
}

export async function productMap(db: CamaraDB, householdId: string): Promise<Map<string, Product>> {
  return new Map((await visible(db, "products", householdId)).map((p) => [p.id, p]));
}

export async function priceIndex(db: CamaraDB, householdId: string): Promise<PriceIndex> {
  const [prices, products, variants] = await Promise.all([
    owned(db, "product_prices", householdId),
    visible(db, "products", householdId),
    visible(db, "product_variants", householdId),
  ]);
  return buildPriceIndex(prices, productUnitsOf(products), new Map(variants.map((v) => [v.id, v])));
}

export async function listItems(db: CamaraDB, listId: string): Promise<ShoppingListItem[]> {
  return (await db.shopping_list_items.where("list_id").equals(listId).toArray()).filter((i) => !i.deleted_at);
}

/**
 * Toate cheltuielile reale ale gospodăriei, în forma liniilor de tranzacție:
 * cumpărăturile finalizate plus produsele bifate, cu sumă, din listele încă
 * deschise (ca bugetul să se actualizeze chiar în magazin). Fiecare produs
 * apare o singură dată: după finalizare, lista se arhivează sau se golește
 * de bifări, deci nu mai e numărat ca „în curs”.
 */
export async function spendRecords(db: CamaraDB, householdId: string): Promise<SpendRecord[]> {
  const [finalized, transactionsList, openLists] = await Promise.all([
    owned(db, "shopping_transaction_items", householdId),
    owned(db, "shopping_transactions", householdId),
    owned(db, "shopping_lists", householdId),
  ]);
  const transactions = new Map(transactionsList.map((t) => [t.id, t]));
  // Finalized lines and the authoritative-total delta share the trip date.
  // Keep original row/price observation timestamps intact in storage.
  const done = finalized.filter((i) => transactions.has(i.transaction_id)).map(i => ({ ...i, purchased_at: transactions.get(i.transaction_id)?.completed_at ?? i.purchased_at }));
  const activeLists = openLists.filter((l) => !l.archived_at);

  const listLastCompleted = new Map<string, string>();
  for (const t of transactionsList) {
    if (t.list_id && t.completed_at) {
      const prev = listLastCompleted.get(t.list_id);
      if (!prev || t.completed_at > prev) {
        listLastCompleted.set(t.list_id, t.completed_at);
      }
    }
  }

  const itemsPerList = await Promise.all(activeLists.map((l) => listItems(db, l.id)));
  const pending: ShoppingTransactionItem[] = [];
  for (let idx = 0; idx < activeLists.length; idx++) {
    const list = activeLists[idx];
    const items = itemsPerList[idx];
    const lastDoneAt = listLastCompleted.get(list.id);
    for (const item of items) {
      if (!item.checked) continue;
      // Prevenire F05: dacă bifarea a avut loc înainte de finalizarea turei anterioare a listei,
      // produsul este deja inclus în tranzacția înregistrată și nu trebuie numărat dublu ca „în curs”.
      if (lastDoneAt && item.checked_at && item.checked_at <= lastDoneAt && done.some(d => d.list_item_id === item.id && transactions.get(d.transaction_id)?.list_cycle === list.cycle)) continue;
      pending.push({
        id: `in-curs:${item.id}`,
        household_id: householdId,
        created_at: item.created_at,
        updated_at: item.updated_at,
        deleted_at: null,
        transaction_id: `in-curs:${list.id}`,
        list_item_id: item.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category_id: item.category_id,
        amount: item.actual_price,
        retailer_id: item.retailer_id,
        source: item.source,
        purchased_at: item.checked_at ?? item.updated_at,
        variant_id: item.variant_id ?? null,
      });
    }
  }
  const adjustments: SpendRecord[] = [];
  for (const t of transactionsList) {
    if (t.declared_total == null || !t.completed_at) continue;
    const delta = roundMoney(t.declared_total - sumMoney(done.filter(i => i.transaction_id === t.id).map(i => i.amount ?? 0)));
    if (delta === 0) continue;
    adjustments.push({ ...t, id: `nealocat:${t.id}`, transaction_id: t.id, list_item_id: null, product_id: null,
      name: "Diferență nealocată", quantity: null, unit: null, category_id: "nealocat", amount: delta,
      retailer_id: t.retailer_id ?? null, source: "alta", purchased_at: t.completed_at, unallocated: true });
  }
  return [...done, ...pending, ...adjustments];
}

/** Totalul familiei; plățile manuale sunt proiectate numai la citire. */
export async function householdSpendRecords(db: CamaraDB, householdId: string): Promise<SpendRecord[]> {
  const [shopping, manual] = await Promise.all([spendRecords(db, householdId), owned(db, "manual_expenses", householdId)]);
  return [...shopping, ...manual.map(manualExpenseRecord)];
}
