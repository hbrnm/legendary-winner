import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./fake-remote";
import { setClock } from "@/lib/clock";

const H = "h1";
const W = { outbox: true };
let n = 0;

function device(remote: FakeRemote) {
  const db = new CamaraDB(`test-${++n}-${Math.random()}`);
  return { db, sync: new SyncEngine(db, remote, { overlapMs: 0 }) };
}

async function addList(db: CamaraDB, id: string) {
  await insertRow(db, "shopping_lists", { id, household_id: H, name: "Săptămâna", is_recurring: false, cycle: 1, archived_at: null, default_retailer_id: null, sort_order: 0 }, W);
}

async function addItem(db: CamaraDB, id: string, listId: string, name = "Lapte") {
  await insertRow(
    db,
    "shopping_list_items",
    {
      id,
      household_id: H,
      list_id: listId,
      product_id: null,
      name,
      quantity: 1,
      unit: "l",
      category_id: "lactate",
      estimated_price: null,
      actual_price: null,
      retailer_id: null,
      source: "supermarket",
      priority: "normala",
      note: null,
      checked: false,
      checked_at: null,
      checked_by: null,
      origin: "manual",
      sort_order: 0,
    },
    W,
  );
}

let remote: FakeRemote;
beforeEach(() => {
  remote = new FakeRemote();
  setClock("2026-03-10T09:00:00.000Z");
});
afterEach(() => setClock(null));

describe("sincronizarea între dispozitive", () => {
  it("modificările făcute offline ajung la server la revenirea conexiunii și apoi la celălalt membru", async () => {
    const a = device(remote);
    const b = device(remote);
    remote.online = false;
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    expect(a.sync.getStatus().state).toBe("offline");
    expect(await a.db.outbox.count()).toBe(2);

    remote.online = true;
    await a.sync.syncNow();
    expect(await a.db.outbox.count()).toBe(0);
    await b.sync.syncNow();
    expect((await b.db.shopping_list_items.get("i1"))?.name).toBe("Lapte");
  });

  it("inserarea urmată de modificări pleacă într-o singură cerere", async () => {
    const a = device(remote);
    const spy = vi.spyOn(remote, "upsert");
    await addList(a.db, "l1");
    await updateRow(a.db, "shopping_lists", "l1", { name: "Piață" }, W);
    await updateRow(a.db, "shopping_lists", "l1", { is_recurring: true }, W);
    expect(await a.db.outbox.count()).toBe(1);
    await a.sync.syncNow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(remote.tables.get("shopping_lists")!.get("l1")).toMatchObject({ name: "Piață", is_recurring: true });
  });

  it("două persoane care modifică offline câmpuri diferite ale aceluiași produs nu își pierd modificările", async () => {
    const a = device(remote);
    const b = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await b.sync.syncNow();

    remote.online = false;
    await updateRow(a.db, "shopping_list_items", "i1", { quantity: 3 }, W);
    await updateRow(b.db, "shopping_list_items", "i1", { checked: true, actual_price: 8.5 }, W);
    remote.online = true;
    await b.sync.syncNow();
    await a.sync.syncNow();
    await b.sync.syncNow();

    for (const d of [a, b]) {
      expect(await d.db.shopping_list_items.get("i1")).toMatchObject({ quantity: 3, checked: true, actual_price: 8.5 });
    }
  });

  it("pe același câmp câștigă ultima modificare ajunsă la server, iar dispozitivele converg", async () => {
    const a = device(remote);
    const b = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await b.sync.syncNow();
    remote.online = false;
    await updateRow(a.db, "shopping_list_items", "i1", { quantity: 2 }, W);
    await updateRow(b.db, "shopping_list_items", "i1", { quantity: 5 }, W);
    remote.online = true;
    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await a.db.shopping_list_items.get("i1"))?.quantity).toBe(5);
    expect((await b.db.shopping_list_items.get("i1"))?.quantity).toBe(5);
  });

  it("modificările locale netrimise nu sunt șterse de ce vine de la server", async () => {
    const a = device(remote);
    const b = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await b.sync.syncNow();

    await updateRow(b.db, "shopping_list_items", "i1", { name: "Lapte de vacă" }, W);
    await b.sync.syncNow();
    // A are o modificare locală pe care încă n-a trimis-o; doar trage.
    await updateRow(a.db, "shopping_list_items", "i1", { note: "cel de 3,5%" }, W);
    await a.sync.pull();
    expect(await a.db.shopping_list_items.get("i1")).toMatchObject({ name: "Lapte de vacă", note: "cel de 3,5%" });
    expect(await a.db.outbox.count()).toBe(1);
  });

  it("ștergerea ajunge și la celălalt dispozitiv", async () => {
    const a = device(remote);
    const b = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await b.sync.syncNow();
    await softDelete(b.db, "shopping_list_items", "i1", W);
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await a.db.shopping_list_items.get("i1"))?.deleted_at).not.toBeNull();
  });

  it("o modificare refuzată de server e notată și rândul revine la versiunea serverului", async () => {
    const a = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    remote.rejectIf = (table, row) => (table === "shopping_list_items" && (row.actual_price as number) < 0 ? "Suma nu poate fi negativă" : null);
    await updateRow(a.db, "shopping_list_items", "i1", { actual_price: -1 }, W);
    await addItem(a.db, "i2", "l1", "Pâine");
    await a.sync.syncNow();
    expect((await a.db.shopping_list_items.get("i1"))?.actual_price).toBeNull();
    expect(await a.db.sync_errors.count()).toBe(1);
    expect(a.sync.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: 1 });
    // Restul cozii a mers mai departe.
    expect(remote.tables.get("shopping_list_items")!.has("i2")).toBe(true);
  });

  it("o inserare refuzată dispare și local", async () => {
    const a = device(remote);
    remote.rejectIf = (table) => (table === "shopping_lists" ? "Nu ai acces la această gospodărie" : null);
    await addList(a.db, "l9");
    await a.sync.syncNow();
    expect(await a.db.shopping_lists.get("l9")).toBeUndefined();
  });

  it("trage pe pagini până la capăt", async () => {
    const a = device(remote);
    const b = new SyncEngine(new CamaraDB(`pag-${Math.random()}`), remote, { overlapMs: 0, pageSize: 3 });
    await addList(a.db, "l1");
    for (let i = 0; i < 8; i++) await addItem(a.db, `i${i}`, "l1", `Produs ${i}`);
    await a.sync.syncNow();
    await b.syncNow();
    expect(await (b as unknown as { db: CamaraDB }).db.shopping_list_items.count()).toBe(8);
  });
});
