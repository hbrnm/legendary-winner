import { describe, expect, it } from "vitest";
import { CamaraDB, purgeHouseholdData, resetPullCursors, type TableName } from "@/lib/db/database";
import { insertRow } from "@/lib/db/write";
import { reconcileHouseholds } from "./membership";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./fake-remote";
import type { PullFrom } from "./remote";

let dbNumber = 0;
function makeDb() {
  return new CamaraDB(`test-membership-${++dbNumber}-${Date.now()}`);
}

describe("Reconciliere apartenență gospodării (F02 & F03)", () => {
  it("resetPullCursors șterge toți cursorii de pull din meta", async () => {
    const db = makeDb();
    await db.meta.put({ key: "cursor:shopping_lists", value: "2026-03-01T00:00:00.000Z" });
    await db.meta.put({ key: "cursor:pantry_items", value: "2026-03-01T00:00:00.000Z" });
    await db.meta.put({ key: "other_meta", value: "preserve_me" });

    await resetPullCursors(db);

    expect(await db.meta.get("cursor:shopping_lists")).toBeUndefined();
    expect(await db.meta.get("cursor:pantry_items")).toBeUndefined();
    expect((await db.meta.get("other_meta"))?.value).toBe("preserve_me");
  });

  it("purgeHouseholdData șterge datele locale și operațiile outbox ale unei gospodării revocate (F03)", async () => {
    const db = makeDb();
    const H_ACTIVE = "h-active";
    const H_REVOKED = "h-revoked";

    // Adăugăm date în ambele gospodării
    await insertRow(db, "shopping_lists", {
      id: "list-1",
      household_id: H_REVOKED,
      name: "Listă veche revocată",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      default_retailer_id: null,
      sort_order: 0,
    }, { outbox: true });

    await insertRow(db, "shopping_lists", {
      id: "list-2",
      household_id: H_ACTIVE,
      name: "Listă păstrată",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      default_retailer_id: null,
      sort_order: 0,
    }, { outbox: true });

    await insertRow(db, "pantry_items", {
      id: "pantry-1",
      household_id: H_REVOKED,
      product_id: "prod-faina",
      name: "Făină revocată",
      quantity: 2,
      unit: "kg",
      location_id: "loc-1",
      purchased_on: null,
      expires_on: null,
      note: null,
    }, { outbox: true });

    // Verificăm existența inițială
    expect(await db.shopping_lists.count()).toBe(2);
    expect(await db.pantry_items.count()).toBe(1);
    expect(await db.outbox.count()).toBe(3);

    // Curățăm gospodăria revocată
    await purgeHouseholdData(db, H_REVOKED);

    // Datele gospodăriei revocate au dispărut, cele active au rămas
    const remainingLists = await db.shopping_lists.toArray();
    expect(remainingLists).toHaveLength(1);
    expect(remainingLists[0].id).toBe("list-2");

    expect(await db.pantry_items.count()).toBe(0);

    // Outbox-ul a fost curățat de operațiile aparținând gospodăriei revocate
    const remainingOutbox = await db.outbox.toArray();
    expect(remainingOutbox).toHaveLength(1);
    expect((remainingOutbox[0].payload as { id: string }).id).toBe("list-2");
  });

  it("reconcileHouseholds detectează gospodăria nouă și resetează cursorii (F02)", async () => {
    const db = makeDb();
    // Prima sincronizare cu gospodăria 1
    await reconcileHouseholds(db, ["h1"]);
    await db.meta.put({ key: "cursor:shopping_lists", value: "2026-03-05T00:00:00.000Z" });

    // Se adaugă gospodăria 2 (F02)
    const result = await reconcileHouseholds(db, ["h1", "h2"]);
    expect(result.added).toEqual(["h2"]);
    expect(result.revoked).toEqual([]);

    // Cursorul a fost resetat pentru ca istoricul lui h2 să poată fi tras complet
    expect(await db.meta.get("cursor:shopping_lists")).toBeUndefined();
  });

  it("reconcileHouseholds detectează gospodăria revocată și îi șterge datele (F03)", async () => {
    const db = makeDb();
    await reconcileHouseholds(db, ["h1", "h2"]);

    await insertRow(db, "shopping_lists", {
      id: "list-h2",
      household_id: "h2",
      name: "Listă h2",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      default_retailer_id: null,
      sort_order: 0,
    }, { outbox: false });

    expect(await db.shopping_lists.count()).toBe(1);

    // h2 a fost revocat
    const result = await reconcileHouseholds(db, ["h1"]);
    expect(result.added).toEqual([]);
    expect(result.revoked).toEqual(["h2"]);

    // Datele lui h2 au fost eliminate
    expect(await db.shopping_lists.count()).toBe(0);
  });

  it("integrare cu SyncEngine: o listă mai veche dintr-o gospodărie nouă este recuperată la pull (F02)", async () => {
    const db = makeDb();
    class HouseholdFakeRemote extends FakeRemote {
      allowedHouseholds: string[] = [];
      override async pull(table: TableName, from: PullFrom | null, limit: number) {
        const rows = await super.pull(table, from, limit);
        return rows.filter((r) => !r.household_id || this.allowedHouseholds.includes(r.household_id as string));
      }
    }
    const remote = new HouseholdFakeRemote();
    remote.allowedHouseholds = ["h1"];

    // Pe server:
    // La T0, în h2 se creează o listă veche
    await remote.upsert("shopping_lists", {
      id: "list-h2-old",
      household_id: "h2",
      name: "Listă veche h2",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      default_retailer_id: null,
      sort_order: 0,
    });

    // La T1, în h1 se creează o listă nouă
    await remote.upsert("shopping_lists", {
      id: "list-h1-new",
      household_id: "h1",
      name: "Listă nouă h1",
      is_recurring: false,
      cycle: 1,
      archived_at: null,
      default_retailer_id: null,
      sort_order: 0,
    });

    let currentHouseholdIds = ["h1"];
    const engine = new SyncEngine(db, remote, {
      overlapMs: 0,
      onBeforePull: async () => {
        await reconcileHouseholds(db, currentHouseholdIds);
      },
    });

    // Sincronizare inițială pe h1: trage doar list-h1-new
    await engine.pull();
    expect(await db.shopping_lists.count()).toBe(1);
    expect((await db.shopping_lists.get("list-h1-new"))?.name).toBe("Listă nouă h1");
    // Cursorul a avansat după T1
    expect(await db.meta.get("cursor:shopping_lists")).toBeDefined();

    // Utilizatorul primește acces și acceptă h2
    currentHouseholdIds = ["h1", "h2"];
    remote.allowedHouseholds = ["h1", "h2"];

    // Următorul pull reconciliază, resetează cursorii și trage lista veche din h2
    await engine.pull();
    expect(await db.shopping_lists.count()).toBe(2);
    expect(await db.shopping_lists.get("list-h2-old")).toBeDefined();
  });
});
