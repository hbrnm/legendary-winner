import type { TableName } from "@/lib/db/database";
import { RemoteRejected, RemoteUnavailable, type PullFrom, type RemoteRow, type RemoteStore } from "./remote";

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
  private subscribers = new Set<() => void>();

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

  private check() {
    if (!this.online) throw new RemoteUnavailable("Fără conexiune");
  }

  async upsert(table: TableName, row: Record<string, unknown>): Promise<void> {
    this.check();
    const existing = this.t(table).get(row.id as string);
    const next = { ...(existing ?? {}), ...row, updated_at: this.stamp() } as RemoteRow;
    const reason = this.rejectIf?.(table, next);
    if (reason) throw new RemoteRejected(reason);
    this.t(table).set(next.id, next);
    this.notify();
  }

  async update(table: TableName, id: string, patch: Record<string, unknown>): Promise<boolean> {
    this.check();
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
    this.check();
    return this.t(table).get(id) ?? null;
  }

  async pull(table: TableName, from: PullFrom | null, limit: number): Promise<RemoteRow[]> {
    this.check();
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
