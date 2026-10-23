import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./fake-remote";
import { RemoteRejected, RemoteUnavailable } from "./remote";
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
afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
});

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

  it("salvarea întregului formular nu trimite câmpurile neschimbate peste modificarea altui membru", async () => {
    const a = device(remote);
    const b = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await b.sync.syncNow();

    // Ana schimbă cantitatea; Bogdan, fără semnal, salvează fereastra produsului cu cantitatea veche și prețul.
    await updateRow(a.db, "shopping_list_items", "i1", { quantity: 2 }, W);
    await a.sync.syncNow();
    remote.online = false;
    await updateRow(b.db, "shopping_list_items", "i1", { name: "Lapte", quantity: 1, unit: "l", actual_price: 8.9 }, W);
    expect((await b.db.outbox.toArray()).map((e) => e.payload)).toEqual([{ actual_price: 8.9 }]);
    remote.online = true;
    await b.sync.syncNow();
    await a.sync.syncNow();

    for (const d of [a, b]) {
      expect(await d.db.shopping_list_items.get("i1")).toMatchObject({ quantity: 2, actual_price: 8.9 });
    }
  });

  it("un câmp lipsă pe rândul local (rând vechi) se trimite, chiar dacă e null", async () => {
    const a = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await updateRow(a.db, "shopping_list_items", "i1", { variant_id: null }, W);
    expect((await a.db.outbox.toArray()).map((e) => e.payload)).toEqual([{ variant_id: null }]);
  });

  it("o salvare fără nicio schimbare nu mai ajunge în outbox", async () => {
    const a = device(remote);
    await addList(a.db, "l1");
    await addItem(a.db, "i1", "l1");
    await a.sync.syncNow();
    await updateRow(a.db, "shopping_list_items", "i1", { name: "Lapte", quantity: 1 }, W);
    expect(await a.db.outbox.count()).toBe(0);
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

  it("o a doua sincronizare fără schimbări pe server nu mai aduce rânduri", async () => {
    // Catalogul e scris într-o singură rafală, cu ore aproape identice.
    for (let i = 0; i < 20; i++) await remote.upsert("products", { id: `p${i}`, household_id: null, name: `Produs ${i}` });
    remote.advance(60_000);
    const db = new CamaraDB(`fereastra-${Math.random()}`);
    const sync = new SyncEngine(db, remote, { pageSize: 8 });
    await sync.syncNow();
    expect(await db.products.count()).toBe(20);

    remote.advance(60_000);
    const pull = vi.spyOn(remote, "pull");
    await sync.syncNow();
    const rows = (await Promise.all(pull.mock.results.map((r) => r.value))).flat();
    expect(rows).toHaveLength(0);
  });

  it("un rând confirmat târziu, cu o oră dinaintea cursorului, tot ajunge la telefon", async () => {
    const db = new CamaraDB(`tarziu-${Math.random()}`);
    const sync = new SyncEngine(db, remote);
    await remote.upsert("products", { id: "p1", household_id: null, name: "Lapte" });
    const early = remote.tables.get("products")!.get("p1")!.updated_at;
    await remote.upsert("products", { id: "p2", household_id: null, name: "Pâine" });
    remote.advance(5_000);
    await sync.syncNow();
    // O tranzacție începută înaintea lui p2 se confirmă abia acum.
    remote.tables.get("products")!.set("p0", { id: "p0", household_id: null, name: "Ouă", updated_at: early });
    await sync.syncNow();
    expect((await db.products.get("p0"))?.name).toBe("Ouă");
  });

  it("paginarea nu pierde și nu repetă rândurile cu aceeași oră", async () => {
    const t = "2026-03-01T00:00:01.000Z";
    for (let i = 0; i < 7; i++) remote.tables.set("products", (remote.tables.get("products") ?? new Map()).set(`p${i}`, { id: `p${i}`, household_id: null, name: `P${i}`, updated_at: t }));
    const db = new CamaraDB(`aceeasi-ora-${Math.random()}`);
    const pull = vi.spyOn(remote, "pull");
    await new SyncEngine(db, remote, { pageSize: 3 }).syncNow();
    expect(await db.products.count()).toBe(7);
    const rows = (await Promise.all(pull.mock.results.map((r) => r.value))).flat();
    expect(rows).toHaveLength(7);
  });

  it("rândurile primite din nou, neschimbate, nu se mai rescriu local", async () => {
    await remote.upsert("products", { id: "p1", household_id: null, name: "Lapte" });
    const db = new CamaraDB(`rescriere-${Math.random()}`);
    const sync = new SyncEngine(db, remote);
    await sync.syncNow();
    const put = vi.spyOn(Object.getPrototypeOf(db.products), "bulkPut");
    // Încă în fereastră: rândul vine din nou de la server.
    await sync.syncNow();
    expect(put).not.toHaveBeenCalled();
    await remote.update("products", "p1", { name: "Lapte de vacă" });
    await sync.syncNow();
    expect(put).toHaveBeenCalledTimes(1);
    expect((await db.products.get("p1"))?.name).toBe("Lapte de vacă");
  });

  it("o tragere întreruptă între pagini se reia fără să piardă rânduri", async () => {
    for (let i = 0; i < 7; i++) await remote.upsert("products", { id: `p${i}`, household_id: null, name: `P${i}` });
    remote.advance(60_000);
    const db = new CamaraDB(`intrerupt-${Math.random()}`);
    const sync = new SyncEngine(db, remote, { pageSize: 3 });
    const pull = remote.pull.bind(remote);
    let calls = 0;
    vi.spyOn(remote, "pull").mockImplementation(async (table, from, limit) => {
      if (table === "products" && ++calls === 2) throw new RemoteUnavailable("Fără conexiune");
      return pull(table, from, limit);
    });
    await sync.syncNow();
    expect(sync.getStatus().state).toBe("offline");
    expect(await db.products.count()).toBe(3);
    await sync.syncNow();
    expect(sync.getStatus().state).toBe("sincronizat");
    expect(await db.products.count()).toBe(7);
  });

  it("fără ora serverului, sincronizarea merge mai departe ca înainte", async () => {
    vi.spyOn(remote, "serverNow").mockRejectedValue(new RemoteRejected("Funcția nu există", "PGRST202"));
    await remote.upsert("products", { id: "p1", household_id: null, name: "Lapte" });
    const db = new CamaraDB(`fara-ora-${Math.random()}`);
    const sync = new SyncEngine(db, remote);
    await sync.syncNow();
    await remote.upsert("products", { id: "p2", household_id: null, name: "Pâine" });
    await sync.syncNow();
    expect(sync.getStatus().state).toBe("sincronizat");
    expect(await db.products.count()).toBe(2);
  });

  it("cursorul salvat de versiunea veche e folosit, apoi înlocuit", async () => {
    await remote.upsert("products", { id: "p1", household_id: null, name: "Lapte" });
    const old = remote.tables.get("products")!.get("p1")!.updated_at;
    await remote.upsert("products", { id: "p2", household_id: null, name: "Pâine" });
    remote.advance(60_000);
    const db = new CamaraDB(`cursor-vechi-${Math.random()}`);
    await db.meta.put({ key: "cursor:products", value: old });
    const sync = new SyncEngine(db, remote);
    await sync.syncNow();
    expect((await db.products.get("p2"))?.name).toBe("Pâine");
    const pull = vi.spyOn(remote, "pull");
    await sync.syncNow();
    expect((await Promise.all(pull.mock.results.map((r) => r.value))).flat()).toHaveLength(0);
  });
});
