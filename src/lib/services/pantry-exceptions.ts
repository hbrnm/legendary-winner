import { updateRow } from "@/lib/db/write";
import { type AppCtx, UserError, w } from "./context";
import { addItem, createList } from "./shopping";
import { owned } from "./queries";

/** Stock correction and replenishment are one local transaction, including sync writes. */
export async function finishPantryToList(ctx: AppCtx, itemId: string, listId?: string): Promise<string> {
  return ctx.db.transaction("rw", [ctx.db.pantry_items, ctx.db.shopping_lists, ctx.db.shopping_list_items, ctx.db.products, ctx.db.product_variants, ctx.db.outbox], async () => {
    const item = await ctx.db.pantry_items.get(itemId);
    if (!item || item.deleted_at || item.household_id !== ctx.householdId) throw new UserError("Produsul nu mai există în cămara ta.");
    let target = listId ? await ctx.db.shopping_lists.get(listId) : (await owned(ctx.db, "shopping_lists", ctx.householdId)).find((l) => !l.archived_at);
    if (listId && (!target || target.deleted_at || target.archived_at || target.household_id !== ctx.householdId)) throw new UserError("Lista aleasă nu mai este activă.");
    if (!target) target = await ctx.db.shopping_lists.get(await createList(ctx, { name: "Cumpărături" }));
    await updateRow(ctx.db, "pantry_items", item.id, { quantity: 0 }, w(ctx));
    const existing = await ctx.db.shopping_list_items.where("list_id").equals(target!.id).toArray();
    if (!existing.some((line) => !line.deleted_at && !line.checked && (item.product_id ? line.product_id === item.product_id : !line.product_id && line.name.toLocaleLowerCase("ro") === item.name.toLocaleLowerCase("ro")))) {
      await addItem(ctx, target!.id, { product_id: item.product_id, name: item.name, quantity: null, unit: null });
    }
    return target!.id;
  });
}
