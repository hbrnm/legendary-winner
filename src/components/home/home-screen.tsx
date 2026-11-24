"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type Ref } from "react";
import { Archive, ArrowRight, Clock, Receipt, ShoppingBasket, Wallet } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Spinner } from "@/components/ui/misc";
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
import { budgetStatus } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { expiringSoon } from "@/lib/domain/pantry";
import { totalMinutes } from "@/lib/domain/recipes";
import { formatShortDate, localDateOf } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import type { MealSlot, Recipe, UnitCode } from "@/lib/domain/types";
import { quickMealSuggestions, selectHomeMeal, SLOT_ORDER } from "./home-model";
import { useMealTime } from "./use-meal-time";

export function HomeScreen({ captureRef }: { captureRef?: Ref<HTMLDivElement> }) {
  const { run, busy } = useAction();
  const { ctx } = useApp();
  const { activeListId, selectList, ready } = useActiveShoppingList();
  const { today, meal: currentMeal } = useMealTime();
  const [mealAction, setMealAction] = useState<{ kind: "plan" | "cook"; recipe: Recipe } | null>(null);
  const [slot, setSlot] = useState<MealSlot>("pranz");
  const [servings, setServings] = useState(2);
  const submitting = useRef(false);
  const focusListAfterAdd = useRef(false);
  const focusList = useCallback((link: HTMLAnchorElement | null) => {
    if (link && focusListAfterAdd.current) {
      focusListAfterAdd.current = false;
      link.focus();
    }
  }, []);

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
      lists.filter((l) => !l.archived_at).map(async (list) => {
        const totals = listTotals(await listItems(ctx.db, list.id), prices);
        return { list, remaining: totals.item_count - totals.checked_count };
      })
    );
    const preferred = active.find((entry) => entry.list.id === activeListId);
    const [first] = active.sort((a, b) => b.remaining - a.remaining || b.list.updated_at.localeCompare(a.list.updated_at));
    const next = preferred?.remaining ? preferred : first?.remaining ? first : preferred ?? first;
    const main =
      budgets.find((b) => b.active && b.period === "lunar" && b.scope.kind === "familie") ??
      budgets.find((b) => b.active && b.period === "lunar" && (b.scope.kind === "total" || b.scope.kind === "alimente"));
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    const recent = projectTransactions(spend, txs).filter((t) => !t.pending)[0];

    return {
      householdId: ctx.householdId,
      next,
      budget: main ? budgetStatus(main, spend, new Map(categories.map((c) => [c.id, c])), today) : null,
      meals: meals
        .filter((m) => m.date === today)
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
    focusListAfterAdd.current = true;
    try {
      const id = await run(async (ctx) => {
        const id = data!.next?.list.id ?? (await createList(ctx, { name: "Cumpărături" }));
        await addItem(ctx, id, { product_id: productId, name: productId ? undefined : text, quantity, unit: unit as UnitCode | null });
        return id;
      }, "Am adăugat produsul pe listă.");
      if (id) selectList(id);
      else focusListAfterAdd.current = false;
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
    <div className="space-y-4">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Azi</h1>
        <div ref={captureRef} />
      </div>

      <div className="grid items-start gap-4 min-[900px]:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="today-meal-title">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3">
            <h2 id="today-meal-title" className="text-lg font-semibold">Azi la masă</h2>
            <Link href="/plan/" className="inline-flex min-h-12 items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
              Planul săptămânii <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3" data-testid="home-meal">
            {selectedMeal ? (
              <div className="flex flex-wrap items-center gap-2 min-[360px]:gap-3">
                <div className="shrink-0 empty:hidden">
                  <RecipeImage recipe={selectedMeal.recipe} size="md" />
                </div>
                <Link href={"/retete/reteta/?id=" + selectedMeal.recipe.id} className="min-w-[7rem] flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand hover:text-brand">
                  <span className="block text-xs font-medium text-ink-2">
                    {SLOT_LABELS[selectedMeal.slot]} · {selectedMeal.servings} porții
                  </span>
                  <span className="block break-words text-base font-semibold leading-tight">{selectedMeal.recipe.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-ink-2">
                    <Clock size={13} aria-hidden /> {totalMinutes(selectedMeal.recipe)} min
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openMeal(selectedMeal.planned ? "cook" : "plan", selectedMeal.recipe, selectedMeal.servings)}
                >
                  {selectedMeal.planned ? "Am gătit" : "Alege"}
                </Button>
              </div>
            ) : (
              <p className="py-2 text-sm text-ink-2">Nu ai nicio masă planificată pentru restul zilei.</p>
            )}
          </div>
        </section>

        <section aria-label="Cumpărături" className="rounded-2xl border border-line bg-surface p-3 min-[900px]:mt-12" data-testid="home-shopping-pantry">
          {data.next && data.next.remaining > 0 ? (
            <Link
              ref={focusList}
              href={"/cumparaturi/lista/?id=" + data.next.list.id}
              className="flex min-h-14 items-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ShoppingBasket size={19} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">Deschide lista</span>
              <span className="shrink-0 tabular-nums">{data.next.remaining} de luat</span>
              <ArrowRight size={16} className="shrink-0" aria-hidden />
            </Link>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2">
                <h2 className="text-sm font-semibold">Adaugă pe listă</h2>
                {data.next && (
                  <Link href={"/cumparaturi/lista/?id=" + data.next.list.id} className="inline-flex min-h-12 items-center text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                    Vezi lista
                  </Link>
                )}
              </div>
              <ProductSearch
                placeholder="De ex. 2 kg roșii"
                onPick={({ product, parsed }) => void quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)}
              />
            </>
          )}
        </section>
      </div>

      <div className="grid gap-x-5 min-[600px]:grid-cols-2">
        <Link href="/camara/" className="flex min-h-16 items-center gap-3 border-t border-line py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand hover:text-brand">
          <Archive size={20} className="shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Cămară</span>
            <span className="text-ink-2">
              {data.stockCount} în stoc
              {data.expiringCount > 0 && <span className="ml-2 font-medium text-accent"> {data.expiringCount} expiră curând</span>}
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-ink-2" aria-hidden />
        </Link>

        <section aria-label="Bugetul lunii" className="border-t border-line" data-testid="home-budget">
          <Link href="/buget/" className="flex min-h-16 items-center gap-3 py-2 text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
            <Wallet size={20} className="shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Bugetul lunii</span>
              {data.budget ? (
                <span className={data.budget.over ? "font-medium text-accent" : "text-ink-2"}>
                  <strong className="font-semibold tabular-nums">{formatRon(Math.abs(data.budget.remaining))}</strong>{" "}
                  {data.budget.over ? "peste buget" : "rămași"}{" "}
                  <span className="text-xs text-ink-2">din {formatRon(data.budget.budget.amount)}</span>
                </span>
              ) : (
                <span className="text-ink-2">Setează plafonul lunar</span>
              )}
            </span>
            <ArrowRight size={16} className="shrink-0 text-ink-2" aria-hidden />
          </Link>
          {data.budget && <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />}
          {data.recent && (
            <div className="flex items-center justify-between gap-2 text-xs text-ink-2">
              <p className="flex min-w-0 items-center gap-1.5">
                <Receipt size={14} className="shrink-0" aria-hidden />
                <span className="truncate">
                  {data.recent.title} · {data.recent.amount == null ? "sumă neprecizată" : formatRon(data.recent.amount)} ·{" "}
                  {localDateOf(data.recent.date) === today ? "azi" : formatShortDate(localDateOf(data.recent.date))}
                </span>
              </p>
              <Link href="/buget/tranzactii/" className="inline-flex min-h-12 shrink-0 items-center font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                Istoric →
              </Link>
            </div>
          )}
        </section>
      </div>

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
