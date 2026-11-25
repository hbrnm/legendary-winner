"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { ArrowRight, BasketIcon, ChefHat, Clock, JarIcon, PurseIcon, ReceiptIcon, WarmBowlIcon } from "@/components/ui/icons";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { SLOT_LABELS, mealBadgeClasses } from "@/components/recipes/recipe-visual";
import { useActiveShoppingList } from "@/components/shopping/active-list-provider";
import { projectTransactions } from "@/components/budget/transactions";
import { listItems, owned, priceIndex, householdSpendRecords, visible } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { addMeal, cookRecipe } from "@/lib/services/kitchen";
import { budgetStatus } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { cookingPriorities, expiringSoon, expiryState, pantryStock } from "@/lib/domain/pantry";
import { readyToCook, totalMinutes } from "@/lib/domain/recipes";
import { productUnitsOf } from "@/lib/domain/quantities";
import { formatShortDate, localDateOf, daysBetween, formatMonth } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import { formatQuantity } from "@/lib/domain/units";
import { now } from "@/lib/clock";
import type { MealSlot, Recipe, UnitCode } from "@/lib/domain/types";
import { quickMealSuggestions, selectHomeMeal, SLOT_ORDER } from "./home-model";
import { useMealTime } from "./use-meal-time";
import { COOKING_STORAGE_PREFIX, cookingProgressKey, listCookingProgress, writeCookingProgress } from "@/lib/cooking-progress";
import { isAvailableRecipe } from "@/data/recipes/visibility";

