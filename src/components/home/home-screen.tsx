"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Wallet, ShoppingBasket, Archive } from "lucide-react";
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
      expiringCount: expiringSoon(pantry, today, 3).length,
      suggestions,
      recent,
    };
  }, [meal, today]);

  if (!data) return <Spinner />;

  async function quickAdd(productId: string | null, text: string, quantity: number | null, unit: string | null) {
    const res = await run(async (ctx) => {
      const listId = data!.next?.list.id ?? (await createList(ctx, { name: "Cumpărături săptămânale", is_recurring: true }));
      await addItem(ctx, listId, { product_id: productId, name: productId ? undefined : text, quantity, unit: unit as never });
      return true;
    });
    if (res) toast(`Adăugat în „${data!.next?.list.name ?? "Cumpărături săptămânale"}”.`);
  }

  const LABEL = "text-xs font-semibold tracking-wide text-ink-2";
  const ROW = "transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-2">{capitalizeFirst(formatLongDate(today))}</p>
        <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">Acasă</h1>
        <p className="mt-1 text-sm text-ink-2">{greeting()}{displayName ? `, ${displayName}` : ""}!</p>
      </header>

      <Card className="overflow-hidden">
        <Link href="/buget/" className={`block p-5 ${ROW}`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand"><Wallet size={19} aria-hidden /> Bugetul lunii</p>
          {data.budget ? (
            <>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`text-[32px] font-bold leading-tight tracking-tight ${data.budget.over ? "text-accent" : "text-ink"}`}>
                  {data.budget.over ? `−${formatRon(-data.budget.remaining)}` : formatRon(data.budget.remaining)}
                </span>
                <span className="text-sm text-ink-2">{data.budget.over ? "peste buget" : "rămași"}</span>
              </p>
              <p className="mb-3 mt-1.5 text-xs text-ink-2">
                cheltuit {formatRon(data.budget.spent)} din {formatRon(data.budget.budget.amount)}
              </p>
              <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />
            </>
          ) : (
            <p className="mt-3 text-[15px]">Setează cât vrei să cheltui pe lună →</p>
          )}
        </Link>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href={data.next ? `/cumparaturi/lista/?id=${data.next.list.id}` : "/cumparaturi/"}
          aria-label="Cumpărături"
          className={`min-w-0 rounded-[28px] bg-surface p-4 ${ROW}`}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-secondary"><ShoppingBasket size={18} className="shrink-0" aria-hidden /> Cumpărături</span>
          <span data-dashboard-count className="mt-3 block text-4xl font-bold tracking-tight">{data.next ? data.next.totals.item_count - data.next.totals.checked_count : 0}</span>
          <span className="mt-1 block text-xs text-ink-2">{data.next ? count(data.next.totals.item_count - data.next.totals.checked_count, "produs", "produse") : "0 produse"} de luat</span>
          <span className="mt-3 line-clamp-2 break-words text-xs font-medium leading-relaxed text-secondary">{data.next?.list.name ?? "Începe o listă →"}</span>
          {data.next && data.next.totals.remaining_estimate > 0 && <span className="mt-1 block text-xs text-ink-2">încă ~{formatRon(data.next.totals.remaining_estimate)}</span>}
          {data.next && data.next.totals.unknown_price_count > 0 && <span className="mt-1 block text-xs text-ink-2">{data.next.totals.unknown_price_count} fără preț</span>}
          {data.listCount > 1 && <span className="mt-1 block text-xs text-ink-2">și încă {data.listCount - 1} {data.listCount === 2 ? "listă" : "liste"}</span>}
        </Link>
        <Link href="/camara/" aria-label="Cămară" className={`min-w-0 rounded-[28px] bg-surface p-4 ${ROW}`}>
          <span className="flex items-center gap-2 text-xs font-semibold text-info"><Archive size={18} className="shrink-0" aria-hidden /> Cămară</span>
          <span data-dashboard-count className="mt-3 block text-4xl font-bold tracking-tight">{data.expiringCount}</span>
          <span className="mt-1 block text-xs text-ink-2">Expiră curând</span>
          <span className="mt-3 flex items-center gap-1 text-xs font-medium text-info">Cămară și frigider <ChevronRight size={14} className="shrink-0" aria-hidden /></span>
        </Link>
      </div>

      <SectionTitle action={<Link href="/plan/" className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 rounded-md">Planul</Link>}>Azi la masă</SectionTitle>
      {data.todayMeals.length === 0 ? (
        <Link href="/plan/" className="flex min-h-24 items-center gap-3 rounded-[28px] bg-surface px-5 py-4 text-[15px] text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
          <CalendarDays size={20} strokeWidth={1.75} /> Nimic planificat azi. Planifică mesele săptămânii.
        </Link>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[28px] bg-surface">
          {data.todayMeals.map(({ meal, recipe }) => (
            <li key={meal.id}>
              <Link href={recipe ? `/retete/reteta/?id=${recipe.id}` : "/plan/"} className={`flex items-center gap-3 px-5 py-4 ${ROW}`}>
                {recipe && <RecipeImage recipe={recipe} size="sm" avatar />}
                <span className="min-w-0 flex-1">
                  <span className={`block ${LABEL}`}>{SLOT_LABELS[meal.slot]}</span>
                  <span className="mt-0.5 line-clamp-2 font-sans text-lg font-medium leading-snug">{recipe?.name ?? "Rețetă ștearsă"}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-2">{meal.servings} porții</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <ProductSearch placeholder="Adaugă rapid pe listă: ex. lapte" onPick={({ product, parsed }) => quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)} />
      </div>

      {data.expiring.length > 0 && (
        <>
          <SectionTitle action={<Link href="/camara/" className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 rounded-md">Cămara</Link>}>Expiră curând</SectionTitle>
          {/* Etichete de borcan: chenar punctat terracotta, termenul ca o ștampilă (decizia proprietarului, 18 oct. 2026). */}
          <ul className="flex flex-col gap-2">
            {data.expiring.map((i) => {
              const d = daysBetween(today, i.expires_on!);
              return (
                <li key={i.id} className={`flex items-center gap-3 rounded-2xl border border-error/30 px-4 py-3 ${d < 0 ? "bg-error-container" : "bg-surface"}`}>
                  <span className="min-w-0 flex-1 text-[15px] text-ink">{i.name}</span>
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-accent">{d < 0 ? "expirat" : d === 0 ? "azi" : d === 1 ? "mâine" : `în ${d} zile`}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data.suggestions.length > 0 && (
        <>
          <SectionTitle action={<Link href="/retete/" className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 rounded-md">Toate rețetele</Link>}>{MEAL_TITLES[meal]}</SectionTitle>
          <Card as="section" aria-label={MEAL_TITLES[meal]} className="divide-y divide-line overflow-hidden">
            {data.suggestions.map(({ recipe, why }) => (
              <Link key={recipe.id} href={`/retete/reteta/?id=${recipe.id}`} className={`flex items-center gap-3 px-3 py-3 ${ROW}`}>
                <RecipeImage recipe={recipe} size="sm" avatar />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-sans text-[17px] font-medium leading-snug">{recipe.name}</span>
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
          <SectionTitle action={<Link href="/cumparaturi/istoric/" className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 rounded-md">Istoric</Link>}>Cheltuieli recente</SectionTitle>
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
                <span className="shrink-0 text-[15px] font-medium">{formatRon(t.total)}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
