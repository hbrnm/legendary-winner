import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { addMember, asUser, closeDb, createHousehold, createUser } from "./helpers";

afterAll(closeDb);

it("confirms only one complete checkout, preserves retries and rolls back a rejected batch", async () => {
  const ana = await createUser("Ana");
  const mihai = await createUser("Mihai");
  const outsider = await createUser("Vizitator");
  const household = await createHousehold(ana);
  await addMember(ana, household, mihai);
  const list = randomUUID();
  const tomatoes = randomUUID();
  const potatoes = randomUUID();
  const trip = randomUUID();
  await asUser(ana, async (query) => {
    await query("insert into shopping_lists (id, household_id, name) values ($1, $2, 'Cumpărături')", [list, household]);
    await query(
      `insert into shopping_list_items (id, household_id, list_id, name, category_id)
       values ($1, $3, $4, 'Roșii', 'legume'), ($2, $3, $4, 'Cartofi', 'legume')`,
      [tomatoes, potatoes, household, list],
    );
  });

  function checkout(item: string, product: string, name: string, amount: number) {
    const date = "2026-11-16T10:00:00Z";
    const line = randomUUID();
    const stock = randomUUID();
    const price = randomUUID();
    return [
      { table: "shopping_transactions", row_id: trip, op: "insert", payload: {
        id: trip, household_id: household, list_id: list, list_cycle: 1,
        started_at: date, completed_at: date, declared_total: amount,
      } },
      { table: "shopping_transaction_items", row_id: line, op: "insert", payload: {
        id: line, household_id: household, transaction_id: trip, list_item_id: item,
        product_id: product, name, category_id: "legume", amount, purchased_at: date,
      } },
      { table: "product_prices", row_id: price, op: "insert", payload: {
        id: price, household_id: household, product_id: product, source: "supermarket",
        amount, quantity: 1, unit: "kg", price_type: "platit", observed_on: "2026-11-16", transaction_item_id: line,
      } },
      { table: "pantry_items", row_id: stock, op: "insert", payload: {
        id: stock, household_id: household, product_id: product, name,
        quantity: 1, unit: "kg", location_id: "camara", purchased_on: "2026-11-16",
      } },
      { table: "shopping_list_items", row_id: item, op: "update", payload: { deleted_at: date } },
      { table: "shopping_lists", row_id: list, op: "update", payload: { cycle: 2 } },
    ];
  }
  const call = "select public.finalize_shopping_checkout($1, $2, $3, 1, $4) as accepted";
  const anaWrites = checkout(tomatoes, "rosii", "Roșii", 12);
  const mihaiWrites = checkout(potatoes, "cartofi-albi", "Cartofi", 25);
  const anaAttempt = randomUUID();
  const mihaiAttempt = randomUUID();
  const submit = async (user: typeof ana, attempt: string, writes: unknown) =>
    asUser(user, async (query) => (await query(call, [attempt, household, list, JSON.stringify(writes)])).rows[0].accepted);

  await expect(submit(outsider, randomUUID(), anaWrites)).rejects.toMatchObject({ code: "42501" });
  await expect(submit(ana, anaAttempt, [...anaWrites, {
    table: "shopping_list_items", row_id: randomUUID(), op: "update", payload: { checked: false },
  }])).rejects.toMatchObject({ code: "22023" });
  await asUser(ana, async (query) => {
    expect((await query("select id from shopping_transactions where id = $1", [trip])).rowCount).toBe(0);
    expect((await query("select cycle from shopping_lists where id = $1", [list])).rows[0].cycle).toBe(1);
    expect((await query("select id from pantry_items where household_id = $1", [household])).rowCount).toBe(0);
  });

  const [anaWon, mihaiWon] = await Promise.all([submit(ana, anaAttempt, anaWrites), submit(mihai, mihaiAttempt, mihaiWrites)]);
  expect([anaWon, mihaiWon].filter(Boolean)).toHaveLength(1);
  expect(await submit(ana, anaAttempt, anaWrites)).toBe(anaWon);
  expect(await submit(mihai, mihaiAttempt, mihaiWrites)).toBe(mihaiWon);
  await asUser(mihai, async (query) => {
    const header = await query("select declared_total::integer as total, checkout_attempt_id from shopping_transactions where id = $1", [trip]);
    expect(header.rows).toEqual([{ total: anaWon ? 12 : 25, checkout_attempt_id: anaWon ? anaAttempt : mihaiAttempt }]);
    const lines = await query("select list_item_id from shopping_transaction_items where transaction_id = $1", [trip]);
    expect(lines.rows).toEqual([{ list_item_id: anaWon ? tomatoes : potatoes }]);
    const listItems = await query("select id from shopping_list_items where list_id = $1 and deleted_at is null", [list]);
    expect(listItems.rows).toEqual([{ id: anaWon ? potatoes : tomatoes }]);
    const expectedProduct = { product_id: anaWon ? "rosii" : "cartofi-albi" };
    expect((await query("select product_id from pantry_items where household_id = $1", [household])).rows).toEqual([expectedProduct]);
    expect((await query("select product_id from product_prices where household_id = $1", [household])).rows).toEqual([expectedProduct]);
  });
});
