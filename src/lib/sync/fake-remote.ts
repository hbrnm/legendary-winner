import type { CheckoutWrite, TableName } from "@/lib/db/database";
import { RemoteRejected, RemoteUnavailable, type PullFrom, type RemoteRow, type RemoteStore } from "./remote";
import type { RemoteFiles } from "./files";

/**
 * Server în memorie, folosit în teste: imită comportamentul relevant al
 * Supabase (updated_at pus de server, upsert, update parțial, refuzuri).
 */
export class FakeRemote implements RemoteStore {
  tables = new Map<string, Map<string, RemoteRow>>();
  online = true;
  private tick = Date.parse("2026-03-01T00:00:00.000Z");
  /** Regulă opțională de refuz (ex. imită RLS sau o constrângere). */
  rejectIf: ((table: TableName, row: Record<string, unknown>) => string | null) | null = null;
  /** Tabele care încă nu există pe server (migrația neaplicată). */
  missingTables = new Set<string>();
  private subscribers = new Set<() => void>();
  private checkoutQueue: Promise<unknown> = Promise.resolve();

  checkout(batch: CheckoutWrite): Promise<boolean> {
    const result = this.checkoutQueue.then(async () => {
      this.check();
      const list = this.t("shopping_lists").get(batch.listId);
      if (!list || list.household_id !== batch.householdId) throw new RemoteRejected("Lista nu este disponibilă");
      const existing = [...this.t("shopping_transactions").values()].find((row) =>
        row.list_id === batch.listId && row.list_cycle === batch.cycle);
      if (existing) return existing.checkout_attempt_id === batch.attemptId;
      if (list.deleted_at || list.archived_at || list.cycle !== batch.cycle) throw new RemoteRejected("Tura nu mai este activă");

      const snapshot = new Map([...this.tables].map(([table, rows]) => [table, new Map(rows)]));
      try {
        for (const write of batch.writes) {
          if (write.op === "insert") {
            const payload = write.table === "shopping_transactions" ? { ...write.payload, checkout_attempt_id: batch.attemptId } : write.payload;
            await this.upsert(write.table, payload);
          } else if (!(await this.update(write.table, write.row_id, write.payload))) {
            throw new RemoteRejected("Rândul nu mai există pe server");
          }
        }
      } catch (error) {
        this.tables = snapshot;
        throw error;
      }
      return true;
    });
    this.checkoutQueue = result.catch(() => undefined);
    return result;
  }

  async checkoutItems(transactionId: string): Promise<RemoteRow[]> {
    this.check("shopping_transaction_items");
    return [...this.t("shopping_transaction_items").values()].filter((row) => row.transaction_id === transactionId);
  }

  private t(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    return this.tables.get(table)!;
  }

  private stamp(): string {
    this.tick += 1000;
    return new Date(this.tick).toISOString();
  }

  /** Trece timpul pe server fără nicio scriere. */
  advance(ms: number) {
    this.tick += ms;
  }

  private check(table?: string) {
    if (!this.online) throw new RemoteUnavailable("Fără conexiune");
    if (table && this.missingTables.has(table)) throw new RemoteRejected(`Could not find the table 'public.${table}' in the schema cache`, "PGRST205");
  }

  async upsert(table: TableName, row: Record<string, unknown>): Promise<void> {
    this.check(table);
    const existing = this.t(table).get(row.id as string);
    const next = { ...(existing ?? {}), ...row, updated_at: this.stamp() } as RemoteRow;
    const reason = this.rejectIf?.(table, next);
    if (reason) throw new RemoteRejected(reason);
    this.t(table).set(next.id, next);
    this.notify();
  }

  async update(table: TableName, id: string, patch: Record<string, unknown>): Promise<boolean> {
    this.check(table);
    const existing = this.t(table).get(id);
    if (!existing) return false;
    const next = { ...existing, ...patch, updated_at: this.stamp() } as RemoteRow;
    const reason = this.rejectIf?.(table, next);
    if (reason) throw new RemoteRejected(reason);
    this.t(table).set(id, next);
    this.notify();
    return true;
  }

  async fetchRow(table: TableName, id: string): Promise<RemoteRow | null> {
    this.check(table);
    return this.t(table).get(id) ?? null;
  }

  async pull(table: TableName, from: PullFrom | null, limit: number): Promise<RemoteRow[]> {
    this.check(table);
    const after = (r: RemoteRow) => {
      if (!from) return true;
      if (from.id === undefined) return r.updated_at >= from.updated_at;
      return r.updated_at > from.updated_at || (r.updated_at === from.updated_at && r.id > from.id);
    };
    return [...this.t(table).values()]
      .filter(after)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, limit);
  }

  async serverNow(): Promise<string> {
    this.check();
    return new Date(this.tick).toISOString();
  }

  subscribe(_householdId: string, onChange: () => void): () => void {
    this.subscribers.add(onChange);
    return () => this.subscribers.delete(onChange);
  }

  private notify() {
    for (const s of this.subscribers) s();
  }
}

/** Storage în memorie, pentru teste. */
export class FakeFiles implements RemoteFiles {
  files = new Map<string, { data: ArrayBuffer; type: string }>();
  online = true;
  /** Regulă opțională de refuz (ex. imită RLS sau limita de mărime). */
  rejectIf: ((path: string) => string | null) | null = null;
  /** Regulă opțională de eroare temporară pentru un fișier anume. */
  failIf: ((path: string) => boolean) | null = null;
  uploads = 0;

  private check() {
    if (!this.online) throw new RemoteUnavailable("Fără conexiune");
  }

  async upload(path: string, data: ArrayBuffer, contentType: string): Promise<void> {
    this.check();
    const reason = this.rejectIf?.(path);
    if (reason) throw new RemoteRejected(reason, "403");
    if (this.failIf?.(path)) throw new RemoteUnavailable("Internal Server Error");
    this.uploads++;
    this.files.set(path, { data, type: contentType });
  }

  async download(path: string): Promise<Blob> {
    this.check();
    const f = this.files.get(path);
    if (!f) throw new RemoteUnavailable("Object not found");
    return new Blob([f.data], { type: f.type });
  }

  async remove(paths: string[]): Promise<void> {
    this.check();
    for (const p of paths) this.files.delete(p);
  }
}
