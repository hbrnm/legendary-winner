"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RecipeNavigation } from "@/components/recipes/navigation";
import { useRouter } from "next/navigation";
import { BasketIcon, ChevronLeft, ChevronRight, Copy, Heart, Search, Trash2 } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { AddButton, Button, IconButton } from "@/components/ui/button";
import { Card, PageHeader, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { isAvailableRecipe } from "@/data/recipes/visibility";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { costAmount, partialCostLabel } from "@/components/recipes/recipe-cost";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { addMeal, copyWeek, duplicateMeal, generateListFromPlan, moveMeal, removeMeal, updateMealServings } from "@/lib/services/kitchen";
import { createList } from "@/lib/services/shopping";
import { addDays, formatLongDate, formatShortDate, formatWeekdayShort, startOfWeek, toISODate } from "@/lib/domain/dates";
import { recipeCost, recipeNeeds, STAPLE_PRODUCT_IDS, totalMinutes } from "@/lib/domain/recipes";
import { aggregateNeeds, productUnitsOf, subtractStock } from "@/lib/domain/quantities";
import { pantryStock } from "@/lib/domain/pantry";
import { normalize } from "@/lib/domain/search";
import { sumMoney } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import type { MealPlanItem, MealSlot } from "@/lib/domain/types";

const SLOTS: MealSlot[] = ["mic_dejun", "pranz", "cina", "gustare"];

function PlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [week, setWeek] = useState(startOfWeek(today));
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [editing, setEditing] = useState<MealPlanItem | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveSlot, setMoveSlot] = useState<MealSlot>("cina");
  const [generating, setGenerating] = useState(false);
  const [genList, setGenList] = useState("");
  const [genPantry, setGenPantry] = useState(true);
  const [genFromToday, setGenFromToday] = useState(true);
  const [activeDay, setActiveDay] = useState<string>(today);

  const days = useMemo(() => Array.from({ length: 7 }, (_, k) => addDays(week, k)), [week]);

  const data = useData(
    async (ctx) => {
      const [meals, recipes, ingredients, prices, lists, favorites, pantry, products] = await Promise.all([
        owned(ctx.db, "meal_plan_items", ctx.householdId),
        visible(ctx.db, "recipes", ctx.householdId),
        visible(ctx.db, "recipe_ingredients", ctx.householdId),
        priceIndex(ctx.db, ctx.householdId),
        owned(ctx.db, "shopping_lists", ctx.householdId),
        owned(ctx.db, "favorite_recipes", ctx.householdId),
        owned(ctx.db, "pantry_items", ctx.householdId),
        visible(ctx.db, "products", ctx.householdId),
      ]);
      const weekMeals = meals.filter((m) => m.date >= week && m.date <= addDays(week, 6));
      const recipeMap = new Map(recipes.map((r) => [r.id, r]));
      const stock = pantryStock(pantry);
      const unitsMap = productUnitsOf(products);
      const ingByRecipe = new Map<string, typeof ingredients>();
      for (const ing of ingredients) {
        if (ing.deleted_at) continue;
        ingByRecipe.set(ing.recipe_id, [...(ingByRecipe.get(ing.recipe_id) ?? []), ing]);
      }
      const mealPantry = new Map<string, { have: number; total: number }>();
      for (const m of weekMeals) {
        const r = recipeMap.get(m.recipe_id);
        if (!r) continue;
        const needs = aggregateNeeds(recipeNeeds(r, ingByRecipe.get(r.id) ?? [], m.servings)).filter((n) => !STAPLE_PRODUCT_IDS.has(n.product_id));
        if (needs.length === 0) continue;
        const { remaining } = subtractStock(needs, stock, unitsMap);
        mealPantry.set(m.id, { have: needs.length - remaining.length, total: needs.length });
      }
      const costs = weekMeals.map((m) => {
        const r = recipeMap.get(m.recipe_id);
        return r ? recipeCost(r, ingByRecipe.get(r.id) ?? [], m.servings, prices) : null;
      });
      const favs = new Set(favorites.map((f) => f.recipe_id));
      return {
        meals: weekMeals,
        recipeMap,
        mealPantry,
        recipes: recipes.filter(isAvailableRecipe).sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.name.localeCompare(b.name, "ro")),
        favs,
        weekCost: sumMoney(costs.map((c) => c?.total ?? 0)),
        weekPriced: costs.reduce((n, c) => n + (c?.priced_count ?? 0), 0),
        weekCostable: costs.reduce((n, c) => n + (c?.costable_count ?? 0), 0),
        lists: lists.filter((l) => !l.archived_at),
      };
    },
    [week],
  );

  const pickResults = useMemo(() => {
    if (!data) return [];
    const words = normalize(pickQuery).split(" ").filter(Boolean);
    return data.recipes.filter((r) => words.every((w) => normalize(r.name).includes(w))).slice(0, 40);
  }, [data, pickQuery]);

  if (!data) return <Spinner />;

  async function generate() {
    const res = await run(async (ctx) => {
      const listId = genList || (await createList(ctx, { name: `Săptămâna ${formatShortDate(week)}` }));
      const r = await generateListFromPlan(ctx, { from: genFromToday && today > week ? today : week, to: addDays(week, 6), listId, subtractPantry: genPantry });
      return { ...r, listId };
    });
    if (res) {
      setGenerating(false);
      toast(`Lista e gata: ${res.added} produse noi${res.updated ? `, ${res.updated} cantități mărite` : ""}${res.covered ? `, ${res.covered} le ai deja în cămară` : ""}.`);
      router.push(`/cumparaturi/lista/?id=${res.listId}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Planul meselor"
        subtitle={
          <span>
            Săptămâna <span className="text-sm">{formatShortDate(week)} – {formatShortDate(addDays(week, 6))}</span>
            {/* Aceeași regulă ca la rețete: suma doar peste 80% din ingrediente cu preț (decizia proprietarului, 18 oct. 2026). */}
            {data.weekPriced > 0 &&
              (costAmount(data.weekCost, data.weekPriced, data.weekCostable) ? (
                <>
                  {" "}
                  · cost estimat <span className="text-sm">{costAmount(data.weekCost, data.weekPriced, data.weekCostable)}</span>
                </>
              ) : (
                ` · ${partialCostLabel(data.weekPriced, data.weekCostable)}`
              ))}
          </span>
        }
      />
      <RecipeNavigation active="plan" />

      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Săptămâna trecută" onClick={() => setWeek(addDays(week, -7))} className="bg-surface-container-low shadow-card transition-transform hover:bg-surface-container active:scale-[0.94]">
          <ChevronLeft size={20} />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={() => setWeek(startOfWeek(today))} disabled={week === startOfWeek(today)} className="transition-transform active:scale-[0.98]">
          Săptămâna asta
        </Button>
        <IconButton label="Săptămâna viitoare" onClick={() => setWeek(addDays(week, 7))} className="bg-surface-container-low shadow-card transition-transform hover:bg-surface-container active:scale-[0.94]">
          <ChevronRight size={20} />
        </IconButton>
        <div className="flex-1" />
        <IconButton
          label="Copiază mesele în săptămâna următoare"
          disabled={data.meals.length === 0}
          onClick={async () => {
            const n = await run((ctx) => copyWeek(ctx, week));
            if (n) {
              toast(`Am copiat ${n} mese în săptămâna următoare.`);
              setWeek(addDays(week, 7));
            }
          }}
          className="bg-surface-container-low shadow-card transition-transform hover:bg-surface-container active:scale-[0.94]"
        >
          <Copy size={18} />
        </IconButton>
      </div>

      <div className="app-card mb-4 grid grid-cols-7 gap-1 p-1.5" role="group" aria-label="Zilele săptămânii">
        {days.map((d) => {
          const hasMeals = data.meals.some((m) => m.date === d);
          const selected = activeDay === d || (activeDay < week || activeDay > addDays(week, 6)) && d === week;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setActiveDay(d);
                document.getElementById(`plan-day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-brand ${selected ? "bg-secondary text-on-secondary" : "text-ink hover:bg-surface-2"}`}
            >
              <span className="text-xs font-medium capitalize opacity-80">{formatWeekdayShort(d).replace(".", "")}</span>
              <span className="text-sm font-bold tabular-nums">{Number(d.slice(8, 10))}</span>
              <span className={`size-1.5 rounded-full ${hasMeals ? (selected ? "bg-on-secondary" : "bg-brand") : "bg-transparent"}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <Button block size="lg" icon={<BasketIcon size={20} />} disabled={data.meals.length === 0} onClick={() => setGenerating(true)} className="transition-transform active:scale-[0.99]">
        Generează lista de cumpărături
      </Button>

      <div className="mt-6 grid gap-4 min-[900px]:grid-cols-2">
        {days.map((d) => (
          <Card id={`plan-day-${d}`} key={d} as="section" aria-label={formatLongDate(d)} className={`p-4 sm:p-5 scroll-mt-20 ${d === today ? "ring-2 ring-brand ring-offset-2 ring-offset-bg" : d === activeDay ? "ring-2 ring-secondary/45" : ""}`}>
            <h2 className="mb-2.5 flex items-baseline gap-2 px-1">
              <span className="text-section-title font-semibold capitalize text-on-surface">{formatWeekdayShort(d)}</span>
              <span className="text-xs text-ink-2 tabular">{formatShortDate(d)}</span>
              {d === today && <span className="text-xs font-semibold uppercase tracking-wider text-brand">azi</span>}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {SLOTS.map((slot) => {
                const meals = data.meals.filter((m) => m.date === d && m.slot === slot);
                return (
                  <div key={slot} className="flex min-h-16 flex-col gap-1.5 rounded-2xl bg-surface-container/70 p-2.5 sm:p-3">
                    <div className="flex items-center justify-between pl-1">
                      <span className="text-xs font-medium text-ink-2">{SLOT_LABELS[slot]}</span>
                      <AddButton
                        aria-label={`Adaugă la ${SLOT_LABELS[slot]}, ${formatShortDate(d)}`}
                        onClick={() => {
                          setPicker({ date: d, slot });
                          setPickQuery("");
                        }}
                        className="-mr-1 -my-1"
                      />
                    </div>
                    {meals.map((m) => {
                      const r = data.recipeMap.get(m.recipe_id);
                      const coverage = data.mealPantry.get(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setEditing(m);
                            setMoveDate(m.date);
                            setMoveSlot(m.slot);
                          }}
                          className="flex min-h-12 flex-col items-stretch gap-1.5 rounded-xl bg-surface-container-low px-3 py-2 text-left text-sm leading-tight shadow-card transition-all duration-150 ease-out hover:bg-surface-2/50 active:scale-[0.98]"
                        >
                          <span className="flex items-start gap-1.5">
                            <span className="min-w-0 flex-1 font-sans text-sm font-semibold text-ink">{r?.name ?? "Rețetă ștearsă"}</span>
                            <span className="shrink-0 text-xs text-ink-2 tabular">{m.servings} p.</span>
                          </span>
                          {(r || coverage) && (
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                              {r && <span className="tabular-nums">{totalMinutes(r)} min</span>}
                              {coverage && (
                                <span className={`rounded-full px-2 py-0.5 font-medium tabular-nums ${coverage.have === coverage.total ? "bg-info-soft text-info" : "bg-surface-2 text-ink-2"}`}>
                                  {coverage.have}/{coverage.total} în cămară
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={Boolean(picker)} onClose={() => setPicker(null)} title={picker ? `${SLOT_LABELS[picker.slot]}, ${formatShortDate(picker.date)}` : ""}>
        <div className="mb-3 flex items-center gap-2 rounded-full border border-transparent bg-surface-container-high px-4 transition-colors duration-150 ease-out focus-within:border-brand focus-within:bg-surface">
          <Search size={16} className="text-ink-3" />
          <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder="Caută rețeta" aria-label="Caută rețeta" className="h-12 min-w-0 flex-1 bg-transparent focus:outline-none" autoFocus />
        </div>
        <ul className="flex flex-col">
          {pickResults.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={async () => {
                  const p = picker!;
                  setPicker(null);
                  await run((ctx) => addMeal(ctx, { date: p.date, slot: p.slot, recipe_id: r.id, servings: r.servings }));
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-left transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2"
              >
                <RecipeImage recipe={r} size="sm" avatar />
                <span className="flex-1 text-base font-medium leading-snug">
                  {r.name}
                  {data.favs.has(r.id) && <Heart size={14} className="ml-1.5 inline fill-accent text-accent align-middle" aria-label="Favorită" />}
                </span>
                <span className="shrink-0 text-xs text-ink-2">
                  <span>{r.servings}</span> porții
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? (data.recipeMap.get(editing.recipe_id)?.name ?? "Masă") : ""}>
        {editing && (
          <div className="flex flex-col gap-4">
            <LabeledInput
              label="Porții"
              type="number"
              min={1}
              max={50}
              defaultValue={editing.servings}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v !== editing.servings) void run((ctx) => updateMealServings(ctx, editing.id, v));
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Ziua" type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
              <LabeledSelect label="Masa" value={moveSlot} onChange={(e) => setMoveSlot(e.target.value as MealSlot)}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </LabeledSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await run((ctx) => moveMeal(ctx, editing.id, moveDate, moveSlot), "Am mutat masa.");
                  setEditing(null);
                  if (moveDate < week || moveDate > addDays(week, 6)) setWeek(startOfWeek(moveDate));
                }}
              >
                Mută aici
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await run((ctx) => duplicateMeal(ctx, editing.id, moveDate, moveSlot), "Am copiat masa.");
                  setEditing(null);
                }}
              >
                Copiază aici
              </Button>
            </div>
            <div className="flex gap-2">
              <Link href={`/retete/reteta/?id=${editing.recipe_id}`} className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-secondary-container font-medium text-on-secondary-container transition duration-150 ease-out hover:brightness-95">
                Vezi rețeta
              </Link>
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                onClick={async () => {
                  await run((ctx) => removeMeal(ctx, editing.id));
                  setEditing(null);
                }}
              >
                Scoate din plan
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={generating} onClose={() => setGenerating(false)} title="Lista pentru săptămână" footer={<Button block onClick={generate} disabled={busy}>Generează lista</Button>}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">Adunăm ingredientele tuturor meselor (cele comune se adună: 500 g + 300 g = 800 g) și le punem în listă fără dubluri.</p>
          <LabeledSelect label="În lista" value={genList} onChange={(e) => setGenList(e.target.value)}>
            <option value="">O listă nouă pentru săptămâna aceasta</option>
            {data.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </LabeledSelect>
          <Toggle checked={genPantry} onChange={setGenPantry} label="Scade ce am în cămară" description="Nu cumperi ce ai deja acasă." />
          {today > week && today <= addDays(week, 6) && <Toggle checked={genFromToday} onChange={setGenFromToday} label="Doar de azi încolo" description={`De la ${formatShortDate(today)}, nu și zilele trecute.`} />}
          <p className="text-xs text-ink-2">{data.meals.length} mese planificate în această săptămână.</p>
        </div>
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <PlanScreen />
    </AppShell>
  );
}
