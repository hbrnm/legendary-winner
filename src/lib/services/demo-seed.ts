import type { CamaraDB } from "@/lib/db/database";
import { newId } from "@/lib/db/ids";
import { now } from "@/lib/clock";
import { addDays, startOfWeek, toISODate } from "@/lib/domain/dates";
import type { ProductPrice, PurchaseSource, ShoppingTransaction, ShoppingTransactionItem, UnitCode } from "@/lib/domain/types";
import type { AppCtx } from "./context";
import { addMeal, addPantryItem } from "./kitchen";
import { createBudget } from "./money";
import { addItem, setActualPrice, setChecked } from "./shopping";

// Gospodăria model a modului demonstrativ (doar pe dispozitiv, nu se
// sincronizează): cămară, o listă activă, buget și istoric de cumpărături, ca
// fiecare ecran să arate cum se folosește. Prețurile de aici sunt DATE DE
// EXEMPLU pentru demonstrație; nu intră niciodată într-o gospodărie reală.

type Line = [product_id: string, quantity: number, unit: UnitCode, amount: number];

/** Coșul mare, o dată pe săptămână. */
const KAUFLAND: Line[] = [
  ["paine-alba", 2, "buc", 5.98],
  ["lapte-integral", 2, "l", 15.8],
  ["oua", 10, "buc", 12.9],
  ["iaurt-natural", 4, "buc", 9.96],
  ["unt", 1, "buc", 9.49],
  ["piept-pui", 1, "kg", 29.9],
  ["carne-tocata-porc-vita", 1, "kg", 32.9],
  ["telemea-vaca", 0.5, "kg", 17.5],
  ["paste-spaghete", 2, "pachet", 9.98],
  ["orez", 1, "kg", 7.49],
  ["ulei-floarea-soarelui", 1, "l", 8.99],
  ["cafea-macinata", 1, "pachet", 22.9],
  ["detergent-vase", 1, "sticla", 8.99],
  ["hartie-igienica", 8, "rola", 19.9],
  ["ciocolata", 2, "buc", 9.98],
];

/** Completarea de la mijlocul săptămânii. */
const LIDL: Line[] = [
  ["paine-alba", 1, "buc", 2.79],
  ["lapte-integral", 2, "l", 14.98],
  ["oua", 10, "buc", 11.99],
  ["banane", 1, "kg", 6.49],
  ["iaurt-natural", 4, "buc", 8.76],
  ["pulpe-pui", 1, "kg", 17.99],
  ["cascaval", 0.4, "kg", 15.96],
];

const PIATA: Line[] = [
  ["rosii", 2, "kg", 16],
  ["cartofi-albi", 3, "kg", 9],
  ["mere", 2, "kg", 8],
  ["ceapa-galbena", 1, "kg", 4],
  ["castraveti", 1, "kg", 8],
  ["ardei-gras", 1, "kg", 12],
  ["morcovi", 1, "kg", 4],
];

const TRIPS: { offset: number; retailer_id: string | null; source: PurchaseSource; lines: Line[] }[] = [
  { offset: 1, retailer_id: "kaufland", source: "supermarket", lines: KAUFLAND },
  { offset: 3, retailer_id: null, source: "piata", lines: PIATA },
  { offset: 5, retailer_id: "lidl", source: "supermarket", lines: LIDL },
];

/** Câte săptămâni de istoric (acoperă graficul pe 6 luni). */
export const DEMO_HISTORY_WEEKS = 26;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Istoricul: 3 ieșiri pe săptămână, cu ușoare variații deterministe (fără aleator). */
export function demoHistory(householdId: string, today: string, products: Map<string, { name: string; category_id: string }>) {
  const transactions: ShoppingTransaction[] = [];
  const items: ShoppingTransactionItem[] = [];
  const prices: ProductPrice[] = [];
  for (let week = 0; week < DEMO_HISTORY_WEEKS; week++) {
    for (const trip of TRIPS) {
      const date = addDays(today, -(week * 7 + trip.offset));
      const at = `${date}T10:00:00.000Z`;
      const meta = { household_id: householdId, created_at: at, updated_at: at, deleted_at: null };
      const txId = newId();
      transactions.push({ ...meta, id: txId, list_id: null, list_cycle: null, started_at: at, completed_at: at, note: null });
      // Nu se cumpără mereu tot: un produs din trei lipsește, prin rotație.
      const drift = 1 + ((week % 5) - 2) * 0.02;
      trip.lines.forEach(([product_id, quantity, unit, amount], i) => {
        if (trip.lines.length > 4 && (i + week) % 3 === 0) return;
        const itemId = newId();
        const paid = round2(amount * drift);
        items.push({ ...meta, id: itemId, transaction_id: txId, list_item_id: null, product_id, name: products.get(product_id)?.name ?? product_id, quantity, unit, category_id: products.get(product_id)?.category_id ?? "diverse", amount: paid, retailer_id: trip.retailer_id, source: trip.source, purchased_at: at });
        prices.push({ ...meta, id: newId(), product_id, retailer_id: trip.retailer_id, source: trip.source, amount: paid, currency: "RON", quantity, unit, price_type: "platit", confidence: "ridicata", observed_on: date, transaction_item_id: itemId });
      });
    }
  }
  return { transactions, items, prices };
}

