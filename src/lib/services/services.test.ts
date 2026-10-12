import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { addItem, createList, duplicateList, finalizeShopping, moveItem, setActualPrice, setChecked, updateList } from "./shopping";
import { addMeal, addPantryItem, addRecipeToList, cookRecipe, generateListFromPlan, saveRecipe, toggleFavorite } from "./kitchen";
import { createBudget, recordPrice } from "./money";
import { createProduct, productSearchIndex } from "./catalog";
import { listItems, owned, priceIndex, spendRecords } from "./queries";

const listItemsForTest = (c: AppCtx, id: string) => listItems(c.db, id);
import { budgetStatus } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { recipeCost } from "@/lib/domain/recipes";
import { search } from "@/lib/domain/search";

let ctx: AppCtx;

beforeEach(async () => {
  setClock("2026-03-08T09:00:00.000Z"); // duminică
  const db = new CamaraDB(`svc-${Math.random()}`);
  await seedCatalog(db);
  ctx = { db, householdId: "h1", userId: "u1", sync: true };
});
afterEach(() => setClock(null));

async function twoRecipes() {
  const a = await saveRecipe(ctx, {
    name: "Pui cu ceapă",
    categories: ["cina"],
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 30,
    difficulty: "usor",
    ingredients: [
      { product_id: "piept-pui", quantity: 500, unit: "g" },
      { product_id: "ceapa-galbena", quantity: 1, unit: "buc" },
      { product_id: "sare", quantity: null, unit: null },
    ],
    steps: ["Gătește."],
  });
  const b = await saveRecipe(ctx, {
    name: "Pui cu smântână",
    categories: ["pranz"],
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 20,
    difficulty: "usor",
    ingredients: [
      { product_id: "piept-pui", quantity: 300, unit: "g" },
      { product_id: "smantana", quantity: 3, unit: "lingura" },
    ],
    steps: ["Gătește."],
  });
  return { a, b };
}

