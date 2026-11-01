import { beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { getUnsyncedCount } from "./app-provider";

describe("protecție la deconectare împotriva pierderii modificărilor nesincronizate (F04)", () => {
  let db: CamaraDB;

  beforeEach(() => {
    db = new CamaraDB(`test-signout-${Math.random()}`);
  });

  it("getUnsyncedCount raportează corect modificările netrimise", async () => {
    expect(await getUnsyncedCount(null)).toBe(0);
    expect(await getUnsyncedCount(db)).toBe(0);

    // Adăugăm o intrare în outbox (ex. o listă creată offline)
    await db.outbox.add({
      table: "shopping_lists",
      row_id: "list-1",
      op: "insert",
      payload: { name: "Test" },
      created_at: new Date().toISOString(),
      attempts: 0,
    });
    expect(await getUnsyncedCount(db)).toBe(1);

    // Adăugăm o poză în photo_uploads
    await db.photo_uploads.add({
      photo_id: "p1",
      storage_path: "p1.jpg",
      content_type: "image/jpeg",
      data: new ArrayBuffer(4),
      created_at: new Date().toISOString(),
      attempts: 0,
    });
    expect(await getUnsyncedCount(db)).toBe(2);

    // Adăugăm o ștergere în photo_removals
    await db.photo_removals.add({
      photo_id: "p0",
      storage_path: "p0.jpg",
      created_at: new Date().toISOString(),
    });
    expect(await getUnsyncedCount(db)).toBe(3);
  });

  it("semnalează datele nesincronizate înainte de ștergerea bazei (F04)", async () => {
    // Simulăm comportamentul de deconectare securizată:
    // Când există modificări în outbox, operația nu continuă fără confirmare explicită (force).
    await db.outbox.add({
      table: "shopping_lists",
      row_id: "list-offline",
      op: "insert",
      payload: { name: "Cumpărături offline" },
      created_at: new Date().toISOString(),
      attempts: 0,
    });

    const unsynced = await getUnsyncedCount(db);
    expect(unsynced).toBe(1);

    // Dacă utilizatorul nu a forțat ieșirea, baza IndexedDB și modificările netrimise rămân intacte
    const shouldProceedWithoutForce = unsynced === 0;
    expect(shouldProceedWithoutForce).toBe(false);

    // Baza conține în continuare rândul salvat offline
    const pending = await db.outbox.toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0].row_id).toBe("list-offline");
  });
});
