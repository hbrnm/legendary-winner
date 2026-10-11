import type { CamaraDB, SyncedTables, TableName } from "@/lib/db/database";
import type { Product, ShoppingListItem, ShoppingTransactionItem } from "@/lib/domain/types";
import { buildPriceIndex, type PriceIndex } from "@/lib/domain/pricing";

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
  return buildPriceIndex(await owned(db, "product_prices", householdId));
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
export async function spendRecords(db: CamaraDB, householdId: string): Promise<ShoppingTransactionItem[]> {
  const finalized = await owned(db, "shopping_transaction_items", householdId);
  const transactions = new Map((await owned(db, "shopping_transactions", householdId)).map((t) => [t.id, t]));
  const done = finalized.filter((i) => transactions.has(i.transaction_id));
  const openLists = (await owned(db, "shopping_lists", householdId)).filter((l) => !l.archived_at);
  const pending: ShoppingTransactionItem[] = [];
  for (const list of openLists) {
    for (const item of await listItems(db, list.id)) {
      if (!item.checked) continue;
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
      });
    }
  }
  return [...done, ...pending];
}
