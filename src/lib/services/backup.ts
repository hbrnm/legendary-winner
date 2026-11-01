import { z } from "zod";
import { SYNCED_TABLES, type TableName } from "@/lib/db/database";
import { insertRow, updateRow } from "@/lib/db/write";
import { stableId } from "@/lib/db/ids";
import { UserError, w, type AppCtx } from "./context";
import { nowIso } from "@/lib/clock";

const budgetScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("total") }),
  z.object({ kind: z.literal("alimente") }),
  z.object({ kind: z.literal("nealimentare") }),
  z.object({ kind: z.literal("sursa"), source: z.string() }),
  z.object({ kind: z.literal("categorie"), category_id: z.string().min(1) }),
  z.object({ kind: z.literal("magazin"), retailer_id: z.string().min(1) }),
]);

const TABLE_SCHEMAS: Partial<Record<TableName, z.ZodTypeAny>> = {
  budgets: z.object({
    name: z.string().min(1),
    period: z.enum(["lunar", "saptamanal"]),
    scope: budgetScopeSchema,
    amount: z.number().positive(),
  }),
  shopping_lists: z.object({
    name: z.string().min(1),
  }),
  shopping_list_items: z.object({
    list_id: z.string().min(1),
    name: z.string().min(1),
  }),
  shopping_transactions: z.object({
    started_at: z.string().min(1),
  }),
  shopping_transaction_items: z.object({
    transaction_id: z.string().min(1),
    name: z.string().min(1),
  }),
  pantry_items: z.object({
    name: z.string().min(1),
    quantity: z.number().min(0),
  }),
  household_settings: z.object({
    pantry_on_purchase: z.enum(["intreaba", "mereu", "niciodata"]).optional(),
  }),
  favorite_recipes: z.object({
    recipe_id: z.string().min(1),
  }),
};

function validateRow(table: TableName, row: Row): void {
  const schema = TABLE_SCHEMAS[table];
  if (!schema) return;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new UserError(`Datele din tabela ${table} nu sunt valide (${result.error.issues[0]?.message ?? "format incorect"}).`);
  }
}

/**
 * Copie de siguranță a datelor gospodăriei (fără catalogul comun), ca fișier
 * JSON pe care utilizatorul îl păstrează. Include și rândurile șterse logic,
 * ca istoricul să fie complet. Fotografiile gospodăriei intră doar ca rânduri
 * (calea din Storage), fără fișiere, și nu se readuc la import.
 */
export async function exportHouseholdData(ctx: AppCtx): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNCED_TABLES) {
    const rows = await ctx.db.table(t).where("household_id").equals(ctx.householdId).toArray();
    if (rows.length) tables[t] = rows;
  }
  return JSON.stringify({ format: "camara-export", version: 1, exported_at: nowIso(), household_id: ctx.householdId, tables }, null, 2);
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
}

type Row = Record<string, unknown> & { id: string; updated_at?: string };

const NOT_A_BACKUP = "Fișierul nu este o copie Cămara. Alege fișierul descărcat cu „Descarcă datele”.";

function parseBackup(json: string): { householdId: string; tables: Partial<Record<TableName, Row[]>> } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new UserError(NOT_A_BACKUP);
  }
  const d = data as { format?: unknown; version?: unknown; household_id?: unknown; tables?: unknown };
  if (!d || d.format !== "camara-export" || typeof d.household_id !== "string" || typeof d.tables !== "object" || d.tables === null) throw new UserError(NOT_A_BACKUP);
  if (d.version !== 1) throw new UserError("Copia e făcută cu o versiune mai nouă a aplicației. Actualizează aplicația și încearcă din nou.");
  const tables: Partial<Record<TableName, Row[]>> = {};
  for (const t of SYNCED_TABLES) {
    const rows = (d.tables as Record<string, unknown>)[t];
    if (!Array.isArray(rows)) continue;
    const validRows: Row[] = [];
    for (const r of rows) {
      if (!r || typeof r !== "object" || typeof (r as Row).id !== "string" || (r as Row).household_id !== d.household_id) {
        continue;
      }
      validateRow(t, r as Row);
      validRows.push(r as Row);
    }
    tables[t] = validRows;
  }
  return { householdId: d.household_id, tables };
}

