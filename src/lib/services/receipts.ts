import { upsertRow } from "@/lib/db/write";
import { stableId } from "@/lib/db/ids";
import { receiptKey, proposeMatch, type MatchProposal } from "@/lib/domain/receipt-match";
import { type AppCtx, UserError, w } from "./context";
import { owned } from "./queries";
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
  const [aliases, index] = await Promise.all([owned(ctx.db, "receipt_aliases", ctx.householdId), productSearchIndex(ctx)]);
  return names.map((n) => (n ? proposeMatch(n, retailerId, aliases, index) : null));
}
