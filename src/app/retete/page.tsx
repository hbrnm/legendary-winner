"use client";

import { useMemo, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecipeNavigation } from "@/components/recipes/navigation";
import { ArrowRight, ChevronDown, Clock, Heart, Search, SlidersHorizontal, Users } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Chip, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { RECIPE_CATEGORY_LABELS, RecipeMealBadge } from "@/components/recipes/recipe-visual";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { normalize } from "@/lib/domain/search";
import { recipeCost, totalMinutes, whatCanICook, readyToCook } from "@/lib/domain/recipes";
import { productUnitsOf, toShoppingNeed } from "@/lib/domain/quantities";
import { Sheet } from "@/components/ui/sheet";
import { LabeledSelect } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { formatQuantity } from "@/lib/domain/units";
import { addRecipeToList, toggleFavorite } from "@/lib/services/kitchen";
import { createList } from "@/lib/services/shopping";
import { pantryStock } from "@/lib/domain/pantry";
import { costAmount, partialCostLabel } from "@/components/recipes/recipe-cost";
import type { Recipe } from "@/lib/domain/types";
import { COLLECTION_MEALS, filterRecipes, matchesCollectionMeal, type RecipeStyle, type RecipeTimeFilter } from "@/lib/domain/recipe-filters";
import { isAvailableRecipe } from "@/data/recipes/visibility";

const STYLES: RecipeStyle[] = ["carne", "peste", "vegetariene", "de_post", "traditionale"];
const COLLECTION_CATEGORIES = [...COLLECTION_MEALS, { id: "alte", label: "Alte rețete" }] as const;

