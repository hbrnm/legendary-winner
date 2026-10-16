import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { DEMO_HOUSEHOLD_ID, ensureDemoHousehold, seedCatalog } from "./bootstrap";
import { listItems, owned, spendRecords } from "./queries";
import { budgetStatus, monthlyTotals, weeklyTotals } from "@/lib/domain/budget";
import { expiringSoon } from "@/lib/domain/pantry";
import { addDays, startOfWeek } from "@/lib/domain/dates";

const TODAY = "2026-10-16";
let db: CamaraDB;

beforeEach(async () => {
  setClock("2026-10-16T09:00:00.000Z");
  db = new CamaraDB(`demo-${Math.random()}`);
  await seedCatalog(db);
});
afterEach(() => setClock(null));

describe("gospodăria model din modul demonstrativ", () => {
  it("fără `example`, rămâne o singură listă goală", async () => {
    await ensureDemoHousehold(db);
    const lists = await owned(db, "shopping_lists", DEMO_HOUSEHOLD_ID);
    expect(lists).toHaveLength(1);
    expect(await listItems(db, lists[0].id)).toHaveLength(0);
    expect(await owned(db, "pantry_items", DEMO_HOUSEHOLD_ID)).toHaveLength(0);
    expect(await owned(db, "budgets", DEMO_HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("cu `example`, umple cămara, lista, bugetul, istoricul și planul, fără nimic în outbox", async () => {
    await ensureDemoHousehold(db, { example: true });
    const pantry = await owned(db, "pantry_items", DEMO_HOUSEHOLD_ID);
    expect(pantry).toHaveLength(14);
    expect(new Set(pantry.map((p) => p.location_id))).toEqual(new Set(["frigider", "congelator", "camara"]));
    const soon = expiringSoon(pantry, TODAY, 3);
    expect(soon.map((p) => p.expires_on)).toContain(addDays(TODAY, 2));

    const [list] = await owned(db, "shopping_lists", DEMO_HOUSEHOLD_ID);
    const items = await listItems(db, list.id);
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(items.filter((i) => i.checked).length).toBeGreaterThanOrEqual(2);

    const [budget] = await owned(db, "budgets", DEMO_HOUSEHOLD_ID);
    expect(budget.amount).toBe(2500);
    const spend = await spendRecords(db, DEMO_HOUSEHOLD_ID);
    const status = budgetStatus(budget, spend, new Map(), TODAY);
    expect(status.spent).toBeGreaterThan(0);
    expect(status.over).toBe(false);

    // Graficele pe 6 luni și pe 8 săptămâni nu au coloane goale.
    expect(monthlyTotals(spend, TODAY, 6).every((m) => m.amount > 0)).toBe(true);
    expect(weeklyTotals(spend, TODAY, 8).every((w) => w.amount > 0)).toBe(true);
    // Nicio cheltuială în viitor.
    expect(spend.every((s) => s.purchased_at.slice(0, 10) <= TODAY)).toBe(true);

    const retailers = new Set((await owned(db, "product_prices", DEMO_HOUSEHOLD_ID)).map((p) => p.retailer_id ?? p.source));
    expect(retailers).toEqual(new Set(["lidl", "kaufland", "piata"]));

    const meals = await owned(db, "meal_plan_items", DEMO_HOUSEHOLD_ID);
    const week = startOfWeek(TODAY);
    expect(meals).toHaveLength(3);
    expect(meals.every((m) => m.date >= week && m.date <= addDays(week, 6))).toBe(true);

    expect(await db.outbox.count()).toBe(0);
  });

  it("se face o singură dată", async () => {
    await ensureDemoHousehold(db, { example: true });
    await ensureDemoHousehold(db, { example: true });
    expect(await owned(db, "pantry_items", DEMO_HOUSEHOLD_ID)).toHaveLength(14);
    expect(await owned(db, "budgets", DEMO_HOUSEHOLD_ID)).toHaveLength(1);
  });
});