describe("de la plan la buget (experiența centrală)", () => {
  it("planifică, generează lista consolidată, cumpără, actualizează bugetul și păstrează istoricul", async () => {
    const { a, b } = await twoRecipes();
    await addMeal(ctx, { date: "2026-03-09", slot: "cina", recipe_id: a, servings: 4 });
    await addMeal(ctx, { date: "2026-03-10", slot: "pranz", recipe_id: b, servings: 4 });
    await addPantryItem(ctx, { product_id: "piept-pui", name: "Piept de pui", quantity: 200, unit: "g", location_id: "congelator" });

    const listId = await createList(ctx, { name: "Săptămâna 10" });
    const r = await generateListFromPlan(ctx, { from: "2026-03-09", to: "2026-03-15", listId, subtractPantry: true });
    expect(r.meals).toBe(2);

    const items = await listItemsForTest(ctx, listId);
    const pui = items.filter((i) => i.product_id === "piept-pui");
    expect(pui).toHaveLength(1); // o singură linie, nu două
    expect(pui[0]).toMatchObject({ quantity: 600, unit: "g", origin: "plan" }); // 500 + 300 − 200 din cămară
    expect(items.find((i) => i.product_id === "smantana")).toMatchObject({ quantity: 1, unit: "buc", note: "pentru rețete: 45 ml" });
    expect(items.find((i) => i.product_id === "sare")).toMatchObject({ quantity: null });

    // Prețuri cunoscute → estimare; produsele fără preț sunt semnalate.
    await recordPrice(ctx, { product_id: "piept-pui", amount: 30, quantity: 1, unit: "kg", source: "supermarket", retailer_id: "kaufland", observed_on: "2026-03-01" });
    const prices = await priceIndex(ctx.db, ctx.householdId);
    const before = listTotals(await listItemsForTest(ctx, listId), prices);
    expect(before.estimated_total).toBe(18);
    expect(before.unknown_price_count).toBe(3);

    const budgetId = await createBudget(ctx, { name: "Alimente", period: "lunar", scope: { kind: "total" }, amount: 1000 });
    const budget = (await ctx.db.budgets.get(budgetId))!;
    const categories = new Map((await ctx.db.product_categories.toArray()).map((c) => [c.id, c]));

    // În magazin: bifează și introduce prețul real → bugetul se actualizează imediat.
    await setActualPrice(ctx, pui[0].id, 19.5);
    const smantana = items.find((i) => i.product_id === "smantana")!;
    await setChecked(ctx, smantana.id, true);
    let status = budgetStatus(budget, await spendRecords(ctx.db, ctx.householdId), categories, "2026-03-08");
    expect(status.spent).toBe(19.5);
    expect(status.items_without_amount).toBe(1);

    // Finalizare: cheltuiala nu se dublează, prețul plătit intră în istoric, produsele intră în cămară.
    const fin = await finalizeShopping(ctx, listId, { addToPantry: true });
    expect(fin).toMatchObject({ total: 19.5, items: 2, without_price: 1, added_to_pantry: 2 });
    status = budgetStatus(budget, await spendRecords(ctx.db, ctx.householdId), categories, "2026-03-08");
    expect(status.spent).toBe(19.5);
    expect(status.remaining).toBe(980.5);
    expect((await ctx.db.shopping_lists.get(listId))?.archived_at).not.toBeNull();
    const paid = (await owned(ctx.db, "product_prices", ctx.householdId)).filter((p) => p.price_type === "platit");
    expect(paid).toMatchObject([{ product_id: "piept-pui", amount: 19.5, quantity: 600, unit: "g", observed_on: "2026-03-08" }]);
    const pantry = await owned(ctx.db, "pantry_items", ctx.householdId);
    expect(pantry.filter((p) => p.product_id === "piept-pui").map((p) => p.location_id).sort()).toEqual(["congelator", "frigider"]);
  });

  it("dacă doi membri finalizează aceeași tură, cheltuiala apare o singură dată", async () => {
    const listId = await createList(ctx, { name: "Lidl" });
    const id = await addItem(ctx, listId, { product_id: "lapte-integral", quantity: 2, unit: "l" });
    await setActualPrice(ctx, id, 15);
    const first = await finalizeShopping(ctx, listId, { addToPantry: false });
    // Al doilea telefon încă vede tura 1 (offline): repetă finalizarea pe aceeași tură.
    await updateList(ctx, listId, {});
    await ctx.db.shopping_lists.update(listId, { cycle: 1, archived_at: null });
    const second = await finalizeShopping(ctx, listId, { addToPantry: false });
    expect(second.transaction_id).toBe(first.transaction_id);
    const spend = await spendRecords(ctx.db, ctx.householdId);
    expect(spend.filter((s) => s.amount === 15)).toHaveLength(1);
  });

  it("lista recurentă se golește de bifări după finalizare și pornește o tură nouă", async () => {
    const listId = await createList(ctx, { name: "Săptămânală", is_recurring: true });
    const id = await addItem(ctx, listId, { product_id: "paine-alba", quantity: 1 });
    await setActualPrice(ctx, id, 5);
    await finalizeShopping(ctx, listId, { addToPantry: false });
    const list = await ctx.db.shopping_lists.get(listId);
    expect(list).toMatchObject({ cycle: 2, archived_at: null });
    expect(await ctx.db.shopping_list_items.get(id)).toMatchObject({ checked: false, actual_price: null });
    await setActualPrice(ctx, id, 6);
    const second = await finalizeShopping(ctx, listId, { addToPantry: false });
    const spend = await spendRecords(ctx.db, ctx.householdId);
    expect(spend.map((s) => s.amount).sort()).toEqual([5, 6]);
    expect(second.total).toBe(6);
  });

  it("un produs mutat în altă listă nu se numără de două ori", async () => {
    const l1 = await createList(ctx, { name: "Kaufland" });
    const l2 = await createList(ctx, { name: "Piață" });
    const id = await addItem(ctx, l1, { product_id: "rosii", quantity: 2 });
    await setActualPrice(ctx, id, 20);
    await moveItem(ctx, id, l2);
    const spend = await spendRecords(ctx.db, ctx.householdId);
    expect(spend.filter((s) => s.list_item_id === id)).toHaveLength(1);
  });
});

