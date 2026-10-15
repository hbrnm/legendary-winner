import type { CamaraDB, TableName } from "@/lib/db/database";
import { OPTIONAL_TABLES, SYNCED_TABLES, getMeta, setMeta } from "@/lib/db/database";
import { applyRemoteRows, normalizeRemote } from "@/lib/db/write";
import { nowIso } from "@/lib/clock";
import { RemoteRejected, RemoteUnavailable, type PullFrom, type RemoteStore } from "./remote";
import type { PhotoCache, RemoteFiles } from "./files";

export type SyncState = "inactiv" | "sincronizare" | "sincronizat" | "offline" | "eroare";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  last_synced_at: string | null;
  last_error: string | null;
  rejected: number;
  /** Câte dintre cele refuzate sunt fotografii (au un mesaj al lor). */
  rejected_photos: number;
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
  /** Fișierele fotografiilor gospodăriei; fără ele, rândurile cu fișier netrimis rămân în outbox. */
  files?: RemoteFiles;
  cache?: PhotoCache | null;
}

/** În `meta`: true dacă serverul nu are (încă) tabelul opțional, false după ce l-a confirmat. */
export const serverMissingKey = (table: TableName) => `server_missing:${table}`;

/** PostgREST: tabelul nu există (încă) pe server. */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

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
 *
 * Fotografiile gospodăriei: fișierul urcă în Storage înaintea rândului
 * `recipe_photos` (rândul așteaptă în outbox), ca alt membru să nu vadă o
 * fotografie fără fișier. După ce ștergerea logică a unei fotografii ajunge
 * pe server, fișierul ei se șterge din Storage. Dacă serverul refuză rândul
 * (ex. alt membru a pus între timp o fotografie la aceeași rețetă), se
 * renunță la el și i se șterge fișierul.
 */
