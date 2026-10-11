"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, ShoppingBasket, Sparkles, Wallet } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Card, SectionTitle, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { RecipeVisual, SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { listItems, owned, priceIndex, spendRecords, visible } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { budgetStatus } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { expiringSoon, pantryStock } from "@/lib/domain/pantry";
import { totalMinutes, whatCanICook } from "@/lib/domain/recipes";
import { daysBetween, formatLongDate, localDateOf, toISODate } from "@/lib/domain/dates";
import { formatRon, sumMoney } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import { capitalizeFirst, count } from "@/lib/domain/text";
import type { MealSlot } from "@/lib/domain/types";

const SLOT_ORDER: MealSlot[] = ["mic_dejun", "pranz", "cina", "gustare"];

function greeting(): string {
  const h = now().getHours();
  if (h < 11) return "Bună dimineața";
  if (h < 18) return "Bună ziua";
  return "Bună seara";
}

export function HomeScreen() {
  const { displayName } = useApp();
  const { run } = useAction();
  const toast = useToast();
  const today = toISODate(now());

  const data = useData(async (ctx) => {
    const [lists, prices, budgets, spend, categories, meals, recipes, ingredients, pantry, txs] = await Promise.all([
      owned(ctx.db, "shopping_lists", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
      spendRecords(ctx.db, ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      owned(ctx.db, "meal_plan_items", ctx.householdId),
      visible(ctx.db, "recipes", ctx.householdId),
      visible(ctx.db, "recipe_ingredients", ctx.householdId),
      owned(ctx.db, "pantry_items", ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
    ]);
    const active = await Promise.all(
      lists.filter((l) => !l.archived_at).map(async (l) => ({ list: l, totals: listTotals(await listItems(ctx.db, l.id), prices) })),
    );
    // „Următoarea listă”: cea cu cele mai multe produse de luat (la egalitate, cea mai recentă).
    const next = active.sort((a, b) => b.totals.item_count - b.totals.checked_count - (a.totals.item_count - a.totals.checked_count) || b.list.updated_at.localeCompare(a.list.updated_at))[0] ?? null;
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const main = budgets.find((b) => b.active && b.period === "lunar" && (b.scope.kind === "total" || b.scope.kind === "alimente")) ?? budgets.find((b) => b.active);
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const todayMeals = meals
      .filter((m) => m.date === today)
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
      .map((m) => ({ meal: m, recipe: recipeMap.get(m.recipe_id) }));
    const cook = whatCanICook(recipes, ingredients, pantryStock(pantry), 0.6).slice(0, 3);
    // Fără cămară completată: trei rețete rapide, altele în fiecare zi.
    const quick = recipes.filter((r) => totalMinutes(r) <= 30).sort((a, b) => a.id.localeCompare(b.id));
    const start = quick.length ? Number(today.replace(/-/g, "")) % quick.length : 0;
    const suggestions = cook.length
      ? cook.map((c) => ({ recipe: c.recipe, why: c.missing.length ? `${c.missing.length === 1 ? "lipsește 1 ingredient" : `lipsesc ${c.missing.length} ingrediente`}` : "ai tot ce trebuie" }))
      : [...quick.slice(start), ...quick.slice(0, start)].slice(0, 3).map((r) => ({ recipe: r, why: `gata în ${totalMinutes(r)} min` }));
    const recent = txs
      .filter((t) => t.completed_at)
      .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
      .slice(0, 3)
      .map((t) => {
        const items = spend.filter((s) => s.transaction_id === t.id);
        return { id: t.id, date: localDateOf(t.completed_at!), total: sumMoney(items.map((i) => i.amount ?? 0)), count: items.length, name: lists.find((l) => l.id === t.list_id)?.name ?? "Cumpărături" };
      });
    return {
      next,
      listCount: active.length,
      budget: main ? budgetStatus(main, spend, catMap, today) : null,
      todayMeals,
      expiring: expiringSoon(pantry, today, 3).slice(0, 4),
      suggestions,
      recent,
    };
  });

  if (!data) return <Spinner />;

  async function quickAdd(productId: string | null, text: string, quantity: number | null, unit: string | null) {
    const res = await run(async (ctx) => {
      const listId = data!.next?.list.id ?? (await createList(ctx, { name: "Cumpărături săptămânale", is_recurring: true }));
      await addItem(ctx, listId, { product_id: productId, name: productId ? undefined : text, quantity, unit: unit as never });
      return true;
    });
    if (res) toast(`Adăugat în „${data!.next?.list.name ?? "Cumpărături săptămânale"}”.`);
  }

  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-ink-2">{capitalizeFirst(formatLongDate(today))}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}!
        </h1>
      </header>

      <ProductSearch placeholder="Adaugă rapid pe listă: ex. lapte" onPick={({ product, parsed }) => quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/buget/" className="block">
          <Card className="h-full p-4 hover:bg-surface-2">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Wallet size={16} /> Bugetul lunii
            </p>
            {data.budget ? (
              <>
                <p className={`mt-1 text-2xl font-semibold tabular ${data.budget.over ? "text-accent" : ""}`}>
                  {data.budget.over ? `−${formatRon(-data.budget.remaining)}` : formatRon(data.budget.remaining)}
                </p>
                <p className="mb-2 text-xs text-ink-2 tabular">
                  {data.budget.over ? "peste buget" : "rămași"} · cheltuit {formatRon(data.budget.spent)} din {formatRon(data.budget.budget.amount)}
                </p>
                <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />
              </>
            ) : (
              <p className="mt-1 text-[15px]">Setează cât vrei să cheltui pe lună →</p>
            )}
          </Card>
        </Link>

        <Link href={data.next ? `/cumparaturi/lista/?id=${data.next.list.id}` : "/cumparaturi/"} className="block">
          <Card className="h-full p-4 hover:bg-surface-2">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <ShoppingBasket size={16} /> Următoarea listă
            </p>
            {data.next ? (
              <>
                <p className="mt-1 truncate text-lg font-semibold">{data.next.list.name}</p>
                <p className="text-sm text-ink-2 tabular">
                  {count(data.next.totals.item_count - data.next.totals.checked_count, "produs", "produse")} de luat
                  {data.next.totals.remaining_estimate > 0 && ` · ~${formatRon(data.next.totals.remaining_estimate)}`}
                  {data.next.totals.unknown_price_count > 0 && ` · ${data.next.totals.unknown_price_count} fără preț`}
                </p>
                {data.listCount > 1 && <p className="mt-1 text-xs text-ink-2">și încă {data.listCount - 1} {data.listCount === 2 ? "listă" : "liste"}</p>}
              </>
            ) : (
              <p className="mt-1 text-[15px]">Creează prima listă →</p>
            )}
          </Card>
        </Link>
      </div>

      <SectionTitle action={<Link href="/plan/" className="text-sm font-medium text-brand">Planul</Link>}>Azi la masă</SectionTitle>
      {data.todayMeals.length === 0 ? (
        <Link href="/plan/" className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-line px-4 text-[15px] text-ink-2 hover:bg-surface">
          <CalendarDays size={20} /> Nimic planificat azi. Planifică mesele săptămânii.
        </Link>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.todayMeals.map(({ meal, recipe }) => (
            <li key={meal.id}>
              <Link href={recipe ? `/retete/reteta/?id=${recipe.id}` : "/plan/"} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2">
                {recipe && <RecipeVisual recipe={recipe} size="sm" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2">{SLOT_LABELS[meal.slot]}</span>
                  <span className="block truncate font-medium">{recipe?.name ?? "Rețetă ștearsă"}</span>
                </span>
                <span className="text-xs text-ink-2">{meal.servings} porții</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.expiring.length > 0 && (
        <>
          <SectionTitle action={<Link href="/camara/" className="text-sm font-medium text-brand">Cămara</Link>}>Expiră curând</SectionTitle>
          <Card className="divide-y divide-line">
            {data.expiring.map((i) => {
              const d = daysBetween(today, i.expires_on!);
              return (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <AlertTriangle size={16} className={d < 0 ? "text-accent" : "text-warn"} />
                  <span className="flex-1 text-[15px]">{i.name}</span>
                  <span className={`text-sm ${d < 0 ? "text-accent" : "text-warn"}`}>{d < 0 ? "expirat" : d === 0 ? "azi" : d === 1 ? "mâine" : `în ${d} zile`}</span>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {data.suggestions.length > 0 && (
        <>
          <SectionTitle action={<Link href="/retete/" className="text-sm font-medium text-brand">Toate rețetele</Link>}>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={14} /> Rețete sugerate
            </span>
          </SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-3">
            {data.suggestions.map(({ recipe, why }) => (
              <li key={recipe.id}>
                <Link href={`/retete/reteta/?id=${recipe.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2 sm:flex-col sm:items-start">
                  <RecipeVisual recipe={recipe} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{recipe.name}</span>
                    <span className="text-xs text-ink-2">{why}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.recent.length > 0 && (
        <>
          <SectionTitle action={<Link href="/cumparaturi/istoric/" className="text-sm font-medium text-brand">Istoric</Link>}>Cheltuieli recente</SectionTitle>
          <Card className="divide-y divide-line">
            {data.recent.map((t) => (
              <Link key={t.id} href="/cumparaturi/istoric/" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{t.name}</span>
                  <span className="text-xs text-ink-2">
                    {capitalizeFirst(formatLongDate(t.date))} · {count(t.count, "produs", "produse")}
                  </span>
                </span>
                <span className="font-medium tabular">{formatRon(t.total)}</span>
                <ChevronRight size={16} className="text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
