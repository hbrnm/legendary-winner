"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BasketIcon, CalendarPlus, Check, ChefHat, Clock, Heart, Minus, Pencil, Trash2, Users } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { AddButton, Button, IconButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionTitle, Spinner, PageTitle } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { ALLERGEN_LABELS, DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS, SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { CookingMode } from "@/components/recipes/cooking-mode";
import { cookingProgressKey, readCookingProgress, writeCookingProgress, type CookingProgress } from "@/lib/cooking-progress";
import { RecipePhotoPanel } from "@/components/recipes/recipe-photo";
import { owned, priceIndex, productMap } from "@/lib/services/queries";
import { addMeal, addRecipeToList, cookRecipe, deleteRecipe, toggleFavorite } from "@/lib/services/kitchen";
import { createList } from "@/lib/services/shopping";
import { activeIngredients, recipeAllergens, recipeCost, recipeNutrition, scaleIngredients, totalMinutes } from "@/lib/domain/recipes";
import { catalogNutrition } from "@/data/nutrition-lookup";
import { productUnitsOf, subtractStock } from "@/lib/domain/quantities";
import { pantryStock } from "@/lib/domain/pantry";
import { formatQuantity } from "@/lib/domain/units";
import { formatRon } from "@/lib/domain/money";
import { costAmount, costCoverage, partialCostLabel } from "@/components/recipes/recipe-cost";
import { capitalizeFirst } from "@/lib/domain/text";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { MealSlot } from "@/lib/domain/types";

function RecipeScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const cookingEntry = params.get("gatit");
  const resume = cookingEntry === "reia" || cookingEntry === "incepe";
  const startCooking = cookingEntry === "incepe";
  const { ctx } = useApp();
  if (!ctx) return <Spinner />;
  const cookingKey = cookingProgressKey(ctx.householdId, ctx.userId, id);
  return <RecipeDetails key={cookingKey + ":" + cookingEntry} id={id} cookingKey={cookingKey} resume={resume} startCooking={startCooking} />;
}

