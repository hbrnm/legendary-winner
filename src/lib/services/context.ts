import type { CamaraDB } from "@/lib/db/database";
import type { WriteOptions } from "@/lib/db/write";

/** Contextul fiecărei acțiuni: baza locală, gospodăria activă și utilizatorul. */
export interface AppCtx {
  db: CamaraDB;
  householdId: string;
  userId: string;
  /** false în modul demonstrativ (nimic nu pleacă spre server). */
  sync: boolean;
}

export const w = (ctx: AppCtx): WriteOptions => ({ outbox: ctx.sync });

/** Eroare cu mesaj pentru utilizator (română, fără detalii tehnice). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