function RecipesScreen({ captureRef }: { captureRef: Ref<HTMLDivElement> }) {
  const router = useRouter();
  const { run, busy } = useAction();
  const toast = useToast();
  const submitting = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [listId, setListId] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [time, setTime] = useState<RecipeTimeFilter | null>(null);
  const [style, setStyle] = useState<RecipeStyle | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [readyOnly, setReadyOnly] = useState(false);
  const [pantryOnly, setPantryOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(favoritesOnly) + Number(pantryOnly) + Number(readyOnly) + Number(!!time) + Number(!!style);
  const hasFilters = Boolean(query.trim() || activeFilters);

  const data = useData(async (ctx) => {
    const [allRecipes, ingredients, products, favorites, prices, pantry, lists] = await Promise.all([
      visible(ctx.db, "recipes", ctx.householdId),
      visible(ctx.db, "recipe_ingredients", ctx.householdId),
      visible(ctx.db, "products", ctx.householdId),
      owned(ctx.db, "favorite_recipes", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "pantry_items", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
    ]);
    const recipes = allRecipes.filter(isAvailableRecipe);
    const productName = new Map(products.map((p) => [p.id, normalize(p.name)]));
    const byRecipe = new Map<string, string[]>();
    for (const i of ingredients) byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), i.product_id]);
    const searchText = new Map(recipes.map((r) => [r.id, normalize(`${r.name} ${(byRecipe.get(r.id) ?? []).map((p) => productName.get(p) ?? "").join(" ")}`)]));
    const costs = new Map(
      recipes.map((r) => {
        const c = recipeCost(r, ingredients.filter((i) => i.recipe_id === r.id), r.servings, prices);
        return [r.id, c];
      }),
    );
    return {
      recipes: recipes.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      searchText,
      favorites: new Set(favorites.map((f) => f.recipe_id)),
      costs,
      ready: readyToCook(recipes,ingredients,pantryStock(pantry),productUnitsOf(products)),
      cook: whatCanICook(recipes, ingredients, pantryStock(pantry), 0.5, productUnitsOf(products)),
      products: new Map(products.map(p => [p.id, p])),
      lists: lists.filter(list => !list.archived_at).sort((a, b) => a.sort_order - b.sort_order),
      pantryCount: pantry.filter((p) => p.quantity > 0).length,
    };
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterRecipes(data.recipes, { query, time, style, favoritesOnly, pantryOnly, readyOnly }, {
      readyRecipeIds: data.ready,
      searchText: data.searchText,
      favorites: data.favorites,
      pantryRecipeIds: new Set(data.cook.map((m) => m.recipe.id)),
    });
  }, [data, query, time, style, favoritesOnly, pantryOnly, readyOnly]);

  const near = useMemo(() => {
    if (!data || !readyOnly) return [];
    const candidates = filterRecipes(data.cook.map(match => match.recipe), { query, time, style, favoritesOnly }, {
      searchText: data.searchText,
      favorites: data.favorites,
      pantryRecipeIds: new Set(),
    });
    const ids = new Set(candidates.map(recipe => recipe.id));
    return data.cook.filter(match => match.missing.length > 0 && ids.has(match.recipe.id));
  }, [data, readyOnly, query, time, style, favoritesOnly]);

  if (!data) return <Spinner />;

  const preview = data.cook.find(match => match.recipe.id === previewId);
  const previewLines = preview?.missing.flatMap(need => {
    const product = data.products.get(need.product_id);
    if (!product) return [];
    return [{ name: product.name, ...toShoppingNeed(need, product.default_unit, product) }];
  }) ?? [];
  const targetList = data.lists?.find(list => list.id === listId) ?? data.lists?.[0];

  async function addMissing() {
    if (!preview || !previewLines.length || submitting.current) return;
    submitting.current = true;
    setPreviewError(false);
    try {
      const result = await run(async ctx => {
        const target = targetList?.id ?? await createList(ctx, { name: "Cumpărături" });
        const counts = await addRecipeToList(ctx, {
          recipeId: preview.recipe.id,
          servings: preview.recipe.servings,
          listId: target,
          onlyMissing: true,
          skipStaples: true,
          expectedNeeds: previewLines,
        });
        return { ...counts, target };
      });
      if (!result) {
        setPreviewError(true);
        return;
      }
      setPreviewId(null);
      toast(result.added || result.updated ? "Am adăugat ce lipsea." : "Ai deja ingredientele necesare.", {
        action: { label: "Vezi lista", run: () => router.push("/cumparaturi/lista/?id=" + result.target) },
      });
    } finally {
      submitting.current = false;
    }
  }

  const grouped = !showAll && !hasFilters;
  const groups = grouped ? COLLECTION_CATEGORIES.map(({ id, label }) => ({
    id, label, recipes: filtered.filter((recipe) => matchesCollectionMeal(recipe, id)),
  })).filter(({ id, recipes }) => id !== "alte" || recipes.length > 0) : [];
  const hasOverlappingCategories = groups.reduce((total, group) => total + group.recipes.length, 0) > filtered.length;

  function clearFilters() {
    setQuery("");
    setTime(null);
    setStyle(null);
    setFavoritesOnly(false);
    setPantryOnly(false);
    setReadyOnly(false);
  }

  // Tonal recipe cards remain compact on phones and form a grid on larger screens.
  function renderRecipeRow({ r, extra, action }: { r: Recipe; extra?: React.ReactNode; action?: React.ReactNode }) {
    const c = data!.costs.get(r.id);
    const perServing = c ? costAmount(c.per_serving, c.priced_count, c.costable_count) : null;
    const isFav = data!.favorites.has(r.id);
    const styleId = r.categories.find((c) => !["mic_dejun", "pranz", "cina", "gustari"].includes(c));
    const primaryTag = styleId ? RECIPE_CATEGORY_LABELS[styleId] : null;
    return (
      <li key={r.id} className="min-w-0 overflow-hidden app-card transition-all duration-150 ease-out hover:bg-surface-2/40 active:scale-[0.99]">
        <div className="flex items-center gap-2 pr-2">
          <Link href={`/retete/reteta/?id=${r.id}`} className="group flex min-w-0 flex-1 items-center gap-3.5 p-4 transition-colors duration-150 ease-out">
            <RecipeImage recipe={r} avatar />
            <div className="min-w-0 flex-1">
              {primaryTag && <span className="block text-xs font-semibold uppercase tracking-wider text-ink-2">{primaryTag}</span>}
              <p className="line-clamp-2 font-sans text-lg font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                {r.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
                <span className="inline-flex items-center gap-1 tabular">
                  <Clock size={13} strokeWidth={1.75} /> {totalMinutes(r)} min
                </span>
                <span className="tabular">· {r.servings} porții</span>
                {c && c.priced_count > 0 && (
                  <span className="tabular">· {perServing ? `${perServing}/porție` : partialCostLabel(c.priced_count, c.costable_count)}</span>
                )}
                {r.household_id && <Badge tone="brand">a gospodăriei</Badge>}
              </div>
              {extra}
            </div>
          </Link>
          <button
            type="button"
            aria-label={isFav ? `Scoate ${r.name} de la favorite` : `Adaugă ${r.name} la favorite`}
            aria-pressed={isFav}
            onClick={() => void run((ctx) => toggleFavorite(ctx, r.id))}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Heart size={18} className={isFav ? "fill-accent text-accent" : ""} />
          </button>
        </div>
        {action && <div className="px-4 pb-4">{action}</div>}
      </li>
    );
  }

  function renderRecipes(recipes: Recipe[]) {
    return (
      <ul className="grid gap-3 min-[900px]:grid-cols-2">
        {recipes.map((recipe) => {
          const missing = pantryOnly ? data!.cook.find((match) => match.recipe.id === recipe.id)?.missing.length : undefined;
          return renderRecipeRow({ r: recipe, action: readyOnly && <Link href={"/retete/reteta/?id=" + encodeURIComponent(recipe.id) + "&gatit=incepe"} aria-label={"Începe să gătești " + recipe.name} className="inline-flex min-h-12 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">Începe să gătești</Link>, extra: missing === undefined ? undefined : (
            <p className="mt-1 text-xs text-ink-2">{missing === 0 ? "Ai tot ce trebuie" : `Îți lipsesc ${missing} ingrediente`}</p>
          ) });
        })}
      </ul>
    );
  }

  return (
    <div className="kitchen-collection">
      <PageHeader
        title="Rețete"
        captureRef={captureRef}
        subtitle={`${filtered.length === data.recipes.length ? data.recipes.length : `${filtered.length} din ${data.recipes.length}`} rețete`}
      />
      <RecipeNavigation active="retete" />

      <div className="mt-4 flex items-center gap-2 rounded-full bg-surface-container-high px-4 transition-colors duration-150 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/25">
        <Search size={18} className="text-ink-3" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută rețete" aria-label="Caută rețete" className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none" />
        <button type="button" aria-expanded={filtersOpen} aria-controls="recipe-filters" onClick={() => setFiltersOpen(!filtersOpen)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${filtersOpen || activeFilters > 0 ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-container"}`}>
          <SlidersHorizontal size={18} /> Filtre{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>
      <div role="group" aria-label="Scurtături pentru colecție" className="mt-3 flex flex-wrap gap-2">
        <Chip active={showAll && !hasFilters} onClick={() => {
          clearFilters();
          setShowAll(!showAll || hasFilters);
        }}>{showAll && !hasFilters ? "Pe categorii" : "Vezi toate rețetele"}</Chip>
        <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={14} /> Favorite</Chip>
        <Chip active={readyOnly} onClick={() => setReadyOnly(!readyOnly)}>Gata de gătit</Chip>
      </div>
      {filtersOpen && (
        <div id="recipe-filters" className="mt-2 app-card p-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={pantryOnly} onClick={() => setPantryOnly(!pantryOnly)}>Ce pot găti</Chip>
          </div>
          <p className="mb-2 mt-3 text-xs font-medium text-ink-2">Timp</p>
          <div className="flex flex-wrap gap-2">
            {([{ id: "30", label: "Sub 30 min" }, { id: "60", label: "Sub 60 min" }, { id: "meal_prep", label: "Din timp" }] as const).map((t) => <Chip key={t.id} active={time === t.id} onClick={() => setTime(time === t.id ? null : t.id)}>{t.label}</Chip>)}
          </div>
          <p className="mb-2 mt-3 text-xs font-medium text-ink-2">Stil</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => <Chip key={s} active={style === s} onClick={() => setStyle(style === s ? null : s)}>{RECIPE_CATEGORY_LABELS[s]}</Chip>)}
          </div>
        </div>
      )}
      {pantryOnly && <p className="mt-3 text-sm text-ink-2">Ai cel puțin jumătate din ingrediente în cămară. Sarea și piperul nu contează.</p>}
      <div role="status" className="sr-only">{filtered.length} {filtered.length === 1 ? "rețetă" : "rețete"}</div>
      {readyOnly && filtered.length > 0 && <h2 className="mt-5 text-section-title font-semibold">Ai toate ingredientele</h2>}
      {filtered.length === 0 ? (
        <EmptyState title={(pantryOnly || readyOnly) && data.pantryCount === 0 ? "Cămara e goală" : favoritesOnly && data.favorites.size === 0 ? "Încă nu ai rețete favorite" : readyOnly ? "Nicio rețetă completă" : "Nicio rețetă găsită"} action={
          hasFilters ? <Button variant="secondary" onClick={clearFilters}>Șterge filtrele</Button> : undefined
        }>
          {(pantryOnly || readyOnly) && data.pantryCount === 0 ? <Link href="/camara/" className="font-medium text-brand underline">Adaugă ce ai acasă</Link> : favoritesOnly ? "Apasă inima de pe o rețetă ca s-o găsești repede aici." : "Încearcă alt cuvânt sau alt filtru."}
        </EmptyState>
      ) : grouped ? (
        <>
          {(() => {
            const featured = data.recipes.find((r) => data.ready.has(r.id)) ?? data.recipes.find((r) => data.favorites.has(r.id)) ?? data.recipes[0];
            if (!featured) return null;
            return (
              <section aria-label="Rețetă recomandată" className="mt-4 rounded-[24px] bg-meal-hero text-ink shadow-card">
                <Link href={`/retete/reteta/?id=${featured.id}`} className="block rounded-[24px] p-4 hover:bg-meal-hero-border/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2">
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                      {data.ready.has(featured.id) ? "Gata de gătit din cămară" : "Rețetă recomandată"}
                    </span>
                    <h2 className="mt-1 break-words text-lg font-bold leading-snug">{featured.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                      <span className="inline-flex items-center gap-1.5 tabular">
                        <Clock size={15} aria-hidden /> {totalMinutes(featured)} min
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular">
                        <Users size={15} aria-hidden /> {featured.servings} {featured.servings === 1 ? "porție" : "porții"}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand">
                        Vezi rețeta <ArrowRight size={16} aria-hidden />
                      </span>
                    </div>
                </Link>
              </section>
            );
          })()}
          <div className="mt-4 grid grid-cols-2 items-start gap-3">
            {groups.map(({ id, label, recipes }) => (
              <details key={id} name="recipe-categories" className="app-card kitchen-category group/category min-w-0">
                <summary className="relative flex min-h-24 cursor-pointer list-none flex-col items-start justify-between gap-2 rounded-[20px] p-4 pr-10 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-col items-start gap-2.5 min-[480px]:flex-row min-[480px]:items-center">
                    <RecipeMealBadge meal={id} size="sm" />
                    <div className="min-w-0">
                      <span className="kitchen-category-title block">{label}</span>
                      <span className="text-sm text-ink-2">{recipes.length} {recipes.length === 1 ? "rețetă" : "rețete"}</span>
                    </div>
                  </div>
                  <ChevronDown size={18} aria-hidden className="absolute right-4 bottom-4 shrink-0 text-ink-2 group-open/category:rotate-180" />
                </summary>
                <div className="rounded-b-[20px] border-t border-outline-variant bg-bg p-3">
                  {recipes.length ? renderRecipes(recipes) : <p className="px-2 text-sm text-ink-2">Încă nu sunt rețete pentru această masă.</p>}
                </div>
              </details>
            ))}
          </div>
          {hasOverlappingCategories && <p className="mt-2 text-sm text-ink-2">Unele rețete apar la mai multe mese. Totalul numără fiecare rețetă o singură dată.</p>}
        </>
      ) : (
        <div className="mt-3">{renderRecipes(readyOnly ? [...filtered].sort((a, b) => totalMinutes(a) - totalMinutes(b)) : filtered)}</div>
      )}
      {near.length > 0 && (
        <section aria-labelledby="near-ready-title" className="mt-6">
          <h2 id="near-ready-title" className="mb-3 text-section-title font-semibold">Îți mai lipsesc câteva ingrediente</h2>
          <ul className="grid gap-3 min-[900px]:grid-cols-2">
            {near.map(({ recipe, missing }) => renderRecipeRow({
              r: recipe,
              extra: (
                <p className="mt-2 text-sm text-on-surface-variant">
                  Lipsesc: {missing.map(ingredient => data.products.get(ingredient.product_id)?.name ?? ingredient.product_id).join(", ")}
                </p>
              ), action: (
                <Button variant="outlined" size="sm" className="max-w-full whitespace-normal" onClick={() => {
                  setPreviewError(false);
                  setPreviewId(recipe.id);
                  setListId("");
                }}>Adaugă ce lipsește pe listă</Button>
              ),
            }))}
          </ul>
        </section>
      )}
      <Sheet open={Boolean(preview && previewLines.length)} onClose={() => setPreviewId(null)} title="Ce lipsește" footer={
        <Button block disabled={busy} onClick={addMissing}>Adaugă pe listă</Button>
      }>
        <p className="text-sm text-on-surface-variant">{preview?.recipe.name} · {preview?.recipe.servings} {preview?.recipe.servings === 1 ? "porție" : "porții"}</p>
        <ul className="mt-3 divide-y divide-outline-variant">
          {previewLines.map((line, index) => (
            <li key={line.product_id + ":" + index} className="flex items-baseline justify-between gap-4 py-3">
              <span>{line.name}{line.note && <small className="block text-on-surface-variant">{line.note}</small>}</span>
              <strong className="shrink-0">{line.quantity == null ? "după gust" : formatQuantity(line.quantity, line.unit)}</strong>
            </li>
          ))}
        </ul>
        {previewError && <p role="alert" className="mb-3 text-sm text-error">Lista nu a fost actualizată. Verifică ingredientele și încearcă din nou.</p>}
        <LabeledSelect label="În lista" className="mt-1" value={targetList?.id ?? ""} onChange={event => setListId(event.target.value)}>
          {!targetList && <option value="">O listă nouă „Cumpărături”</option>}
          {data.lists?.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
        </LabeledSelect>
      </Sheet>
    </div>
  );
}

export default function Page() {
  const [captureTarget, setCaptureTarget] = useState<HTMLDivElement | null>(null);

  return (
    <AppShell captureTarget={captureTarget}>
      <RecipesScreen captureRef={setCaptureTarget} />
    </AppShell>
  );
}
