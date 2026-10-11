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

export interface RemoteStore {
  upsert(table: TableName, row: Record<string, unknown>): Promise<void>;
  /** false dacă rândul nu există sau nu poate fi modificat de utilizator. */
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<boolean>;
  fetchRow(table: TableName, id: string): Promise<RemoteRow | null>;
  /** Rândurile cu updated_at >= since, crescător după updated_at. */
  pull(table: TableName, since: string | null, limit: number): Promise<RemoteRow[]>;
  /** Anunță când alt dispozitiv a modificat ceva în gospodărie. */
  subscribe?(householdId: string, onChange: () => void): () => void;
}