export function HomeScreen({ captureRef }: { captureRef?: Ref<HTMLDivElement> }) {
  const { run, busy } = useAction();
  const { ctx, displayName } = useApp();
  const { activeListId, selectList, ready } = useActiveShoppingList();
  const { today, meal: currentMeal } = useMealTime();
  const [mealAction, setMealAction] = useState<{ kind: "plan" | "cook"; recipe: Recipe } | null>(null);
  const [cookingRevision, setCookingRevision] = useState(0);
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (!event.key || event.key.startsWith(COOKING_STORAGE_PREFIX)) setCookingRevision(revision => revision + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
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
        const items = await listItems(ctx.db, list.id);
        const totals = listTotals(items, prices);
        const unchecked = items.filter((item) => !item.checked);
        return {
          list,
          remaining: totals.item_count - totals.checked_count,
          itemCount: totals.item_count,
          checkedCount: totals.checked_count,
          preview: unchecked.slice(0, 3).map((item) => ({
            id: item.id,
            name: item.name,
            qty: item.quantity != null && item.unit ? formatQuantity(item.quantity, item.unit) : null,
          })),
        };
      })
    );
    const preferred = active.find((entry) => entry.list.id === activeListId);
    const [first] = active.sort((a, b) => b.remaining - a.remaining || b.list.updated_at.localeCompare(a.list.updated_at));
    const next = preferred?.remaining ? preferred : first?.remaining ? first : preferred ?? first;
    const main =
      budgets.find((b) => b.active && b.period === "lunar" && b.scope.kind === "familie") ??
      budgets.find((b) => b.active && b.period === "lunar" && (b.scope.kind === "total" || b.scope.kind === "alimente"));
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    let cooking = null;
    for (const { recipeId, progress } of listCookingProgress(ctx.householdId, ctx.userId)) {
      const recipe = recipesById.get(recipeId);
      if (!recipe) continue;
      const steps = (await ctx.db.recipe_steps.where("recipe_id").equals(recipeId).toArray())
        .filter(step => !step.deleted_at).sort((a, b) => a.position - b.position);
      if (!steps.length) continue;
      cooking = { recipe, step: steps.findIndex(step => step.id === progress.stepId) + 1, total: steps.length };
      break;
    }
    const availableRecipes = recipes.filter(isAvailableRecipe);
    const stock = pantryStock(pantry.filter(item => expiryState(item, today) !== "expirat"));
    let readyRecipe: Recipe | undefined;
    let readyReason: string | undefined;
    if (!cooking && stock.length > 0) {
      const [ingredients, products] = await Promise.all([
        visible(ctx.db, "recipe_ingredients", ctx.householdId),
        visible(ctx.db, "products", ctx.householdId),
      ]);
      const readyIds = readyToCook(availableRecipes, ingredients, stock, productUnitsOf(products));
      if (readyIds.size > 0) {
        const steps = await ctx.db.recipe_steps.where("recipe_id").anyOf([...readyIds]).toArray();
        const guidedIds = new Set(steps.filter(step => !step.deleted_at).map(step => step.recipe_id));
        const priorities = cookingPriorities(pantry, today);
        const byRecipe = new Map<string, { rank: number; label: string }>();
        for (const ingredient of ingredients) {
          if (!guidedIds.has(ingredient.recipe_id) || ingredient.optional || !(ingredient.quantity && ingredient.unit)) continue;
          const priority = priorities.get(ingredient.product_id);
          if (priority && priority.rank < (byRecipe.get(ingredient.recipe_id)?.rank ?? Infinity)) {
            byRecipe.set(ingredient.recipe_id, priority);
          }
        }
        [readyRecipe] = availableRecipes.filter(recipe => guidedIds.has(recipe.id)).sort((a, b) => {
          const rankA = byRecipe.get(a.id)?.rank ?? priorities.size;
          const rankB = byRecipe.get(b.id)?.rank ?? priorities.size;
          return rankA - rankB || totalMinutes(a) - totalMinutes(b) || a.name.localeCompare(b.name, "ro") || a.id.localeCompare(b.id);
        });
        readyReason = readyRecipe && byRecipe.get(readyRecipe.id)?.label;
      }
    }
    const recent = projectTransactions(spend, txs).filter((t) => !t.pending)[0];
    const urgentAll = expiringSoon(pantry.filter((p) => p.quantity > 0), today, 3);

    return {
      householdId: ctx.householdId,
      next,
      cooking,
      readyRecipe,
      readyReason,
      budget: main ? budgetStatus(main, spend, new Map(categories.map((c) => [c.id, c])), today) : null,
      meals: meals
        .filter((m) => m.date === today)
        .map((meal) => ({ meal, recipe: recipesById.get(meal.recipe_id) })),
      suggestions: quickMealSuggestions(availableRecipes, today, currentMeal),
      stockCount: pantry.filter((p) => p.quantity > 0).length,
      expiringCount: urgentAll.length,
      urgentPreview: urgentAll.slice(0, 2).map((item) => ({
        id: item.id,
        name: item.name,
        days: item.expires_on ? daysBetween(today, item.expires_on) : 0,
      })),
      recent: recent
        ? { ...recent, title: recent.retailerId ? retailers.find((r) => r.id === recent.retailerId)?.name ?? recent.title : recent.title }
        : null,
    };
  }, [today, currentMeal, activeListId, cookingRevision]);

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
      if (ok) {
        if (action.kind === "cook" && ctx) {
          writeCookingProgress(cookingProgressKey(ctx.householdId, ctx.userId, action.recipe.id), null);
          setCookingRevision(revision => revision + 1);
        }
        setMealAction(null);
      }
    } finally {
      submitting.current = false;
    }
  }

  const currentDate = now();
  const hour = currentDate.getHours();
  const greeting = hour >= 5 && hour < 12 ? "Bună dimineața" : hour >= 12 && hour < 18 ? "Bună ziua" : "Bună seara";
  const firstName = displayName?.trim().split(/\s+/)[0] || null;
  const currentMonthLabel = formatMonth(today).split(" ")[0]?.toUpperCase() ?? "";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="kitchen-display min-w-0 flex-1 break-words text-on-surface">
          {greeting}
          {firstName && (
            <>
              , <span className="text-info">{firstName}</span>
            </>
          )}
        </h1>
        {captureRef && <div ref={captureRef} className="shrink-0 self-start" />}
      </header>

      {data.cooking && (
        <Link
          href={"/retete/reteta/?id=" + encodeURIComponent(data.cooking.recipe.id) + "&gatit=reia"}
          className="flex min-h-18 items-center gap-3 rounded-[20px] bg-primary px-5 py-4 text-on-primary transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ChefHat size={22} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">Reia gătitul</span>
            <span className="block break-words text-sm">{data.cooking.recipe.name}</span>
            <span className="block text-sm">{data.cooking.step ? "Pasul " + data.cooking.step + " din " + data.cooking.total : "Ingrediente"}</span>
          </span>
          <ArrowRight size={18} className="shrink-0" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-1 items-start gap-6 min-[900px]:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-3">
          <section aria-labelledby="today-meal-title">
            <div className={`group/meal overflow-hidden rounded-[24px] text-ink ${data.cooking ? "border border-line bg-surface-container-low" : "bg-meal-hero shadow-card"}`} data-testid="home-meal">
              <div className="flex items-center justify-between gap-2 px-5 pt-4 sm:px-6 sm:pt-5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2">
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                  Planul de azi
                </span>
                <Link href="/plan/" className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                  Planul săptămânii <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              {selectedMeal ? (
                <>
                  <div className={`kitchen-meal-photo mt-3 w-full empty:hidden ${data.cooking ? "kitchen-meal-photo-compact" : ""}`}>
                    <RecipeImage recipe={selectedMeal.recipe} size="lg" priority />
                  </div>
                  <div className="flex items-center justify-between gap-4 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                      <h2 id="today-meal-title" className="text-section-title font-bold text-ink">Azi la masă</h2>
                      <Link href={"/retete/reteta/?id=" + selectedMeal.recipe.id} className="w-full rounded-md focus-visible:outline-2 focus-visible:outline-brand hover:text-brand">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${mealBadgeClasses(selectedMeal.slot)}`}>
                          {SLOT_LABELS[selectedMeal.slot]} · {selectedMeal.servings} porții
                        </span>
                        <span className="kitchen-meal-title mt-2 block break-words">{selectedMeal.recipe.name}</span>
                        <span className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
                          <Clock size={14} aria-hidden /> {totalMinutes(selectedMeal.recipe)} min
                        </span>
                      </Link>
                      <Button
                        size="sm"
                        variant={data.cooking ? "secondary" : "primary"}
                        onClick={() => openMeal(selectedMeal.planned ? "cook" : "plan", selectedMeal.recipe, selectedMeal.servings)}
                      >
                        {selectedMeal.planned ? "Am gătit" : "Alege"}
                      </Button>
                    </div>
                    <span aria-hidden="true" className="hidden size-20 shrink-0 items-center justify-center rounded-full bg-surface text-brand shadow-card min-[400px]:flex group-has-[.kitchen-meal-photo_img]/meal:hidden">
                      <WarmBowlIcon size={34} />
                    </span>
                  </div>
                  {(() => {
                    const others = data.meals.filter((m) => m.recipe && m.meal.slot !== selectedMeal.slot).slice(0, 2);
                    if (!others.length) return null;
                    return (
                      <ul className="space-y-1.5 border-t border-meal-hero-border px-5 py-3 sm:px-6">
                        {others.map(({ meal, recipe }) => (
                          <li key={meal.id}>
                            <Link href={"/retete/reteta/?id=" + recipe!.id} className="flex items-baseline gap-2.5 text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                              <span className="shrink-0 text-xs font-semibold text-ink-2">{SLOT_LABELS[meal.slot]}</span>
                              <span className="min-w-0 truncate font-medium text-ink">{recipe!.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </>
              ) : (
                <div className="px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
                  <h2 id="today-meal-title" className="text-section-title font-bold text-ink">Azi la masă</h2>
                  <p className="mt-2 text-base text-ink-2">Nu ai nicio masă planificată pentru restul zilei.</p>
                </div>
              )}
            </div>
          </section>

          {data.readyRecipe && (
            <Link
              href={"/retete/reteta/?id=" + encodeURIComponent(data.readyRecipe.id) + "&gatit=incepe"}
              className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-2.5 text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label={"Gata de gătit. Începe să gătești " + data.readyRecipe.name + ", " + totalMinutes(data.readyRecipe) + " minute" + (data.readyReason ? ". " + data.readyReason : "")}
            >
              <ChefHat size={19} className="shrink-0 text-ink-2" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-ink-2">Gata de gătit · {totalMinutes(data.readyRecipe)} min</span>
                <span className="block break-words text-sm font-semibold">{data.readyRecipe.name}</span>
                {data.readyReason && <span className="block break-words text-sm text-ink-2">{data.readyReason}</span>}
              </span>
              <ArrowRight size={16} className="shrink-0 text-ink-2" aria-hidden />
            </Link>
          )}
        </div>

        <section aria-labelledby="active-list-title" data-testid="home-shopping-pantry">
          <div className="mb-2 flex min-h-10 items-center justify-between gap-2">
            <h2 id="active-list-title" className="text-section-title font-semibold text-ink">Lista ta activă</h2>
            {data.next && data.next.remaining > 0 ? (
              <Link
                ref={focusList}
                href={"/cumparaturi/lista/?id=" + data.next.list.id}
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span>Deschide lista</span>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs tabular-nums text-brand">{data.next.remaining} de luat</span>
                <ArrowRight size={15} aria-hidden />
              </Link>
            ) : data.next ? (
              <Link href={"/cumparaturi/lista/?id=" + data.next.list.id} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                Vezi lista <ArrowRight size={15} aria-hidden />
              </Link>
            ) : null}
          </div>
          <div className="app-card p-4">
            {data.next && data.next.remaining > 0 ? (
              <>
                <Link
                  href={"/cumparaturi/lista/?id=" + data.next.list.id}
                  className="flex items-center gap-3 rounded-xl py-0.5 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                    <BasketIcon size={19} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{data.next.list.name}</span>
                  <span className="shrink-0 text-xs font-medium text-ink-2 tabular-nums">
                    {data.next.checkedCount} din {data.next.itemCount}
                  </span>
                </Link>
                <div className="mt-3 space-y-2.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(data.next.checkedCount / Math.max(1, data.next.itemCount)) * 100}%` }} />
                  </div>
                  {data.next.preview.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Produse de cumpărat">
                      {data.next.preview.map((item) => (
                        <li key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink">
                          <span className="truncate font-medium">{item.name}</span>
                          {item.qty && <span className="shrink-0 text-ink-2 tabular-nums">· {item.qty}</span>}
                        </li>
                      ))}
                      {data.next.remaining > data.next.preview.length && (
                        <li className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 tabular-nums">
                          +{data.next.remaining - data.next.preview.length}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="mt-3 border-t border-line/70 pt-3">
                  <p className="mb-1.5 text-xs font-medium text-ink-2">Adaugă rapid pe listă</p>
                  <ProductSearch
                    placeholder="De ex. 2 kg roșii"
                    onPick={({ product, parsed }) => void quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm font-semibold text-ink">Adaugă pe listă</p>
                <ProductSearch
                  placeholder="De ex. 2 kg roșii"
                  onPick={({ product, parsed }) => void quickAdd(product?.id ?? null, parsed.text, parsed.quantity, parsed.unit)}
                />
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 min-[600px]:grid-cols-2">
        <section aria-labelledby="use-soon-title">
          <div className="mb-2 flex min-h-10 items-center justify-between gap-2">
            <h2 id="use-soon-title" className="text-section-title font-semibold text-ink">De folosit curând</h2>
            <Link href="/camara/" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
              Cămară <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="app-card px-4 py-3">
            {data.urgentPreview.length > 0 && (
              <ul className="mb-2 space-y-2 border-b border-line/70 pb-2.5">
                {data.urgentPreview.map((item) => (
                  <li key={item.id}>
                    <Link href="/camara/" className="flex items-center gap-3 rounded-xl py-0.5 text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${item.days <= 0 ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`} aria-hidden>
                        <Clock size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{item.name}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${item.days <= 0 ? "text-accent" : "text-warn"}`}>
                        <span className={`size-1.5 rounded-full ${item.days <= 0 ? "bg-accent" : "bg-warn"}`} aria-hidden />
                        {item.days < 0 ? "Expirat" : item.days === 0 ? "Expiră azi" : item.days === 1 ? "Mâine" : `În ${item.days} zile`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/camara/" className="flex min-h-12 items-center gap-3 text-sm transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${data.expiringCount > 0 ? "bg-accent-soft text-accent" : "bg-info-soft text-info"}`} aria-hidden>
                <JarIcon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Cămară</span>
                <span className="text-ink-2">
                  {data.stockCount} în stoc
                  {data.expiringCount > 0 && <span className="ml-2 font-medium text-accent"> {data.expiringCount} expiră curând</span>}
                </span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-ink-2" aria-hidden />
            </Link>
          </div>
        </section>

        <section aria-labelledby="family-budget-title" data-testid="home-budget">
          <div className="mb-2 flex min-h-10 items-center justify-between gap-2">
            <h2 id="family-budget-title" className="text-section-title font-semibold text-ink">Bugetul familiei</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">{currentMonthLabel}</span>
          </div>
          <div className="app-card px-4 py-3.5">
            <Link href="/buget/" className="flex min-h-14 items-center gap-3 pb-2.5 text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                <PurseIcon size={19} />
              </span>
              {data.budget ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-ink-2">Cheltuit luna asta</span>
                    <span className="block truncate text-xs text-ink-2 tabular-nums">
                      <strong className="text-sm font-bold text-ink">{formatRon(data.budget.spent)}</strong> din {formatRon(data.budget.budget.amount)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`block text-base font-bold leading-tight tabular-nums ${data.budget.over ? "text-accent" : "text-ink"}`}>
                      {formatRon(Math.abs(data.budget.remaining))}
                    </span>
                    <span className={`block text-xs ${data.budget.over ? "font-medium text-accent" : "text-ink-2"}`}>
                      {data.budget.over ? "peste buget" : "îți mai rămân"}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Bugetul lunii</span>
                  <span className="text-ink-2">Setează plafonul lunar</span>
                </span>
              )}
              <ArrowRight size={16} className="shrink-0 text-ink-2" aria-hidden />
            </Link>
            {data.budget && <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />}
            {data.recent && (
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-1 text-xs text-ink-2">
                <p className="flex min-w-0 items-center gap-1.5">
                  <ReceiptIcon size={14} className="shrink-0" aria-hidden />
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
          </div>
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