describe("liste", () => {
  it("adăugarea aceluiași produs mărește cantitatea, nu dublează linia", async () => {
    const listId = await createList(ctx, { name: "Test" });
    const a = await addItem(ctx, listId, { product_id: "cartofi-albi", quantity: 1, unit: "kg" });
    const b = await addItem(ctx, listId, { product_id: "cartofi-albi", quantity: 500, unit: "g" });
    expect(b).toBe(a);
    expect(await ctx.db.shopping_list_items.get(a)).toMatchObject({ quantity: 1.5, unit: "kg" });
  });

  it("produsele personalizate se adaugă și fără catalog", async () => {
    const listId = await createList(ctx, { name: "Test" });
    const id = await addItem(ctx, listId, { name: "Cadou pentru bunica", category_id: "diverse", estimated_price: 50 });
    expect(await ctx.db.shopping_list_items.get(id)).toMatchObject({ product_id: null, name: "Cadou pentru bunica", estimated_price: 50 });
  });

  it("refuză date invalide cu mesaje pe înțeles", async () => {
    const listId = await createList(ctx, { name: "Test" });
    await expect(createList(ctx, { name: "   " })).rejects.toThrow("Numele listei nu poate fi gol.");
    await expect(addItem(ctx, listId, { name: "X", quantity: -1 })).rejects.toThrow("Cantitatea trebuie să fie mai mare decât zero.");
    await expect(setActualPrice(ctx, "nu-exista", 3)).rejects.toThrow("Produsul nu mai există în listă.");
  });

  it("duplicarea copiază produsele nebifate, fără prețurile plătite", async () => {
    const listId = await createList(ctx, { name: "Weekend" });
    const id = await addItem(ctx, listId, { product_id: "bere", quantity: 6 });
    await setActualPrice(ctx, id, 30);
    const copy = await duplicateList(ctx, listId);
    const items = await listItemsForTest(ctx, copy);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ product_id: "bere", quantity: 6, checked: false, actual_price: null });
    expect((await ctx.db.shopping_lists.get(copy))?.name).toBe("Weekend (copie)");
  });
});