/**
 * Readuce datele dintr-o copie de siguranță în gospodăria activă, fără să
 * șteargă nimic: rândurile lipsă se adaugă, iar cele existente se
 * actualizează doar dacă versiunea din copie e mai nouă.
 *
 * O copie din altă gospodărie primește id-uri noi, derivate din cele vechi,
 * cu legăturile dintre rânduri păstrate; același fișier importat de două ori
 * nu face dubluri.
 */
export async function importHouseholdData(ctx: AppCtx, json: string): Promise<ImportResult> {
  const backup = parseBackup(json);
  const same = backup.householdId === ctx.householdId;
  const ids = new Map<string, string>([[backup.householdId, ctx.householdId]]);

  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 };
  const touchedTables = SYNCED_TABLES.filter((t) => t !== "recipe_photos" && (backup.tables[t]?.length ?? 0) > 0);
  if (touchedTables.length === 0) return result;

  type PreparedOp =
    | { kind: "insert"; table: TableName; row: Row }
    | { kind: "update"; table: TableName; id: string; patch: Record<string, unknown> }
    | { kind: "unchanged" };

  const ops: PreparedOp[] = [];

  // Ordinea din SYNCED_TABLES aduce părinții înaintea copiilor, deci id-urile
  // noi ale părinților sunt cunoscute când ajungem la copii.
  for (const t of touchedTables) {
    for (const original of backup.tables[t] ?? []) {
      const { created_at: _c, updated_at: backupUpdatedAt, ...fields } = original;
      void _c;
      const row = same ? (fields as Row) : await moveToHousehold(ctx, t, fields as Row, ids);
      const local = (await ctx.db.table(t).get(row.id)) as Row | undefined;
      if (!local) {
        ops.push({ kind: "insert", table: t, row });
      } else {
        const newer = same && local.household_id === ctx.householdId && typeof backupUpdatedAt === "string" && !!local.updated_at && Date.parse(backupUpdatedAt) > Date.parse(local.updated_at);
        const patch = Object.fromEntries(Object.entries(row).filter(([k, v]) => JSON.stringify(local[k]) !== JSON.stringify(v)));
        if (newer && Object.keys(patch).length > 0) {
          ops.push({ kind: "update", table: t, id: row.id, patch });
        } else {
          ops.push({ kind: "unchanged" });
        }
      }
    }
  }

  // Toate scrierile se execută într-o singură tranzacție atomică Dexie (F08).
  await ctx.db.transaction("rw", [...touchedTables.map((t) => ctx.db.table(t)), ctx.db.outbox], async () => {
    for (const op of ops) {
      if (op.kind === "insert") {
        await insertRow(ctx.db, op.table, op.row as never, w(ctx));
        result.added++;
      } else if (op.kind === "update") {
        await updateRow(ctx.db, op.table, op.id, op.patch as never, w(ctx));
        result.updated++;
      } else {
        result.unchanged++;
      }
    }
  });

  return result;
}

/**
 * Mută un rând din copia altei gospodării în gospodăria activă: legăturile
 * (`*_id`) spre rândurile din copie primesc id-urile noi, iar rândurile cu
 * id determinist își păstrează regula (ca în serviciile care le creează),
 * ca să nu încalce unicitatea de pe server.
 */
async function moveToHousehold(ctx: AppCtx, t: TableName, r: Row, ids: Map<string, string>): Promise<Row> {
  const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k.endsWith("_id") && typeof v === "string" && ids.has(v) ? ids.get(v)! : v])) as Row;
  const s = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : null);
  let id: string;
  if (t === "household_settings") id = ctx.householdId;
  else if (t === "favorite_recipes") id = await stableId("favorit", ctx.householdId, s("recipe_id") ?? r.id);
  else if (t === "shopping_transactions" && s("list_id")) id = await stableId("tura", s("list_id")!, String(row.list_cycle));
  else if (t === "shopping_transaction_items" && s("list_item_id")) id = await stableId("tura-produs", s("transaction_id")!, s("list_item_id")!);
  else if (t === "product_prices" && s("transaction_item_id")) id = await stableId("pret", s("transaction_item_id")!);
  else if (t === "receipt_aliases" && s("receipt_text")) id = await stableId("bon-alias", ctx.householdId, s("retailer_id") ?? "", s("receipt_text")!);
  else id = await stableId("import", ctx.householdId, r.id);
  ids.set(r.id, id);
  return { ...row, id };
}
