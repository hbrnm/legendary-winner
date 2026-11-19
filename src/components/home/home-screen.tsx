"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, ArrowUpRight, Check, Clock, Receipt, ShoppingBasket } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Card, SectionTitle, Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { useActiveShoppingList } from "@/components/shopping/active-list-provider";
import { projectTransactions } from "@/components/budget/transactions";
import { listItems, owned, priceIndex, householdSpendRecords, visible } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { addMeal, cookRecipe } from "@/lib/services/kitchen";
import { budgetStatus, dailyBudgetAvailable } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { expiringSoon } from "@/lib/domain/pantry";
import { totalMinutes } from "@/lib/domain/recipes";
import { formatShortDate, localDateOf } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import type { MealSlot, Recipe, UnitCode } from "@/lib/domain/types";
import { quickMealSuggestions, selectHomeMeal } from "./home-model";
import { useMealTime } from "./use-meal-time";

const SLOT_ORDER: MealSlot[] = ["mic_dejun", "pranz", "gustare", "cina"];

export function HomeScreen() {
  const { run, busy } = useAction();
  const { ctx } = useApp();
  const { activeListId, selectList, ready } = useActiveShoppingList();
  const { today, meal: currentMeal } = useMealTime();
  const [mealAction, setMealAction] = useState<{ kind: "plan" | "cook"; recipe: Recipe } | null>(null);
  const [slot, setSlot] = useState<MealSlot>("pranz");
  const [servings, setServings] = useState(2);
  const submitting = useRef(false);

  const data = useData(async (ctx) => {
    const [lists, prices, budgets, spend, categories, meals, recipes, pantry, txs, retailers] = await Promise.all([
      owned(ctx.db, "shopping_lists", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
      householdSpendRecords(ctx.db, ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      owned(ctx.db, "meal_plan_items", ctx.householdId),
      visible(ctx.db, "recipes", ctx.householdId),
      owned(ctx.db, "pantry_items", ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
    ]);
    const active = await Promise.all(
      lists.filter((l) => !l.archived_at).map(async (list) => ({ list, totals: listTotals(await listItems(ctx.db, list.id), prices) }))
    );
    const next =
      active.find((a) => a.list.id === activeListId) ??
      active.sort(
        (a, b) =>
          b.totals.item_count - b.totals.checked_count - (a.totals.item_count - a.totals.checked_count) ||
          b.list.updated_at.localeCompare(a.list.updated_at)
      )[0] ??
      null;
    const main =
      budgets.find((b) => b.active && b.period === "lunar" && b.scope.kind === "familie") ??
      budgets.find((b) => b.active && b.period === "lunar" && (b.scope.kind === "total" || b.scope.kind === "alimente"));
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    const recent = projectTransactions(spend, txs).filter((t) => !t.pending)[0];

    return {
      householdId: ctx.householdId,
      next,
      remainingItems: active.reduce((n, a) => n + a.totals.item_count - a.totals.checked_count, 0),
      budget: main ? budgetStatus(main, spend, new Map(categories.map((c) => [c.id, c])), today) : null,
      meals: meals
        .filter((m) => m.date === today)
        .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
        .map((meal) => ({ meal, recipe: recipesById.get(meal.recipe_id) })),
      suggestions: quickMealSuggestions(recipes, today, currentMeal),
      stockCount: pantry.filter((p) => p.quantity > 0).length,
      expiringCount: expiringSoon(pantry.filter((p) => p.quantity > 0), today, 3).length,
      recent: recent
        ? { ...recent, title: recent.retailerId ? retailers.find((r) => r.id === recent.retailerId)?.name ?? recent.title : recent.title }
        : null,
    };
  }, [today, currentMeal, activeListId]);

  if (!data || !ready || data.householdId !== ctx?.householdId) return <Spinner />;
  const selectedMeal = selectHomeMeal(data.meals, data.suggestions, currentMeal);

  async function quickAdd(productId: string | null, text: string, quantity: number | null, unit: string | null) {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const id = await run(async (ctx) => {
        const id = data!.next?.list.id ?? (await createList(ctx, { name: "Cumpărături" }));
        await addItem(ctx, id, { product_id: productId, name: productId ? undefined : text, quantity, unit: unit as UnitCode | null });
        return id;
      }, "Am adăugat produsul pe listă.");
      if (id) selectList(id);
    } finally {
      submitting.current = false;
    }
  }

  function openMeal(kind: "plan" | "cook", recipe: Recipe, plannedServings?: number) {
    setMealAction({ kind, recipe });
    setServings(plannedServings ?? recipe.servings);
    setSlot(currentMeal);
  }

  async function confirmMeal() {
    if (!mealAction || submitting.current || !Number.isInteger(servings) || servings < 1 || servings > 50) return;
    submitting.current = true;
    try {
      const action = mealAction;
      const ok = await run(
        async (ctx) => {
          if (action.kind === "cook") return cookRecipe(ctx, action.recipe.id, servings);
          await ctx.db.transaction("rw", [ctx.db.meal_plan_items, ctx.db.outbox], async () => {
            const existing = await owned(ctx.db, "meal_plan_items", ctx.householdId);
            if (!existing.some((m) => m.date === today && m.slot === slot && m.recipe_id === action.recipe.id)) {
              await addMeal(ctx, { date: today, slot, recipe_id: action.recipe.id, servings });
            }
          });
          return { updated: 0, shortfall: [] };
        },
        (res) =>
          action.kind === "plan"
            ? "Am planificat masa pentru azi."
            : res.shortfall.length
              ? "Am actualizat cămara. Unele ingrediente nu aveau stoc suficient sau cantități compatibile."
              : "Am scăzut ingredientele din cămară."
      );
      if (ok) setMealAction(null);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. Azi la masă */}
      <section aria-label="Azi la masă">
        <SectionTitle
          className="mt-0! mb-1.5"
          action={
            <Link
              href="/plan/"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand transition-colors duration-150 hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand"
            >
              Planul săptămânii <span aria-hidden>→</span>
            </Link>
          }
        >
          Azi la masă
        </SectionTitle>

        <Card className="overflow-hidden border border-line/40 transition-colors duration-150 ease-out hover:border-line" data-testid="home-meal">
          {selectedMeal ? (
            <div className="flex items-center gap-3 p-3">
              <div className="shrink-0 overflow-hidden rounded-xl">
                <RecipeImage recipe={selectedMeal.recipe} size="sm" />
              </div>
              <Link
                href={`/retete/reteta/?id=${selectedMeal.recipe.id}`}
                className="group min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {SLOT_LABELS[currentMeal]} · {selectedMeal.servings} porții
                </span>
                <span className="line-clamp-1 font-semibold text-ink transition-colors duration-150 group-hover:text-brand">
                  {selectedMeal.recipe.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                  <Clock size={12} className="shrink-0" aria-hidden />
                  {totalMinutes(selectedMeal.recipe)} min
                </span>
              </Link>
              <Button
                size="sm"
                variant={selectedMeal.planned ? "primary" : "secondary"}
                onClick={() => openMeal(selectedMeal.planned ? "cook" : "plan", selectedMeal.recipe, selectedMeal.servings)}
                className="shrink-0 active:scale-[0.96]"
              >
                {selectedMeal.planned ? "Am gătit" : "Alege"}
              </Button>
            </div>
          ) : (
            <p className="p-3 text-sm text-ink-2">
              Nu ai o recomandare pentru această masă.{" "}
              <Link href="/plan/" className="font-medium text-brand hover:text-brand-strong">
                Planifică masa de azi →
              </Link>
            </p>
          )}
        </Card>
      </section>

      {/* 2. Cumpărături & Cămară */}
      <section aria-label="Cumpărături și Cămară">
        <SectionTitle className="mt-2! mb-1.5">Cumpărături & Cămară</SectionTitle>
        <ProductSearch
          placeholder="Adaugă pe listă: ex. lapte"
          onPick={({ product, parsed }) => void quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)}
        />
        <div className="mt-2 grid grid-cols-2 gap-2.5" data-testid="home-shopping-pantry">
          <Card className="min-w-0 border border-line/40 transition-all duration-150 ease-out hover:border-line active:scale-[0.98]">
            <Link
              href={data.next ? `/cumparaturi/lista/?id=${data.next.list.id}` : "/cumparaturi/"}
              className="group block p-3 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <ShoppingBasket size={15} />
                  </span>
                  Cumpărături
                </span>
                <ArrowUpRight size={15} className="text-ink-3 opacity-60 transition-all duration-150 group-hover:text-brand group-hover:opacity-100" />
              </div>
              {data.remainingItems > 0 ? (
                <p className="mt-2.5 text-2xl font-semibold tabular-nums text-ink">
                  {data.remainingItems}
                  <span className="ml-2 text-xs font-normal text-ink-2"> de luat</span>
                </p>
              ) : (
                <p className="mt-2.5 flex items-center gap-1 text-sm text-info">
                  <Check size={16} /> Nimic de luat
                </p>
              )}
            </Link>
          </Card>

          <Card className="min-w-0 border border-line/40 transition-all duration-150 ease-out hover:border-line active:scale-[0.98]">
            <Link href="/camara/" className="group block p-3 focus-visible:outline-2 focus-visible:outline-brand">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                    <Archive size={15} />
                  </span>
                  Cămară
                </span>
                <ArrowUpRight size={15} className="text-ink-3 opacity-60 transition-all duration-150 group-hover:text-brand group-hover:opacity-100" />
              </div>
              <p className="mt-2.5 text-2xl font-semibold tabular-nums text-ink">
                {data.stockCount}
                <span className="ml-2 text-xs font-normal text-ink-2"> în stoc</span>
              </p>
              <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${data.expiringCount ? "text-accent font-medium" : "text-info"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${data.expiringCount ? "bg-accent animate-pulse" : "bg-info"}`} />
                {data.expiringCount ? `${data.expiringCount} expiră curând` : "Totul e în termen"}
              </p>
            </Link>
          </Card>
        </div>
      </section>

      {/* 3. Bugetul lunii */}
      <section aria-label="Bugetul lunii">
        <SectionTitle
          className="mt-2! mb-1.5"
          action={
            <Link
              href="/buget/#tranzactii"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand transition-colors duration-150 hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand"
            >
              Istoric →
            </Link>
          }
        >
          Bugetul lunii
        </SectionTitle>

        <Card className="border border-line/40 p-3.5 transition-colors duration-150 ease-out hover:border-line" data-testid="home-budget">
          {data.budget ? (
            <>
              <Link href="/buget/" className="group block focus-visible:outline-2 focus-visible:outline-brand">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-2xl font-semibold tabular-nums ${data.budget.over ? "text-accent" : "text-ink"}`}>
                    {formatRon(Math.abs(data.budget.remaining))}{" "}
                    <span className="text-sm font-normal text-ink-2">{data.budget.over ? "peste buget" : "rămași"}</span>
                  </p>
                  <p className="text-xs text-ink-3">din {formatRon(data.budget.budget.amount)}</p>
                </div>
                {data.budget.remaining >= 0 && (
                  <p className="mt-1 text-xs text-ink-2">
                    ~{formatRon(dailyBudgetAvailable(data.budget.remaining, today))}/zi disponibili până la finalul lunii
                  </p>
                )}
              </Link>
              <div className="mt-2.5">
                <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />
              </div>
            </>
          ) : (
            <Link href="/buget/" className="inline-flex min-h-12 items-center text-brand hover:text-brand-strong">
              Setează plafonul lunar →
            </Link>
          )}

          <div className="mt-2.5 flex min-h-11 items-center gap-2 border-t border-line/70 pr-16 pt-2.5 text-xs">
            {data.recent ? (
              <Link
                href="/buget/#tranzactii"
                className="group flex min-w-0 flex-1 items-center justify-between gap-2 text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-3">
                    <Receipt size={12} />
                  </span>
                  <p className="truncate">
                    {data.recent.title} · {data.recent.amount == null ? "sumă neprecizată" : formatRon(data.recent.amount)} ·{" "}
                    {localDateOf(data.recent.date) === today ? "azi" : formatShortDate(localDateOf(data.recent.date))}
                  </p>
                </div>
                <span className="shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100">→</span>
              </Link>
            ) : (
              <p className="min-w-0 flex-1 truncate text-ink-3">Încă nu ai tranzacții înregistrate</p>
            )}
          </div>
        </Card>
      </section>

      {/* Sheet acțiune masă */}
      <Sheet
        open={mealAction !== null}
        onClose={() => {
          if (!busy) setMealAction(null);
        }}
        title={mealAction?.kind === "cook" ? "Am gătit" : "Alege masa de azi"}
        footer={
          <Button
            block
            disabled={busy || !Number.isInteger(servings) || servings < 1 || servings > 50}
            onClick={confirmMeal}
          >
            {mealAction?.kind === "cook" ? "Scade ingredientele" : "Programează azi"}
          </Button>
        }
      >
        <p className="mb-4 font-medium">{mealAction?.recipe.name}</p>
        <div className="space-y-4">
          {mealAction?.kind === "plan" && (
            <LabeledSelect label="Masa" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {SLOT_ORDER.map((value) => (
                <option key={value} value={value}>
                  {SLOT_LABELS[value]}
                </option>
              ))}
            </LabeledSelect>
          )}
          <LabeledInput
            label="Porții"
            type="number"
            min={1}
            max={50}
            value={Number.isNaN(servings) ? "" : servings}
            onChange={(e) => setServings(e.target.valueAsNumber)}
          />
          {mealAction?.kind === "cook" && (
            <p className="text-sm text-ink-2">
              Scădem ingredientele disponibile din cămară pentru aceste porții. Confirmă o singură dată pentru fiecare preparare.
            </p>
          )}
        </div>
      </Sheet>
    </div>
  );
}
