"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Card, SectionTitle, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { listItems, owned, priceIndex, spendRecords, visible } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { SOURCE_LABELS, budgetStatus } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { expiringSoon, pantryStock } from "@/lib/domain/pantry";
import { mealForHour, recipesForMeal, totalMinutes, whatCanICook, type SuggestedMeal } from "@/lib/domain/recipes";
import { daysBetween, formatLongDate, localDateOf, toISODate } from "@/lib/domain/dates";
import { formatRon, sumMoney } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import { capitalizeFirst, count } from "@/lib/domain/text";
import type { MealSlot } from "@/lib/domain/types";

const SLOT_ORDER: MealSlot[] = ["mic_dejun", "pranz", "cina", "gustare"];

/** Titlul sugestiilor după masa din acest moment (.tasks/016). */
const MEAL_TITLES: Record<SuggestedMeal, string> = { mic_dejun: "Pentru micul dejun", pranz: "Pentru prânz", cina: "Pentru cină" };

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
  const meal = mealForHour(now().getHours());

  const data = useData(async (ctx) => {
    const [lists, prices, budgets, spend, categories, meals, recipes, ingredients, pantry, txs, retailers] = await Promise.all([
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
      visible(ctx.db, "retailers", ctx.householdId),
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
    // Rețetele mesei din acest moment: dimineața mic dejun, apoi prânz, seara cină.
    const forMeal = recipesForMeal(recipes, meal);
    const cook = whatCanICook(forMeal, ingredients, pantryStock(pantry), 0.6, prices.product_units).slice(0, 3);
    // Fără cămară completată: trei rețete rapide, altele în fiecare zi.
    // Cu sub trei rețete rapide pentru masa asta, toate rețetele mesei.
    const fast = forMeal.filter((r) => totalMinutes(r) <= 30);
    const quick = [...(fast.length >= 3 ? fast : forMeal)].sort((a, b) => a.id.localeCompare(b.id));
    const start = quick.length ? Number(today.replace(/-/g, "")) % quick.length : 0;
    const suggestions = cook.length
      ? cook.map((c) => ({ recipe: c.recipe, why: c.missing.length ? `${c.missing.length === 1 ? "lipsește 1 ingredient" : `lipsesc ${c.missing.length} ingrediente`}` : "ai tot ce trebuie" }))
      : [...quick.slice(start), ...quick.slice(0, start)].slice(0, 3).map((r) => ({ recipe: r, why: `gata în ${totalMinutes(r)} min` }));
    const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
    const recent = txs
      .filter((t) => t.completed_at)
      .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
      .slice(0, 3)
      .map((t) => {
        const items = spend.filter((s) => s.transaction_id === t.id);
        // Magazinul (sau sursa: piață, producător), ca în Istoric; fără ele, numele listei (decizia proprietarului, 18 oct. 2026).
        const places = [...new Set(items.map((i) => (i.retailer_id ? (retailerName.get(i.retailer_id) ?? "") : i.source !== "supermarket" ? SOURCE_LABELS[i.source] : "")).filter(Boolean))];
        return { id: t.id, date: localDateOf(t.completed_at!), total: sumMoney(items.map((i) => i.amount ?? 0)), count: items.length, name: places.join(", ") || (lists.find((l) => l.id === t.list_id)?.name ?? "Cumpărături") };
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
  }, [meal]);

  if (!data) return <Spinner />;

  async function quickAdd(productId: string | null, text: string, quantity: number | null, unit: string | null) {
    const res = await run(async (ctx) => {
      const listId = data!.next?.list.id ?? (await createList(ctx, { name: "Cumpărături săptămânale", is_recurring: true }));
      await addItem(ctx, listId, { product_id: productId, name: productId ? undefined : text, quantity, unit: unit as never });
      return true;
    });
    if (res) toast(`Adăugat în „${data!.next?.list.name ?? "Cumpărături săptămânale"}”.`);
  }

  const LABEL = "text-xs font-semibold uppercase tracking-wider text-ink-2";
  const ROW = "transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2";

  return (
    <>
      <header className="mb-5">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">{capitalizeFirst(formatLongDate(today))}</p>
        <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}!
        </h1>
      </header>

      <ProductSearch placeholder="Adaugă rapid pe listă: ex. lapte" onPick={({ product, parsed }) => quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)} />

      {/* Registrul: bugetul și următoarea listă pe aceeași foaie (decizia proprietarului, 18 oct. 2026). */}
      <Card className="mt-4 grid divide-y divide-line overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Link href="/buget/" className={`block p-4 ${ROW}`}>
          <p className={LABEL}>Bugetul lunii</p>
          {data.budget ? (
            <>
              <p className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className={`font-mono text-[26px] font-medium leading-none tracking-tight ${data.budget.over ? "text-accent" : "text-ink"}`}>
                  {data.budget.over ? `−${formatRon(-data.budget.remaining)}` : formatRon(data.budget.remaining)}
                </span>
                <span className="text-sm text-ink-2">{data.budget.over ? "peste buget" : "rămași"}</span>
              </p>
              <p className="mb-3 mt-1.5 font-mono text-xs text-ink-2">
                cheltuit {formatRon(data.budget.spent)} din {formatRon(data.budget.budget.amount)}
              </p>
              <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />
            </>
          ) : (
            <p className="mt-1.5 text-[15px]">Setează cât vrei să cheltui pe lună →</p>
          )}
        </Link>

        <Link href={data.next ? `/cumparaturi/lista/?id=${data.next.list.id}` : "/cumparaturi/"} className={`flex items-center gap-3 p-4 ${ROW}`}>
          <span className="min-w-0 flex-1">
            <span className={`block ${LABEL}`}>Următoarea listă</span>
            {data.next ? (
              <>
                <span className="mt-1 line-clamp-2 font-serif text-xl font-semibold leading-snug">{data.next.list.name}</span>
                <span className="block text-sm text-ink-2">
                  {count(data.next.totals.item_count - data.next.totals.checked_count, "produs", "produse")} de luat
                  {data.next.totals.remaining_estimate > 0 && ` · ~${formatRon(data.next.totals.remaining_estimate)}`}
                  {data.next.totals.unknown_price_count > 0 && ` · ${data.next.totals.unknown_price_count} fără preț`}
                </span>
                {data.listCount > 1 && <span className="mt-1 block text-xs text-ink-2">și încă {data.listCount - 1} {data.listCount === 2 ? "listă" : "liste"}</span>}
              </>
            ) : (
              <span className="mt-1.5 block text-[15px]">Creează prima listă →</span>
            )}
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        </Link>
      </Card>

      <SectionTitle action={<Link href="/plan/" className="text-sm font-medium text-brand">Planul</Link>}>Azi la masă</SectionTitle>
      {data.todayMeals.length === 0 ? (
        <Link href="/plan/" className="flex min-h-14 items-center gap-3 rounded-lg border border-dashed border-line px-4 text-[15px] text-ink-2 transition-colors duration-150 ease-out hover:bg-surface">
          <CalendarDays size={20} strokeWidth={1.75} /> Nimic planificat azi. Planifică mesele săptămânii.
        </Link>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {data.todayMeals.map(({ meal, recipe }) => (
            <li key={meal.id}>
              <Link href={recipe ? `/retete/reteta/?id=${recipe.id}` : "/plan/"} className={`flex items-center gap-3 py-3 ${ROW}`}>
                {recipe && <RecipeImage recipe={recipe} size="sm" avatar />}
                <span className="min-w-0 flex-1">
                  <span className={`block ${LABEL}`}>{SLOT_LABELS[meal.slot]}</span>
                  <span className="mt-0.5 line-clamp-2 font-serif text-lg font-medium leading-snug">{recipe?.name ?? "Rețetă ștearsă"}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-2">{meal.servings} porții</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.expiring.length > 0 && (
        <>
          <SectionTitle action={<Link href="/camara/" className="text-sm font-medium text-brand">Cămara</Link>}>Expiră curând</SectionTitle>
          {/* Etichete de borcan: chenar punctat terracotta, termenul ca o ștampilă (decizia proprietarului, 18 oct. 2026). */}
          <ul className="flex flex-col gap-2">
            {data.expiring.map((i) => {
              const d = daysBetween(today, i.expires_on!);
              return (
                <li key={i.id} className={`flex items-center gap-3 rounded-md border border-dashed border-accent px-3.5 py-2.5 ${d < 0 ? "bg-accent-soft" : "bg-surface"}`}>
                  <span className="min-w-0 flex-1 text-[15px] text-ink">{i.name}</span>
                  <span className="shrink-0 font-mono text-xs font-medium uppercase tracking-wider text-accent">{d < 0 ? "expirat" : d === 0 ? "azi" : d === 1 ? "mâine" : `în ${d} zile`}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data.suggestions.length > 0 && (
        <>
          <SectionTitle action={<Link href="/retete/" className="text-sm font-medium text-brand">Toate rețetele</Link>}>{MEAL_TITLES[meal]}</SectionTitle>
          <Card as="section" aria-label={MEAL_TITLES[meal]} className="divide-y divide-line overflow-hidden">
            {data.suggestions.map(({ recipe, why }) => (
              <Link key={recipe.id} href={`/retete/reteta/?id=${recipe.id}`} className={`flex items-center gap-3 px-3 py-3 ${ROW}`}>
                <RecipeImage recipe={recipe} size="sm" avatar />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-serif text-[17px] font-medium leading-snug">{recipe.name}</span>
                  <span className="text-xs text-ink-2">{why}</span>
                </span>
                <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      )}

      {data.recent.length > 0 && (
        <>
          <SectionTitle action={<Link href="/cumparaturi/istoric/" className="text-sm font-medium text-brand">Istoric</Link>}>Cheltuieli recente</SectionTitle>
          {/* Registru: magazinul, data și numărul de produse, suma aliniată la dreapta. */}
          <Card className="divide-y divide-dashed divide-line overflow-hidden">
            {data.recent.map((t) => (
              <Link key={t.id} href="/cumparaturi/istoric/" className={`flex items-center gap-3 px-4 py-3 ${ROW}`}>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug">{t.name}</span>
                  <span className="block text-xs leading-snug text-ink-2">
                    {capitalizeFirst(formatLongDate(t.date))} · <span className="whitespace-nowrap">{count(t.count, "produs", "produse")}</span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[15px] font-medium">{formatRon(t.total)}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
