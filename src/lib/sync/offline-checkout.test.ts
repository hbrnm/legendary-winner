import { afterEach, expect, it, vi } from "vitest";
import { projectTransactions } from "@/components/budget/transactions";
import { setClock } from "@/lib/clock";
import { CamaraDB } from "@/lib/db/database";
import { budgetStatus } from "@/lib/domain/budget";
import { seedCatalog } from "@/lib/services/bootstrap";
import { householdSpendRecords } from "@/lib/services/queries";
import { addItem, createList, finalizeShopping, setActualPrice } from "@/lib/services/shopping";
import { budget } from "@/test/factories";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./fake-remote";
import { RemoteUnavailable } from "./remote";

const databases: CamaraDB[] = [];
const householdId = "aceeasi-gospodarie";
const day = "2026-11-16";
const monthlyBudget = budget({ household_id: householdId, amount: 100 });

function device(userId: string, remote: FakeRemote) {
  const db = new CamaraDB(`offline-checkout-${userId}`);
  databases.push(db);
  return { ctx: { db, householdId, userId, sync: true }, engine: new SyncEngine(db, remote) };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
  setClock(null);
});

it.each([
  { first: "Ana", last: "Mihai", settledTotal: 12, adjustment: 2, productId: "rosii", quantity: 1 },
  { first: "Mihai", last: "Ana", settledTotal: 25, adjustment: 5, productId: "cartofi-albi", quantity: 2 },
])("păstrează exclusiv tura lui $first când $last se reconectează ulterior", async ({ first, settledTotal, adjustment, productId, quantity }) => {
  setClock(`${day}T10:00:00Z`);
  const remote = new FakeRemote();
  const ana = device("Ana", remote);
  const mihai = device("Mihai", remote);
  await Promise.all([seedCatalog(ana.ctx.db), seedCatalog(mihai.ctx.db)]);

  const listId = await createList(ana.ctx, { name: "Lista comună" });
  const tomatoes = await addItem(ana.ctx, listId, { product_id: "rosii", quantity: 1, unit: "kg" });
  const potatoes = await addItem(ana.ctx, listId, { product_id: "cartofi-albi", quantity: 2, unit: "kg" });
  await ana.engine.syncNow();
  await mihai.engine.syncNow();
  expect(await mihai.ctx.db.shopping_list_items.count()).toBe(2);

  remote.online = false;
  await setActualPrice(ana.ctx, tomatoes, 10);
  await setActualPrice(mihai.ctx, potatoes, 20);
  const anaPayment = await finalizeShopping(ana.ctx, listId, { addToPantry: true, totalPaid: 12 });
  const mihaiPayment = await finalizeShopping(mihai.ctx, listId, { addToPantry: true, totalPaid: 25 });
  expect(mihaiPayment.transaction_id).toBe(anaPayment.transaction_id);
  expect(anaPayment).toMatchObject({ items: 1, added_to_pantry: 1, total: 12 });
  expect(mihaiPayment).toMatchObject({ items: 1, added_to_pantry: 1, total: 25 });
  await Promise.all([ana.engine.syncNow(), mihai.engine.syncNow()]);
  for (const { engine } of [ana, mihai]) {
    expect(engine.getStatus().state).toBe("offline");
    expect(engine.getStatus().pending).toBeGreaterThan(0);
  }

  const early = first === "Ana" ? ana : mihai;
  const late = first === "Ana" ? mihai : ana;
  remote.online = true;
  const submit = remote.checkout.bind(remote);
  vi.spyOn(remote, "checkout").mockImplementationOnce(async (batch) => {
    expect(await submit(batch)).toBe(true);
    throw new RemoteUnavailable("Conexiune întreruptă după confirmare");
  });
  await early.engine.syncNow();
  expect(early.engine.getStatus()).toMatchObject({ state: "offline", pending: 1, rejected: 0 });
  expect(remote.tables.get("shopping_transactions")?.get(anaPayment.transaction_id)).toMatchObject({ declared_total: settledTotal });
  await early.engine.syncNow();
  vi.spyOn(remote, "pull").mockRejectedValueOnce(new RemoteUnavailable("Conexiune întreruptă înainte de tragerea generală"));
  await late.engine.syncNow();
  expect(late.engine.getStatus()).toMatchObject({ state: "offline", pending: 0, rejected: 1 });
  expect(await late.ctx.db.shopping_transaction_items.toArray()).toMatchObject([{ product_id: productId }]);
  expect(await late.ctx.db.pantry_items.toArray()).toMatchObject([{ product_id: productId, quantity }]);
  await late.engine.syncNow();
  await early.engine.syncNow();

  const winner = first === "Ana" ? anaPayment : mihaiPayment;
  const purchased = first === "Ana" ? tomatoes : potatoes;
  const remaining = first === "Ana" ? potatoes : tomatoes;
  for (const { ctx, engine } of [ana, mihai]) {
    expect(engine.getStatus()).toMatchObject({ state: "sincronizat", pending: 0, rejected: ctx.userId === first ? 0 : 1 });
    const transactions = await ctx.db.shopping_transactions.toArray();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ id: winner.transaction_id, checkout_attempt_id: winner.attempt_id, declared_total: settledTotal });
    const spend = await householdSpendRecords(ctx.db, householdId);
    expect(projectTransactions(spend, transactions)).toMatchObject([
      { pending: false, itemCount: 1, amount: settledTotal, unallocated: adjustment },
    ]);
    expect(spend.filter((row) => !row.unallocated).map((row) => row.list_item_id)).toEqual([purchased]);
    expect(budgetStatus(monthlyBudget, spend, new Map(), day)).toMatchObject({ spent: settledTotal, remaining: 100 - settledTotal });
    const pantry = await ctx.db.pantry_items.toArray();
    expect(pantry).toMatchObject([{ product_id: productId, quantity }]);
    expect(await ctx.db.shopping_list_items.get(remaining)).toMatchObject({ checked: false, actual_price: null, deleted_at: null });
  }
});