/** Umple gospodăria demonstrativă (o singură dată, la prima pornire). */
export async function seedDemoExample(db: CamaraDB, householdId: string, userId: string): Promise<void> {
  const ctx: AppCtx = { db, householdId, userId, sync: false };
  // O pornire întreruptă la mijloc nu dublează datele: bugetul se scrie primul și e semnul că s-a început.
  if ((await db.budgets.where("household_id").equals(householdId).count()) > 0) return;
  await createBudget(ctx, { name: "Bugetul lunii", period: "lunar", scope: { kind: "total" }, amount: 2500 });
  const today = toISODate(now());
  const products = new Map((await db.products.toArray()).map((p) => [p.id, p]));

  // Istoricul de cumpărături și prețurile plătite.
  const history = demoHistory(householdId, today, products);
  await db.transaction("rw", [db.shopping_transactions, db.shopping_transaction_items, db.product_prices], async () => {
    await db.shopping_transactions.bulkPut(history.transactions);
    await db.shopping_transaction_items.bulkPut(history.items);
    await db.product_prices.bulkPut(history.prices);
  });

  // Cămara: 14 produse, unul expiră în 2 zile.
  const pantry: [string, number, UnitCode, string, number | null][] = [
    ["lapte-integral", 1, "l", "frigider", 5],
    ["oua", 6, "buc", "frigider", 14],
    ["iaurt-natural", 2, "buc", "frigider", 2],
    ["unt", 1, "buc", "frigider", 21],
    ["telemea-vaca", 0.4, "kg", "frigider", 9],
    ["smantana", 1, "buc", "frigider", 6],
    ["cascaval", 0.3, "kg", "frigider", 18],
    ["mazare-congelata", 1, "punga", "congelator", 120],
    ["piept-pui", 1, "kg", "congelator", 60],
    ["fasole-verde-congelata", 1, "punga", "congelator", 150],
    ["faina-alba", 1, "kg", "camara", 180],
    ["orez", 1, "kg", "camara", 300],
    ["ulei-floarea-soarelui", 1, "l", "camara", 210],
    ["paste-spaghete", 2, "pachet", "camara", 240],
  ];
  for (const [product_id, quantity, unit, location_id, days] of pantry) {
    await addPantryItem(ctx, { product_id, name: products.get(product_id)?.name ?? product_id, quantity, unit, location_id, purchased_on: addDays(today, -3), expires_on: days == null ? null : addDays(today, days) });
  }

  // Lista activă, recurentă, cu câteva produse deja luate.
  const list = (await db.shopping_lists.where("household_id").equals(householdId).toArray()).find((l) => !l.deleted_at);
  if (list) {
    const wanted: { product_id: string; quantity: number; unit: UnitCode; source?: PurchaseSource; paid?: number; checked?: boolean }[] = [
      { product_id: "paine-alba", quantity: 1, unit: "buc", paid: 2.99 },
      { product_id: "lapte-integral", quantity: 2, unit: "l", paid: 15.8 },
      { product_id: "oua", quantity: 10, unit: "buc", checked: true },
      { product_id: "piept-pui", quantity: 1, unit: "kg" },
      { product_id: "rosii", quantity: 1, unit: "kg", source: "piata" },
      { product_id: "cartofi-albi", quantity: 2, unit: "kg", source: "piata" },
      { product_id: "mere", quantity: 1, unit: "kg", source: "piata" },
      { product_id: "cafea-macinata", quantity: 1, unit: "pachet" },
      { product_id: "detergent-vase", quantity: 1, unit: "sticla" },
      { product_id: "ciocolata", quantity: 2, unit: "buc" },
    ];
    for (const x of wanted) {
      const id = await addItem(ctx, list.id, { product_id: x.product_id, quantity: x.quantity, unit: x.unit, source: x.source });
      if (x.paid != null) await setActualPrice(ctx, id, x.paid);
      else if (x.checked) await setChecked(ctx, id, true);
    }
  }

  // Planul meselor: 3 rețete în săptămâna curentă.
  const week = startOfWeek(today);
  const meals: [number, "pranz" | "cina", string][] = [
    [2, "pranz", "ciorba-de-legume"],
    [4, "cina", "mancare-de-mazare-cu-pui"],
    [6, "pranz", "sarmale"],
  ];
  for (const [d, slot, recipe_id] of meals) {
    if (await db.recipes.get(recipe_id)) await addMeal(ctx, { date: addDays(week, d), slot, recipe_id, servings: 4 });
  }
}
