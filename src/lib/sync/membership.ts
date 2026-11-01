import type { CamaraDB } from "@/lib/db/database";
import { purgeHouseholdData, resetPullCursors } from "@/lib/db/database";

export interface ReconcileResult {
  added: string[];
  revoked: string[];
}

/**
 * Reconciliază apartenența la gospodării (F02 & F03):
 * 1. Dacă au apărut gospodării noi, resetează cursorii de pull (F02) pentru a asigura
 *    descărcarea completă a istoricului acestora.
 * 2. Dacă au fost revocate gospodării, curăță datele locale asociate din Dexie (F03).
 * 3. Actualizează lista de ID-uri cunoscute în meta (`synced_household_ids`).
 */
export async function reconcileHouseholds(
  db: CamaraDB,
  currentHouseholdIds: string[],
): Promise<ReconcileResult> {
  const known = (await db.meta.get("synced_household_ids"))?.value as string[] | undefined;
  const currentSet = new Set(currentHouseholdIds);
  const result: ReconcileResult = { added: [], revoked: [] };

  if (known) {
    const knownSet = new Set(known);
    for (const id of currentHouseholdIds) {
      if (!knownSet.has(id)) result.added.push(id);
    }
    for (const id of known) {
      if (!currentSet.has(id)) result.revoked.push(id);
    }

    if (result.added.length > 0) {
      await resetPullCursors(db);
    }

    for (const revokedId of result.revoked) {
      await purgeHouseholdData(db, revokedId);
    }
  }

  await db.meta.put({ key: "synced_household_ids", value: currentHouseholdIds });
  return result;
}
