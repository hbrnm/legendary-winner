"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { Card, PageHeader, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { RecipeVisual, SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { addMeal, copyWeek, duplicateMeal, generateListFromPlan, moveMeal, removeMeal, updateMealServings } from "@/lib/services/kitchen";
import { createList } from "@/lib/services/shopping";
import { addDays, formatShortDate, formatWeekdayShort, startOfWeek, toISODate } from "@/lib/domain/dates";
import { recipeCost } from "@/lib/domain/recipes";
import { normalize } from "@/lib/domain/search";
import { formatRon, sumMoney } from "@/lib/domain/money";
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

  const days = useMemo(() => Array.from({ length: 7 }, (_, k) => addDays(week, k)), [week]);

  const data = useData(
    async (ctx) => {
      const [meals, recipes, ingredients, prices, lists, favorites] = await Promise.all([
        owned(ctx.db, "meal_plan_items", ctx.householdId),
        visible(ctx.db, "recipes", ctx.householdId),
        visible(ctx.db, "recipe_ingredients", ctx.householdId),
        priceIndex(ctx.db, ctx.householdId),
        owned(ctx.db, "shopping_lists", ctx.householdId),
        owned(ctx.db, "favorite_recipes", ctx.householdId),
      ]);
      const weekMeals = meals.filter((m) => m.date >= week && m.date <= addDays(week, 6));
      const recipeMap = new Map(recipes.map((r) => [r.id, r]));
      const costs = weekMeals.map((m) => {
        const r = recipeMap.get(m.recipe_id);
        return r ? recipeCost(r, ingredients.filter((i) => i.recipe_id === r.id), m.servings, prices) : null;
      });
      const favs = new Set(favorites.map((f) => f.recipe_id));
      return {
        meals: weekMeals,
        recipeMap,
        recipes: recipes.sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.name.localeCompare(b.name, "ro")),
        favs,
        weekCost: sumMoney(costs.map((c) => c?.total ?? 0)),
        weekCostComplete: costs.every((c) => c?.complete),
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
          <span className="tabular">
            Săptămâna {formatShortDate(week)} – {formatShortDate(addDays(week, 6))}
            {data.meals.length > 0 && ` · cost estimat ${formatRon(data.weekCost)}${data.weekCostComplete ? "" : " (parțial)"}`}
          </span>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Săptămâna trecută" onClick={() => setWeek(addDays(week, -7))} className="border border-line bg-surface">
          <ChevronLeft size={20} />
        </IconButton>
        <Button variant="secondary" onClick={() => setWeek(startOfWeek(today))} disabled={week === startOfWeek(today)}>
          Săptămâna asta
        </Button>
        <IconButton label="Săptămâna viitoare" onClick={() => setWeek(addDays(week, 7))} className="border border-line bg-surface">
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
          className="border border-line bg-surface"
        >
          <Copy size={18} />
        </IconButton>
      </div>

      <Button block size="lg" icon={<ShoppingBasket size={20} />} disabled={data.meals.length === 0} onClick={() => setGenerating(true)}>
        Generează lista de cumpărături
      </Button>

      <div className="mt-5 flex flex-col gap-3">
        {days.map((d) => (
          <Card key={d} as="section" className={`p-3 ${d === today ? "ring-2 ring-brand/40" : ""}`}>
            <h2 className="mb-2 flex items-baseline gap-2 px-1">
              <span className="font-semibold capitalize">{formatWeekdayShort(d)}</span>
              <span className="text-sm text-ink-2">{formatShortDate(d)}</span>
              {d === today && <span className="text-xs font-medium text-brand">azi</span>}
            </h2>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SLOTS.map((slot) => {
                const meals = data.meals.filter((m) => m.date === d && m.slot === slot);
                return (
                  <div key={slot} className="flex min-h-12 items-center gap-2 rounded-xl bg-surface-2/60 px-2 py-1.5">
                    <span className="w-16 shrink-0 text-xs text-ink-2">{SLOT_LABELS[slot]}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {meals.map((m) => {
                        const r = data.recipeMap.get(m.recipe_id);
                        return (
                          <button key={m.id} type="button" onClick={() => {
                            setEditing(m);
                            setMoveDate(m.date);
                            setMoveSlot(m.slot);
                          }} className="flex min-h-9 items-center gap-2 rounded-lg bg-surface px-2 text-left text-sm shadow-card">
                            {r && <RecipeVisual recipe={r} size="sm" />}
                            <span className="min-w-0 flex-1 truncate">{r?.name ?? "Rețetă ștearsă"}</span>
                            <span className="text-xs text-ink-2 tabular">{m.servings} p.</span>
                          </button>
                        );
                      })}
                    </div>
                    <IconButton label={`Adaugă la ${SLOT_LABELS[slot]}, ${formatShortDate(d)}`} onClick={() => {
                      setPicker({ date: d, slot });
                      setPickQuery("");
                    }} className="h-9 w-9">
                      <Plus size={18} />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={Boolean(picker)} onClose={() => setPicker(null)} title={picker ? `${SLOT_LABELS[picker.slot]}, ${formatShortDate(picker.date)}` : ""}>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line px-3">
          <Search size={16} className="text-ink-3" />
          <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder="Caută rețeta" aria-label="Caută rețeta" className="h-11 flex-1 bg-transparent focus:outline-none" autoFocus />
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
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
              >
                <RecipeVisual recipe={r} size="sm" />
                <span className="flex-1">
                  {r.name}
                  {data.favs.has(r.id) && <span className="ml-1 text-xs text-accent">♥</span>}
                </span>
                <span className="text-xs text-ink-2">{r.servings} porții</span>
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
                  await run((ctx) => moveMeal(ctx, editing.id, moveDate, moveSlot), "Masa a fost mutată.");
                  setEditing(null);
                  if (moveDate < week || moveDate > addDays(week, 6)) setWeek(startOfWeek(moveDate));
                }}
              >
                Mută aici
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await run((ctx) => duplicateMeal(ctx, editing.id, moveDate, moveSlot), "Masa a fost duplicată.");
                  setEditing(null);
                }}
              >
                Duplică aici
              </Button>
            </div>
            <div className="flex gap-2">
              <Link href={`/retete/reteta/?id=${editing.recipe_id}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line font-medium">
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
