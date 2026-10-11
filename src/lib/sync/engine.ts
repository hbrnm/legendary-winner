import type { CamaraDB, TableName } from "@/lib/db/database";
import { SYNCED_TABLES, getMeta, setMeta } from "@/lib/db/database";
import { applyRemoteRows, normalizeRemote } from "@/lib/db/write";
import { nowIso } from "@/lib/clock";
import { RemoteRejected, RemoteUnavailable, type PullFrom, type RemoteStore } from "./remote";

export type SyncState = "inactiv" | "sincronizare" | "sincronizat" | "offline" | "eroare";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  last_synced_at: string | null;
  last_error: string | null;
  rejected: number;
}

/** Ultimul rând citit dintr-un tabel și ora stabilă de la acea tragere. */
interface PullCursor {
  updated_at: string;
  id: string | null;
  stable: string | null;
}

export interface SyncOptions {
  /** Cât re-citim înapoi de la cursor, pentru tranzacțiile confirmate în altă ordine. */
  overlapMs?: number;
  pageSize?: number;
}

/**
 * Sincronizarea dintre IndexedDB și Supabase.
 *
 * Trimitere: intrările din outbox pleacă în ordinea în care au fost create.
 * O inserare devine upsert (sigur la reîncercare), o modificare devine un
 * UPDATE doar pe câmpurile schimbate — așa, doi membri care modifică
 * câmpuri diferite ale aceluiași produs nu își suprascriu munca. Pe același
 * câmp câștigă ultima modificare ajunsă la server.
 *
 * Tragere: pentru fiecare tabel, rândurile de după cursorul local, perechea
 * (updated_at, id) a ultimului rând citit. Modificările locale netrimise se
 * reaplică peste ele.
 *
 * O tranzacție începută mai devreme poate fi confirmată după ce am citit
 * rânduri mai noi, așa că re-citim rândurile încă „recente”: cele cu
 * updated_at după ora serverului de la tragerea trecută minus overlapMs.
 * Rândurile mai vechi erau deja confirmate și nu se mai cer din nou.
 */
export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerun = false;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { state: "inactiv", pending: 0, last_synced_at: null, last_error: null, rejected: 0 };
  private overlapMs: number;
  private pageSize: number;

  constructor(
    private db: CamaraDB,
    private remote: RemoteStore,
    opts: SyncOptions = {},
  ) {
    this.overlapMs = opts.overlapMs ?? 30_000;
    this.pageSize = opts.pageSize ?? 500;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatus(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private async setStatus(patch: Partial<SyncStatus>) {
    const pending = await this.db.outbox.count();
    const rejected = await this.db.sync_errors.count();
    this.status = { ...this.status, ...patch, pending, rejected };
    for (const l of this.listeners) l(this.status);
  }

  /** Trimite și trage. Apelurile simultane se comasează într-o singură rulare în plus. */
  syncNow(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.rerun = false;
          await this.setStatus({ state: "sincronizare" });
          await this.push();
          await this.pull();
          await this.setStatus({ state: "sincronizat", last_synced_at: nowIso(), last_error: null });
        } while (this.rerun);
      } catch (e) {
        if (e instanceof RemoteUnavailable) await this.setStatus({ state: "offline", last_error: e.message });
        else await this.setStatus({ state: "eroare", last_error: e instanceof Error ? e.message : String(e) });
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  async push(): Promise<void> {
    for (;;) {
      const entry = await this.db.outbox.orderBy("seq").first();
      if (!entry) return;
      // Marcăm intrarea ca „în zbor”, ca scrierile noi să nu se comaseze în ea.
      await this.db.outbox.update(entry.seq!, { attempts: entry.attempts + 1 });
      try {
        if (entry.op === "insert") {
          await this.remote.upsert(entry.table, entry.payload);
        } else {
          const ok = await this.remote.update(entry.table, entry.row_id, entry.payload);
          if (!ok) throw new RemoteRejected("Rândul nu mai există pe server sau nu poate fi modificat");
        }
        await this.db.outbox.delete(entry.seq!);
      } catch (e) {
        if (e instanceof RemoteRejected) {
          await this.reject(entry.table, entry.row_id, entry.op, e.message);
          await this.db.outbox.delete(entry.seq!);
          continue;
        }
        if (e instanceof RemoteUnavailable) throw e;
        throw new RemoteUnavailable(e instanceof Error ? e.message : String(e));
      }
    }
  }

  /** Serverul a refuzat o modificare: o notăm și readucem rândul la versiunea serverului. */
  private async reject(table: TableName, rowId: string, op: "insert" | "update", message: string) {
    await this.db.sync_errors.add({ table, row_id: rowId, op, message, at: nowIso() });
    // Modificările ulterioare ale aceluiași rând depind de cea refuzată.
    const dependent = (await this.db.outbox.toArray()).filter((e) => e.table === table && e.row_id === rowId);
    await this.db.outbox.bulkDelete(dependent.map((e) => e.seq!));
    const serverRow = await this.remote.fetchRow(table, rowId).catch(() => null);
    if (serverRow) await this.db.table(table).put(normalizeRemote(table, serverRow));
    else await this.db.table(table).delete(rowId);
  }

  async pull(): Promise<void> {
    // Ora serverului înainte de prima pagină: tot ce e mai vechi decât ea
    // minus fereastra era confirmat când am citit. Fără ea (funcția încă
    // lipsește de pe server), re-citim fereastra de la cursor, ca înainte.
    const now = await this.remote.serverNow().catch((e) => {
      if (e instanceof RemoteRejected && e.code === "PGRST202") return null;
      throw e;
    });
    const stable = now ? new Date(Date.parse(now) - this.overlapMs).toISOString() : null;
    for (const table of SYNCED_TABLES) {
      const cursorKey = `cursor:${table}`;
      const saved = (await getMeta<PullCursor | string>(this.db, cursorKey)) ?? null;
      // Cursorul vechi era doar updated_at, fără ora serverului.
      const cursor: PullCursor | null = typeof saved === "string" ? { updated_at: saved, id: null, stable: null } : saved;
      let from: PullFrom | null = null;
      if (cursor?.id != null && cursor.stable && Date.parse(cursor.updated_at) < Date.parse(cursor.stable)) {
        from = { updated_at: cursor.updated_at, id: cursor.id };
      } else if (cursor) {
        const back = cursor.stable ?? new Date(Date.parse(cursor.updated_at) - this.overlapMs).toISOString();
        from = { updated_at: Date.parse(back) < Date.parse(cursor.updated_at) ? back : cursor.updated_at };
      }
      let last = cursor;
      for (;;) {
        const rows = await this.remote.pull(table, from, this.pageSize);
        if (rows.length === 0) break;
        await applyRemoteRows(this.db, table, rows);
        const r = rows[rows.length - 1];
        last = { updated_at: r.updated_at, id: r.id, stable };
        if (rows.length < this.pageSize) break;
        from = { updated_at: r.updated_at, id: r.id };
      }
      if (last) await setMeta(this.db, cursorKey, { ...last, stable });
    }
  }

  async clearRejected(): Promise<void> {
    await this.db.sync_errors.clear();
    await this.setStatus({});
  }
}