describe("rețete și cămară", () => {
  it("rețeta păstrează fotografia din catalog (cale relativă) și refuză adresele nesigure", async () => {
    const base = { name: "Ciorbă", categories: ["supe_ciorbe" as const], servings: 4, prep_minutes: 10, cook_minutes: 30, difficulty: "usor" as const, ingredients: [{ product_id: "zahar", quantity: null, unit: null }], steps: ["Fierbe."] };
    const r = await saveRecipe(ctx, { ...base, image_url: "/retete/ciorba-perisoare.webp" });
    expect((await ctx.db.recipes.get(r))?.image_url).toBe("/retete/ciorba-perisoare.webp");
    await expect(saveRecipe(ctx, { ...base, image_url: "javascript:alert(1)" })).rejects.toThrow();
  });

  it("zahărul cu lingura se convertește în grame cu densitatea aprobată: lista, cămara, costul", async () => {
    const r = await saveRecipe(ctx, {
      name: "Clătite dulci",
      categories: ["deserturi"],
      servings: 4,
      prep_minutes: 10,
      cook_minutes: 20,
      difficulty: "usor",
      ingredients: [{ product_id: "zahar", quantity: 2, unit: "lingura" }],
      steps: ["Amestecă."],
    });
    const empty = await createList(ctx, { name: "Fără cămară" });
    await addRecipeToList(ctx, { recipeId: r, servings: 4, listId: empty, onlyMissing: false });
    // 2 linguri × 15 ml × 0,85 g/ml = 25,5 g (înainte: „1 kg”).
    expect((await listItemsForTest(ctx, empty))[0]).toMatchObject({ product_id: "zahar", quantity: 25.5, unit: "g", note: "pentru rețete: 30 ml" }); // nevoile se adună în ml

    await addPantryItem(ctx, { product_id: "zahar", name: "Zahăr", quantity: 1, unit: "kg", location_id: "camara" });
    const listId = await createList(ctx, { name: "Cu cămară" });
    expect((await addRecipeToList(ctx, { recipeId: r, servings: 4, listId, onlyMissing: true })).covered).toBe(1);

    await recordPrice(ctx, { product_id: "zahar", amount: 6, quantity: 1, unit: "kg", source: "supermarket", observed_on: "2026-03-01" });
    const recipe = (await ctx.db.recipes.get(r))!;
    const ings = (await ctx.db.recipe_ingredients.where("recipe_id").equals(r).toArray()).filter((i) => !i.deleted_at);
    expect(recipeCost(recipe, ings, 4, await priceIndex(ctx.db, ctx.householdId))).toMatchObject({ total: 0.15, complete: true });
  });

  it("ceapa la bucată se convertește în kg cu greutatea aprobată: lista, cămara, costul, „am gătit”", async () => {
    const { a } = await twoRecipes(); // 1 ceapă la 4 porții
    const empty = await createList(ctx, { name: "Fără cămară" });
    await addRecipeToList(ctx, { recipeId: a, servings: 40, listId: empty, onlyMissing: false });
    const onion = (await listItemsForTest(ctx, empty)).find((i) => i.product_id === "ceapa-galbena")!;
    // 10 cepe × 150 g = 1,5 kg (înainte: „1 kg” oricât ar fi cerut rețetele).
    expect(onion).toMatchObject({ quantity: 1.5, unit: "kg", note: "pentru rețete: 10 buc" });

    await addPantryItem(ctx, { product_id: "ceapa-galbena", name: "Ceapă", quantity: 2, unit: "kg", location_id: "camara" });
    const listId = await createList(ctx, { name: "Cu cămară" });
    const r = await addRecipeToList(ctx, { recipeId: a, servings: 40, listId, onlyMissing: true });
    expect(r.covered).toBe(1);
    expect((await listItemsForTest(ctx, listId)).some((i) => i.product_id === "ceapa-galbena")).toBe(false);

    await recordPrice(ctx, { product_id: "ceapa-galbena", amount: 5, quantity: 1, unit: "kg", source: "piata", observed_on: "2026-03-01" });
    const recipe = (await ctx.db.recipes.get(a))!;
    const ings = (await ctx.db.recipe_ingredients.where("recipe_id").equals(a).toArray()).filter((i) => !i.deleted_at);
    const cost = recipeCost(recipe, ings, 8, await priceIndex(ctx.db, ctx.householdId));
    expect(cost.missing_product_ids).not.toContain("ceapa-galbena"); // 2 cepe = 300 g = 1,50 lei

    await cookRecipe(ctx, a, 8);
    const pantry = (await owned(ctx.db, "pantry_items", ctx.householdId)).find((i) => i.product_id === "ceapa-galbena")!;
    expect(pantry).toMatchObject({ quantity: 1.7, unit: "kg" });
  });

  it("adaugă doar ingredientele lipsă și calculează costul cu prețurile cunoscute", async () => {
    const { a } = await twoRecipes();
    await addPantryItem(ctx, { product_id: "ceapa-galbena", name: "Ceapă", quantity: 5, unit: "buc", location_id: "camara" });
    const listId = await createList(ctx, { name: "Rețete" });
    const r = await addRecipeToList(ctx, { recipeId: a, servings: 8, listId, onlyMissing: true });
    expect(r.covered).toBe(1);
    const items = (await listItemsForTest(ctx, listId)).sort((x, y) => x.sort_order - y.sort_order);
    expect(items.map((i) => [i.product_id, i.quantity, i.unit])).toEqual([
      ["piept-pui", 1, "kg"],
      ["sare", null, null],
    ]);
    await recordPrice(ctx, { product_id: "piept-pui", amount: 28, quantity: 1, unit: "kg", source: "supermarket", observed_on: "2026-03-01" });
    const recipe = (await ctx.db.recipes.get(a))!;
    const ings = (await ctx.db.recipe_ingredients.where("recipe_id").equals(a).toArray()).filter((i) => !i.deleted_at);
    const cost = recipeCost(recipe, ings, 4, await priceIndex(ctx.db, ctx.householdId));
    expect(cost).toMatchObject({ total: 14, per_serving: 3.5, complete: false, coverage_pct: 50 });
  });

  it("gătitul scade ingredientele din cămară", async () => {
    const { a } = await twoRecipes();
    const id = await addPantryItem(ctx, { product_id: "piept-pui", name: "Piept de pui", quantity: 1, unit: "kg", location_id: "frigider" });
    const r = await cookRecipe(ctx, a, 4);
    expect((await ctx.db.pantry_items.get(id))?.quantity).toBe(0.5);
    expect(r.shortfall.map((s) => s.product_id)).toEqual(["ceapa-galbena"]);
  });

  it("favoritele au un singur rând per rețetă și se pot scoate", async () => {
    expect(await toggleFavorite(ctx, "sarmale")).toBe(true);
    expect(await toggleFavorite(ctx, "sarmale")).toBe(false);
    expect(await toggleFavorite(ctx, "sarmale")).toBe(true);
    expect(await ctx.db.favorite_recipes.count()).toBe(1);
  });
});

describe("catalog", () => {
  it("găsește produse românești după sinonime și produse proprii", async () => {
    await createProduct(ctx, { name: "Zacuscă de la mama", category_id: "conserve", default_unit: "borcan", aliases: ["zacusca mamei"] });
    const index = await productSearchIndex(ctx);
    expect(search(index, "tomate")[0].doc.id).toBe("rosii");
    expect(search(index, "barabule")[0].doc.id).toBe("cartofi-albi");
    expect(search(index, "zacusca mamei")[0].doc.name).toBe("Zacuscă de la mama");
    await expect(createProduct(ctx, { name: "Roșii", category_id: "legume", default_unit: "kg" })).rejects.toThrow("există deja");
  });

  it("are tot catalogul în baza locală după pornire", async () => {
    expect(await ctx.db.products.count()).toBeGreaterThanOrEqual(300);
    expect(await ctx.db.recipes.count()).toBeGreaterThanOrEqual(80);
    expect(await ctx.db.outbox.count()).toBe(0); // catalogul nu se trimite la server
  });
});
