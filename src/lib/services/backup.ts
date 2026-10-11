import { SYNCED_TABLES } from "@/lib/db/database";
import type { AppCtx } from "./context";
import { nowIso } from "@/lib/clock";

/**
 * Copie de siguranță a datelor gospodăriei (fără catalogul comun), ca fișier
 * JSON pe care utilizatorul îl păstrează. Include și rândurile șterse logic,
 * ca istoricul să fie complet.
 */
export async function exportHouseholdData(ctx: AppCtx): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNCED_TABLES) {
    const rows = await ctx.db.table(t).where("household_id").equals(ctx.householdId).toArray();
    if (rows.length) tables[t] = rows;
  }
  return JSON.stringify({ format: "camara-export", version: 1, exported_at: nowIso(), household_id: ctx.householdId, tables }, null, 2);
}
