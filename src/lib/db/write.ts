import type { CamaraDB, OutboxEntry, SyncedTables, TableName } from "./database";
import { nowIso } from "@/lib/clock";

// Toate scrierile locale trec pe aici: rândul se modifică în IndexedDB și,
// în aceeași tranzacție, se adaugă o intrare în outbox, pe care motorul de
// sincronizare o trimite la server când există conexiune. Așa nicio
// modificare făcută offline nu se pierde.

type Row<T extends TableName> = SyncedTables[T];
type NewRow<T extends TableName> = Omit<Row<T>, "created_at" | "updated_at" | "deleted_at"> & Partial<Pick<Row<T>, "deleted_at">>;

/** Dacă e false (mod demonstrativ), nu se mai adaugă nimic în outbox. */
export interface WriteOptions {
  outbox: boolean;
}

async function enqueue(db: CamaraDB, entry: Omit<OutboxEntry, "seq" | "attempts" | "created_at">): Promise<void> {
  // Comasăm cu intrarea neconfirmată a aceluiași rând: mai puține cereri și
  // ordinea logică păstrată (inserarea rămâne inserare).
  const pending = await db.outbox.where("[table+row_id]").equals([entry.table, entry.row_id]).last();
  if (pending && pending.attempts === 0) {
    await db.outbox.update(pending.seq!, { payload: { ...pending.payload, ...entry.payload } });
    return;
  }
  await db.outbox.add({ ...entry, created_at: nowIso(), attempts: 0 });
}

export async function insertRow<T extends TableName>(db: CamaraDB, table: T, row: NewRow<T>, opts: WriteOptions): Promise<Row<T>> {
  const ts = nowIso();
  const full = { deleted_at: null, ...row, created_at: ts, updated_at: ts } as Row<T>;
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    await db.table(table).put(full);
    if (opts.outbox) await enqueue(db, { table, row_id: full.id, op: "insert", payload: stripTimestamps(full as unknown as Record<string, unknown>) });
  });
  return full;
}

/** Inserează sau, dacă rândul există deja (id determinist), îl actualizează. */
export async function upsertRow<T extends TableName>(db: CamaraDB, table: T, row: NewRow<T>, opts: WriteOptions): Promise<Row<T>> {
  const existing = (await db.table(table).get(row.id)) as Row<T> | undefined;
  if (!existing) return insertRow(db, table, row, opts);
  const { id, ...patch } = row;
  await updateRow(db, table, id, { ...patch, deleted_at: null } as Partial<Row<T>>, opts);
  return (await db.table(table).get(id)) as Row<T>;
}

export async function updateRow<T extends TableName>(db: CamaraDB, table: T, id: string, patch: Partial<Row<T>>, opts: WriteOptions): Promise<void> {
  const clean = stripTimestamps(patch as Record<string, unknown>);
  delete clean.id;
  delete clean.household_id;
  if (Object.keys(clean).length === 0) return;
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    const existing = await db.table(table).get(id);
    if (!existing) throw new Error(`Rândul ${table}/${id} nu există`);
    await db.table(table).put({ ...existing, ...clean, updated_at: nowIso() });
    if (opts.outbox) await enqueue(db, { table, row_id: id, op: "update", payload: clean });
  });
}

export async function softDelete(db: CamaraDB, table: TableName, id: string, opts: WriteOptions): Promise<void> {
  await updateRow(db, table, id, { deleted_at: nowIso() } as never, opts);
}

function stripTimestamps(row: Record<string, unknown>): Record<string, unknown> {
  const { created_at: _c, updated_at: _u, ...rest } = row;
  void _c;
  void _u;
  return rest;
}

/**
 * Aplică rândurile venite de la server. Dacă un rând are modificări locale
 * încă netrimise, acestea se reaplică peste versiunea serverului, ca
 * utilizatorul să nu-și vadă modificările dispărând până la trimitere.
 */
export async function applyRemoteRows(db: CamaraDB, table: TableName, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    const pending = (await db.outbox.toArray()).filter((e) => e.table === table);
    const byRow = new Map<string, Record<string, unknown>>();
    for (const e of pending) byRow.set(e.row_id, { ...(byRow.get(e.row_id) ?? {}), ...e.payload });
    // Rândurile pe care le avem deja în aceeași versiune nu se rescriu
    // (fără re-randări inutile când fereastra de sincronizare le re-citește).
    const local = await db.table(table).bulkGet(rows.map((r) => r.id as string));
    const changed = rows.filter((r, i) => byRow.has(r.id as string) || local[i]?.updated_at !== r.updated_at);
    const merged = changed.map((r) => normalizeRemote(table, byRow.has(r.id as string) ? { ...r, ...byRow.get(r.id as string) } : r));
    if (merged.length > 0) await db.table(table).bulkPut(merged);
  });
}

// Postgres întoarce numeric ca string și date ca „2026-10-11”; aducem
// valorile la tipurile folosite în aplicație.
const NUMERIC_FIELDS = new Set(["quantity", "estimated_price", "actual_price", "amount", "sort_order", "servings", "prep_minutes", "cook_minutes", "position", "cycle", "list_cycle", "piece_grams", "grams_per_ml", "net_quantity"]);

export function normalizeRemote(_table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (NUMERIC_FIELDS.has(k) && typeof v === "string") out[k] = Number(v);
  }
  return out;
}
