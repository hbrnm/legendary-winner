import type { TableName } from "@/lib/db/database";

/** Serverul a refuzat definitiv (RLS, constrângere): nu are rost să reîncercăm. */
export class RemoteRejected extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "RemoteRejected";
  }
}

/** Serverul nu e accesibil acum (offline, eroare temporară): reîncercăm mai târziu. */
export class RemoteUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteUnavailable";
  }
}

export type RemoteRow = Record<string, unknown> & { id: string; updated_at: string };

/**
 * De unde pornește tragerea: cu `id`, strict după perechea (updated_at, id);
 * fără `id`, de la rândurile cu updated_at >= updated_at.
 */
export interface PullFrom {
  updated_at: string;
  id?: string;
}

export interface RemoteStore {
  upsert(table: TableName, row: Record<string, unknown>): Promise<void>;
  /** false dacă rândul nu există sau nu poate fi modificat de utilizator. */
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<boolean>;
  fetchRow(table: TableName, id: string): Promise<RemoteRow | null>;
  /** Rândurile de la `from` încolo, crescător după (updated_at, id). */
  pull(table: TableName, from: PullFrom | null, limit: number): Promise<RemoteRow[]>;
  /** Ora serverului (ISO), după același ceas ca updated_at. */
  serverNow(): Promise<string>;
  /** Anunță când alt dispozitiv a modificat ceva în gospodărie. */
  subscribe?(householdId: string, onChange: () => void): () => void;
}