function RecipeDetails({ id, cookingKey, resume, startCooking }: { id: string; cookingKey: string; resume: boolean; startCooking: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { isAppAdmin } = useApp();
  const { run, busy } = useAction();
  const [cookingProgress, setCookingProgress] = useState(() => readCookingProgress(cookingKey));
  const [servingsOverride, setServings] = useState<number | null>(resume ? cookingProgress?.servings ?? null : null);
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [cookOpen, setCookOpen] = useState(false);
  const [cookingOpen, setCookingOpen] = useState(startCooking || (resume && cookingProgress !== null));
  const confirmingCook = useRef(false);

  function saveCookingProgress(next: CookingProgress | null) {
    setCookingProgress(next);
    writeCookingProgress(cookingKey, next);
  }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [listId, setListId] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [planDate, setPlanDate] = useState(toISODate(now()));
  const [planSlot, setPlanSlot] = useState<MealSlot>("cina");

  const data = useData(
    async (ctx) => {
      const recipe = await ctx.db.recipes.get(id);
      if (!recipe || recipe.deleted_at || (recipe.household_id && recipe.household_id !== ctx.householdId)) return { recipe: null } as const;
      const [ingredients, steps, products, prices, pantry, lists, fav] = await Promise.all([
        ctx.db.recipe_ingredients.where("recipe_id").equals(id).toArray(),
        ctx.db.recipe_steps.where("recipe_id").equals(id).toArray(),
        productMap(ctx.db, ctx.householdId),
        priceIndex(ctx.db, ctx.householdId),
        owned(ctx.db, "pantry_items", ctx.householdId),
        owned(ctx.db, "shopping_lists", ctx.householdId),
        ctx.db.favorite_recipes.where("recipe_id").equals(id).toArray(),
      ]);
      return {
        recipe,
        ingredients: activeIngredients(ingredients, id),
        steps: steps.filter((s) => !s.deleted_at).sort((a, b) => a.position - b.position),
        products,
        prices,
        stock: pantryStock(pantry),
        lists: lists.filter((l) => !l.archived_at).sort((a, b) => a.sort_order - b.sort_order),
        favorite: fav.some((f) => f.household_id === ctx.householdId && !f.deleted_at),
      };
    },
    [id],
  );

  const servings = servingsOverride ?? (data?.recipe ? data.recipe.servings : null);

  const view = useMemo(() => {
    if (!data?.recipe || servings == null) return null;
    const scaled = scaleIngredients(data.ingredients, data.recipe.servings, servings);
    const available = new Set(
      subtractStock(
        scaled.filter((i) => i.quantity != null).map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit: i.unit })),
        data.stock,
        productUnitsOf(data.products.values()),
      ).covered.map((c) => c.product_id),
    );
    for (const i of scaled) if (i.quantity == null && data.stock.some((s) => s.product_id === i.product_id && s.quantity > 0)) available.add(i.product_id);
    return {
      scaled,
      available,
      cost: recipeCost(data.recipe, data.ingredients, servings, data.prices, toISODate(now())),
      allergens: recipeAllergens(data.ingredients, data.products),
      nutrition: recipeNutrition(data.recipe, data.ingredients, catalogNutrition(data.products)),
    };
  }, [data, servings]);

  if (!data) return <Spinner />;
  if (!data.recipe) {
    return (
      <EmptyState title="Rețeta nu mai există" action={<Button onClick={() => router.push("/retete/")}>Înapoi la rețete</Button>}>
        Poate a fost ștearsă.
      </EmptyState>
    );
  }
  if (!view || servings == null) return <Spinner />;
  const r = data.recipe;
  const guidedProgress = cookingProgress ?? (cookingOpen ? { servings, stepId: null } : null);
  const nutrition = r.nutrition ?? view.nutrition.per_serving;
  const lists = data.lists;
  const canEdit = r.household_id !== null || isAppAdmin;
  const missingNames = view.cost.missing_product_ids.map((p) => data.products.get(p)?.name ?? p);
  const coverage = costCoverage(view.cost.priced_count, view.cost.costable_count);
  const perServing = costAmount(view.cost.per_serving, view.cost.priced_count, view.cost.costable_count);

  async function addToList() {
    const res = await run(async (ctx) => {
      const target = listId || (lists[0]?.id ?? (await createList(ctx, { name: "Cumpărături" })));
      const r2 = await addRecipeToList(ctx, { recipeId: id, servings: servings!, listId: target, onlyMissing });
      return { ...r2, target };
    });
    if (res) {
      setAddOpen(false);
      toast(
        res.added + res.updated === 0
          ? "Ai deja tot ce trebuie pentru această rețetă."
          : `Am pus ${res.added + res.updated} ${res.added + res.updated === 1 ? "ingredient" : "ingrediente"} în listă${res.covered ? `; ${res.covered} le ai deja` : ""}.`,
        { action: { label: "Vezi lista", run: () => router.push(`/cumparaturi/lista/?id=${res.target}`) } },
      );
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-1">
        <button type="button" onClick={() => router.back()} aria-label="Înapoi" className="-ml-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <IconButton label={data.favorite ? "Scoate de la favorite" : "Adaugă la favorite"} onClick={() => run((ctx) => toggleFavorite(ctx, id))}>
            <Heart size={20} className={data.favorite ? "fill-accent text-accent" : ""} />
          </IconButton>
          {canEdit && (
            <>
              <Link href={`/retete/editare/?id=${id}`} aria-label="Modifică rețeta" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
                <Pencil size={20} />
              </Link>
              <IconButton label="Șterge rețeta" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={20} />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <PageTitle variant="editorial" className="mt-4">{r.name}</PageTitle>
      <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">{r.description}</p>
      {r.source_url && <RecipeSource url={r.source_url} />}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.categories.map((c) => (
          <Badge key={c}>{RECIPE_CATEGORY_LABELS[c]}</Badge>
        ))}
        <Badge>{r.cuisine === "romaneasca" ? "Bucătărie românească" : "Bucătărie internațională"}</Badge>
      </div>

      <div className="kitchen-recipe-photo mt-4 empty:hidden"><RecipePhotoPanel recipe={r} /></div>
      <nav aria-label="În această rețetă" className="mt-4 flex flex-wrap gap-2">
        <a href="#ingrediente" className="inline-flex min-h-12 items-center rounded-full bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high">Ingrediente</a>
        <a href="#preparare" className="inline-flex min-h-12 items-center rounded-full bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high">Mod de preparare</a>
      </nav>

      {/* Timpul, dificultatea și porțiile pe aceeași foaie, separate de filete. */}
      <Card className="mt-4 grid grid-cols-2 gap-px overflow-hidden bg-outline-variant min-[480px]:grid-cols-3 text-center">
        <div className="bg-surface p-3.5">
          <Clock size={18} strokeWidth={1.75} className="mx-auto text-ink-2" />
          <p className="mt-1 text-sm font-semibold tabular text-ink">{totalMinutes(r)} min</p>
          <p className="text-xs text-ink-2 tabular">
            <span>{r.prep_minutes}</span> pregătire · <span>{r.cook_minutes}</span> gătire
          </p>
        </div>
        <div className="bg-surface p-3.5">
          <ChefHat size={18} strokeWidth={1.75} className="mx-auto text-ink-2" />
          <p className="mt-1 text-sm font-semibold text-ink">{DIFFICULTY_LABELS[r.difficulty]}</p>
          <p className="text-xs text-ink-2">dificultate</p>
        </div>
        <div className="col-span-2 bg-surface p-3.5 min-[480px]:col-span-1">
          <Users size={18} strokeWidth={1.75} className="mx-auto text-ink-2" />
          <div className="mt-1 flex items-center justify-center gap-1">
            <button type="button" aria-label="Mai puține porții" onClick={() => setServings(Math.max(1, servings - 1))} className="group inline-flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 transition-all duration-150 ease-out group-active:scale-[0.92] group-active:bg-line">
                <Minus size={14} />
              </span>
            </button>
            <span className="w-6 text-sm font-bold tabular" aria-live="polite">
              {servings}
            </span>
            <AddButton aria-label="Mai multe porții" onClick={() => setServings(Math.min(50, servings + 1))} disabled={servings >= 50} />
          </div>
          <p className="text-xs text-ink-2">porții</p>
        </div>
      </Card>

      {/* Suma apare doar peste 80% din ingrediente cu preț; altfel, pentru câte ingrediente e (decizia proprietarului, 18 oct. 2026). */}
      <Card className="mt-3 overflow-hidden p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink-2">{coverage === "partial" ? capitalizeFirst(partialCostLabel(view.cost.priced_count, view.cost.costable_count)) : "Cost estimat"}</span>
          <span className="shrink-0 text-lg font-bold tabular text-ink">{coverage === "none" ? "—" : coverage === "partial" ? formatRon(view.cost.total) : costAmount(view.cost.total, view.cost.priced_count, view.cost.costable_count)}</span>
        </div>
        {perServing && (
          <div className="mt-1 flex items-baseline justify-between text-sm">
            <span className="text-ink-2">pe porție</span>
            <span className="font-medium tabular text-ink">{perServing}</span>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-2">
          {view.cost.complete
            ? `Toate ingredientele au preț. Prețuri din ${view.cost.oldest_price_on === view.cost.newest_price_on ? formatShortDate(view.cost.newest_price_on!) : `${formatShortDate(view.cost.oldest_price_on!)} – ${formatShortDate(view.cost.newest_price_on!)}`}.`
            : view.cost.priced_count === 0
              ? "Costul apare după ce introduci prețuri: la cumpărături sau în Buget → Prețuri."
              : `Cost incomplet: ${view.cost.coverage_pct}% din ingrediente au preț. Lipsesc: ${missingNames.slice(0, 4).join(", ")}${missingNames.length > 4 ? "…" : ""}.`}
          {view.cost.priced_count > 0 && " Estimare generală, din prețurile tuturor surselor."}
          {view.cost.has_stale_price && " Unele prețuri sunt mai vechi de 3 luni."}
        </p>
      </Card>

      {view.allergens.length > 0 && (
        // Etichetă de borcan, ca „Expiră curând” (decizia proprietarului, 18 oct. 2026).
        <p data-testid="alergeni" className="mt-3 rounded-[20px] border border-dashed border-accent bg-surface px-4 py-3 text-sm text-ink">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">Conține:</span> {view.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}. Verifică și eticheta produselor folosite.
        </p>
      )}

      {data.steps.length > 0 && (
        <Button block className="mt-4" icon={<ChefHat size={20} aria-hidden />} onClick={() => {
          const progress = cookingProgress ?? { servings, stepId: null };
          setServings(progress.servings);
          saveCookingProgress(progress);
          setCookingOpen(true);
        }}>
          {cookingProgress ? "Reia gătitul" : "Începe să gătești"}
        </Button>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant={data.steps.length ? "secondary" : "primary"} size="auto" onClick={() => setAddOpen(true)} className="flex-col min-h-14 py-2.5 rounded-2xl transition-transform active:scale-[0.96]" icon={<BasketIcon size={20} />}>
          <span className="text-xs">În listă</span>
        </Button>
        <Button variant="secondary" size="auto" onClick={() => setPlanOpen(true)} className="flex-col min-h-14 py-2.5 rounded-2xl transition-transform active:scale-[0.96]" icon={<CalendarPlus size={20} />}>
          <span className="text-xs">Planifică</span>
        </Button>
        <Button variant="secondary" size="auto" onClick={() => setCookOpen(true)} className="flex-col min-h-14 py-2.5 rounded-2xl transition-transform active:scale-[0.96]" icon={<ChefHat size={20} />}>
          <span className="text-xs">Am gătit</span>
        </Button>
      </div>

      <SectionTitle><span id="ingrediente" className="scroll-mt-4">Ingrediente</span></SectionTitle>
      <ul className="divide-y divide-line overflow-hidden app-card">
        {view.scaled.map((i) => {
          const p = data.products.get(i.product_id);
          const have = view.available.has(i.product_id);
          return (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${have ? "bg-sprout text-sprout-ink" : "bg-surface-2 text-ink-3"}`} title={have ? "Ai în cămară" : undefined}>
                {have && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 text-[15px] text-ink font-medium">
                {p?.name ?? i.product_id}
                {i.note && <span className="font-normal text-ink-2">, {i.note}</span>}
                {i.optional && <span className="font-normal text-ink-2"> (opțional)</span>}
              </span>
              <span className="shrink-0 text-sm tabular text-ink-2">{i.quantity == null ? "după gust" : formatQuantity(i.quantity, i.unit)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 px-1 text-xs text-ink-2">Bifa verde: ai ingredientul în cămară, în cantitatea necesară.</p>

      <SectionTitle>Valori nutriționale</SectionTitle>
      {/* Parțial, cu ce lipsește (decizia proprietarului, 22 oct. 2026). */}
      {nutrition ? (
        <Card as="section" className="overflow-hidden p-4 sm:p-5" aria-label="Valori nutriționale">
          <p className="text-sm text-ink-2">Pe porție, aproximativ</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular text-ink">{nutrition.kcal} kcal</p>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            {(
              [
                ["Proteine", nutrition.protein_g],
                ["Glucide", nutrition.carbs_g],
                ["Grăsimi", nutrition.fat_g],
                ["Fibre", r.nutrition?.fiber_g],
              ] as const
            ).filter(([, g]) => g != null).map(([label, g]) => (
              <div key={label} className="flex items-baseline justify-between border-b border-line/40 pb-1 last:border-b-0 last:pb-0">
                <dt className="text-ink-2">{label}</dt>
                <dd className="font-medium tabular text-ink">{g} g</dd>
              </div>
            ))}
          </dl>
          {!r.nutrition && view.nutrition.missing.length > 0 && (
            <p className="mt-2 text-xs text-ink-2">
              Fără: {view.nutrition.missing.map((m) => `${data.products.get(m.product_id)?.name ?? m.product_id}${m.frying ? " (pentru prăjit)" : ""}`).join(", ")}.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-2">{r.nutrition ? "Valori declarate în colecția sursă." : "Din CIQUAL (Franța) și USDA (SUA), pentru ingredientele crude."}</p>
        </Card>
      ) : (
        <p className="text-xs text-ink-2">Valorile nutriționale nu sunt disponibile pentru această rețetă.</p>
      )}

      <SectionTitle><span id="preparare" className="scroll-mt-4">Mod de preparare</span></SectionTitle>
      <ol className="mt-2 flex flex-col gap-3">
        {data.steps.map((s, k) => (
          <li key={s.id} className="app-card flex gap-3.5 p-4">
            <span className="w-7 shrink-0 text-right font-sans text-xl font-bold leading-7 text-brand">{k + 1}.</span>
            <p className="max-w-[70ch] pt-0.5 text-base leading-relaxed text-ink">{s.text}</p>
          </li>
        ))}
      </ol>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Adaugă ingredientele în listă" footer={<Button block onClick={addToList} disabled={busy}>Adaugă pentru {servings} porții</Button>}>
        <div className="flex flex-col gap-4">
          <LabeledSelect label="În lista" value={listId} onChange={(e) => setListId(e.target.value)}>
            {data.lists.length === 0 && <option value="">O listă nouă „Cumpărături”</option>}
            {data.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </LabeledSelect>
          <Toggle checked={onlyMissing} onChange={setOnlyMissing} label="Doar ce lipsește din cămară" description="Scade ce ai deja acasă. Produsele aflate deja pe listă primesc cantitatea în plus." />
        </div>
      </Sheet>

      <Sheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Planifică rețeta"
        footer={
          <Button
            block
            disabled={busy}
            onClick={async () => {
              const ok = await run((ctx) => addMeal(ctx, { date: planDate, slot: planSlot, recipe_id: id, servings }), "Am pus rețeta în plan.");
              if (ok) setPlanOpen(false);
            }}
          >
            Pune în plan
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <LabeledInput label="Ziua" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          <LabeledSelect label="Masa" value={planSlot} onChange={(e) => setPlanSlot(e.target.value as MealSlot)}>
            {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </LabeledSelect>
          <p className="text-sm text-ink-2">Pentru {servings} porții. Din planul meselor poți genera apoi lista pentru toată săptămâna.</p>
        </div>
      </Sheet>

      {guidedProgress && data.steps.length > 0 && (
        <CookingMode
          open={cookingOpen}
          recipe={r.name}
          progress={{ ...guidedProgress, servings }}
          steps={data.steps}
          ingredients={view.scaled.map(ingredient => ({
            id: ingredient.id,
            name: [
              data.products.get(ingredient.product_id)?.name ?? ingredient.product_id,
              servings === r.servings ? ingredient.note : null,
              ingredient.optional ? "opțional" : null,
            ].filter(Boolean).join(", "),
            quantity: ingredient.quantity == null ? "după gust" : formatQuantity(ingredient.quantity, ingredient.unit),
          }))}
          onStep={stepId => saveCookingProgress({ servings, stepId })}
          onClose={() => {
            if (cookingOpen && !cookingProgress) saveCookingProgress(guidedProgress);
            setCookingOpen(false);
          }}
          onFinish={() => setCookOpen(true)}
        />
      )}

      <Sheet
        open={cookOpen}
        onClose={() => setCookOpen(false)}
        title="Ai gătit rețeta?"
        footer={
          <Button
            block
            disabled={busy}
            onClick={async () => {
              if (confirmingCook.current) return;
              confirmingCook.current = true;
              try {
                const res = await run((ctx) => cookRecipe(ctx, id, servings));
                if (!res) return;
                setCookOpen(false);
                setCookingOpen(false);
                saveCookingProgress(null);
                toast(res.updated ? `Am scăzut ${res.updated} ${res.updated === 1 ? "produs" : "produse"} din cămară.` : "Nimic de scăzut: ingredientele nu erau în cămară.");
              } finally {
                confirmingCook.current = false;
              }
            }}
          >
            Am gătit
          </Button>
        }
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Porții gătite</span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" aria-label="Mai puține porții gătite" disabled={servings <= 1} onClick={() => setServings(Math.max(1, servings - 1))}>−</Button>
            <span className="min-w-6 text-center tabular-nums">{servings}</span>
            <AddButton aria-label="Mai multe porții gătite" disabled={servings >= 50} onClick={() => setServings(Math.min(50, servings + 1))} />
          </div>
        </div>
        <p className="text-[15px] text-ink-2">
          Scădem din cămară cantitățile pentru {servings} porții, începând cu produsele care expiră primele. Ce nu e în cămară rămâne neschimbat.
        </p>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Ștergi rețeta?"
        message={r.household_id ? "Rețeta dispare pentru toată gospodăria. Mesele deja planificate cu ea rămân în istoric." : "Rețeta dispare din catalogul comun, pentru toți utilizatorii."}
        confirmLabel="Șterge"
        onConfirm={async () => {
          await run((ctx) => deleteRecipe(ctx, id), "Am șters rețeta.");
          router.push("/retete/");
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <RecipeScreen />
      </Suspense>
    </AppShell>
  );
}

/** De unde vine rețeta importată: numele site-ului, cu legătură către pagină (.tasks/009). */
function RecipeSource({ url }: { url: string }) {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    <p className="mt-1 text-sm text-ink-2">
      Sursa:{" "}
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="-my-3 inline-block py-3 underline underline-offset-2">
        {host}
      </a>
    </p>
  );
}