export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerun = false;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { state: "inactiv", pending: 0, last_synced_at: null, last_error: null, rejected: 0, rejected_photos: 0 };
  private overlapMs: number;
  private pageSize: number;
  private files: RemoteFiles | null;
  private cache: PhotoCache | null;

  constructor(
    private db: CamaraDB,
    private remote: RemoteStore,
    opts: SyncOptions = {},
  ) {
    this.overlapMs = opts.overlapMs ?? 30_000;
    this.pageSize = opts.pageSize ?? 500;
    this.files = opts.files ?? null;
    this.cache = opts.cache ?? null;
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
    const rejected_photos = await this.db.sync_errors.filter((e) => e.table === "recipe_photos").count();
    this.status = { ...this.status, ...patch, pending, rejected, rejected_photos };
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
          // O încărcare eșuată nu oprește restul: celelalte date se sincronizează, iar starea rămâne „offline”.
          const uploadError = await this.uploadPhotos();
          await this.push();
          await this.pull();
          await this.removePhotos();
          await this.pruneCache();
          if (uploadError) throw uploadError;
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
    // Tabelele opționale care încă lipsesc pe server: rândurile lor așteaptă migrația.
    const missing = new Set<TableName>();
    for (;;) {
      // Rândurile fotografiilor al căror fișier n-a ajuns încă în Storage așteaptă.
      const waiting = new Set(await this.db.photo_uploads.toCollection().primaryKeys());
      const entry = await this.db.outbox
        .orderBy("seq")
        .filter((e) => !missing.has(e.table) && !(e.table === "recipe_photos" && waiting.has(e.row_id)))
        .first();
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
        if (e instanceof RemoteRejected && OPTIONAL_TABLES.has(entry.table) && MISSING_TABLE.has(e.code ?? "")) {
          missing.add(entry.table);
          continue;
        }
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
    const photo = table === "recipe_photos" ? await this.db.recipe_photos.get(rowId) : undefined;
    // Modificările ulterioare ale aceluiași rând depind de cea refuzată.
    const dependent = (await this.db.outbox.toArray()).filter((e) => e.table === table && e.row_id === rowId);
    await this.db.outbox.bulkDelete(dependent.map((e) => e.seq!));
    const serverRow = await this.remote.fetchRow(table, rowId).catch(() => null);
    if (serverRow) await this.db.table(table).put(normalizeRemote(table, serverRow));
    else await this.db.table(table).delete(rowId);
    // Fotografia refuzată nu există pe server: fișierul ei, deja urcat, nu mai folosește nimănui.
    if (photo && !serverRow) {
      await this.db.photo_uploads.delete(rowId);
      await this.db.photo_removals.put({ storage_path: photo.storage_path, photo_id: rowId, created_at: nowIso() });
    }
    // Ștergerea refuzată: fotografia e încă activă pe server, deci fișierul rămâne.
    if (photo && serverRow && !serverRow.deleted_at) await this.db.photo_removals.delete(String(serverRow.storage_path));
  }

  /** Urcă fișierele fotografiilor noi. Întoarce eroarea temporară, dacă a fost una. */
  private async uploadPhotos(): Promise<RemoteUnavailable | null> {
    if (!this.files) return null;
    let failed: RemoteUnavailable | null = null;
    const queue = (await this.db.photo_uploads.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const file of queue) {
      await this.db.photo_uploads.update(file.photo_id, { attempts: file.attempts + 1 });
      try {
        await this.files.upload(file.storage_path, file.data, file.content_type);
      } catch (e) {
        if (e instanceof RemoteRejected) {
          await this.rejectPhoto(file.photo_id, e.message);
          continue;
        }
        // Fișierul rămâne în coadă; următoarele încearcă totuși.
        failed ??= e instanceof RemoteUnavailable ? e : new RemoteUnavailable(e instanceof Error ? e.message : String(e));
        continue;
      }
      // Fișierul rămâne pe telefon (pentru offline) în cache, nu în coadă.
      await this.cache?.put(file.storage_path, new Blob([file.data], { type: file.content_type })).catch(() => {});
      await this.db.photo_uploads.delete(file.photo_id);
    }
    return failed;
  }

  /** Storage a refuzat fișierul: fotografia nu poate ajunge pe server, deci renunțăm la ea. */
  private async rejectPhoto(photoId: string, message: string) {
    await this.db.transaction("rw", [this.db.recipe_photos, this.db.outbox, this.db.photo_uploads, this.db.sync_errors], async () => {
      await this.db.sync_errors.add({ table: "recipe_photos", row_id: photoId, op: "insert", message, at: nowIso() });
      const entries = (await this.db.outbox.toArray()).filter((e) => e.table === "recipe_photos" && e.row_id === photoId);
      await this.db.outbox.bulkDelete(entries.map((e) => e.seq!));
      await this.db.recipe_photos.delete(photoId);
      await this.db.photo_uploads.delete(photoId);
    });
  }

  /** Șterge din Storage fișierele fotografiilor a căror ștergere logică a ajuns pe server. */
  private async removePhotos(): Promise<void> {
    if (!this.files) return;
    const pending = new Set((await this.db.outbox.filter((e) => e.table === "recipe_photos").toArray()).map((e) => e.row_id));
    const ready = (await this.db.photo_removals.toArray()).filter((r) => !pending.has(r.photo_id));
    if (ready.length === 0) return;
    try {
      await this.files.remove(ready.map((r) => r.storage_path));
    } catch (e) {
      // Eroare temporară: datele sunt deja sincronizate, ștergem fișierele data viitoare.
      // Fără drept de ștergere (ex. nu mai ești în gospodărie): nu are rost să reîncercăm.
      if (!(e instanceof RemoteRejected)) return;
    }
    await this.db.photo_removals.bulkDelete(ready.map((r) => r.storage_path));
    for (const r of ready) await this.cache?.delete(r.storage_path).catch(() => {});
  }

  /** Scoate din cache fotografiile șterse (și de alți membri) sau care nu mai sunt pe telefon. */
  private async pruneCache(): Promise<void> {
    if (!this.cache) return;
    const cached = await this.cache.paths().catch(() => [] as string[]);
    if (cached.length === 0) return;
    const active = new Set((await this.db.recipe_photos.toArray()).filter((p) => !p.deleted_at).map((p) => p.storage_path));
    for (const path of cached) if (!active.has(path)) await this.cache.delete(path).catch(() => {});
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
      let missing = false;
      for (;;) {
        let rows;
        try {
          rows = await this.remote.pull(table, from, this.pageSize);
        } catch (e) {
          // Migrația tabelului încă nu e pe server: îl tragem de la început când apare.
          if (OPTIONAL_TABLES.has(table) && e instanceof RemoteRejected && MISSING_TABLE.has(e.code ?? "")) {
            missing = true;
            break;
          }
          throw e;
        }
        if (rows.length === 0) break;
        await applyRemoteRows(this.db, table, rows);
        const r = rows[rows.length - 1];
        last = { updated_at: r.updated_at, id: r.id, stable };
        if (rows.length < this.pageSize) break;
        from = { updated_at: r.updated_at, id: r.id };
      }
      if (last) await setMeta(this.db, cursorKey, { ...last, stable });
      // Ecranele arată funcțiile tabelului doar după ce serverul l-a confirmat.
      if (OPTIONAL_TABLES.has(table) && (await getMeta<boolean>(this.db, serverMissingKey(table))) !== missing) await setMeta(this.db, serverMissingKey(table), missing);
    }
  }

  async clearRejected(): Promise<void> {
    await this.db.sync_errors.clear();
    await this.setStatus({});
  }
}
