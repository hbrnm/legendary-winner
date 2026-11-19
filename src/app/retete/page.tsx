"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RecipeNavigation } from "@/components/recipes/navigation";
import { Clock, Heart, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Chip, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { RECIPE_CATEGORY_LABELS } from "@/components/recipes/recipe-visual";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { normalize } from "@/lib/domain/search";
import { recipeCost, totalMinutes, whatCanICook, readyToCook } from "@/lib/domain/recipes";
import { productUnitsOf } from "@/lib/domain/quantities";
import { pantryStock } from "@/lib/domain/pantry";
import { costAmount, partialCostLabel } from "@/components/recipes/recipe-cost";
import type { Recipe } from "@/lib/domain/types";
import { filterRecipes, MEAL_CATEGORIES, type MealCategory, type RecipeStyle, type RecipeTimeFilter } from "@/lib/domain/recipe-filters";

const STYLES: RecipeStyle[] = ["carne", "peste", "vegetariene", "de_post", "traditionale"];

function RecipesScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MealCategory>("toate");
  const [time, setTime] = useState<RecipeTimeFilter | null>(null);
  const [style, setStyle] = useState<RecipeStyle | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [readyOnly,setReadyOnly] = useState(false);
  const [pantryOnly, setPantryOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(favoritesOnly) + Number(pantryOnly) + Number(readyOnly) + Number(!!time) + Number(!!style);

  const data = useData(async (ctx) => {
    const [recipes, ingredients, products, favorites, prices, pantry] = await Promise.all([
      visible(ctx.db, "recipes", ctx.householdId),
      visible(ctx.db, "recipe_ingredients", ctx.householdId),
      visible(ctx.db, "products", ctx.householdId),
      owned(ctx.db, "favorite_recipes", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "pantry_items", ctx.householdId),
    ]);
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
      pantryCount: pantry.filter((p) => p.quantity > 0).length,
    };
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterRecipes(data.recipes, { query, category, time, style, favoritesOnly, pantryOnly, readyOnly }, {
      readyRecipeIds: data.ready,
      searchText: data.searchText,
      favorites: data.favorites,
      pantryRecipeIds: new Set(data.cook.map((m) => m.recipe.id)),
    });
  }, [data, query, category, time, style, favoritesOnly, pantryOnly, readyOnly]);

  if (!data) return <Spinner />;

  // Tonal recipe cards remain compact on phones and form a grid on larger screens.
  function RecipeRow({ r, extra }: { r: Recipe; extra?: React.ReactNode }) {
    const c = data!.costs.get(r.id);
    const perServing = c ? costAmount(c.per_serving, c.priced_count, c.costable_count) : null;
    return (
      <li className="min-w-0 overflow-hidden rounded-[20px] bg-surface-container-low">
        <Link href={`/retete/reteta/?id=${r.id}`} className="flex h-full items-center gap-4 p-4 transition-colors duration-150 ease-out hover:bg-surface-container-high active:bg-surface-2">
          <RecipeImage recipe={r} avatar />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-sans text-[17px] font-medium leading-snug">
              {r.name}
              {data!.favorites.has(r.id) && <Heart size={14} className="ml-1.5 inline fill-accent text-accent" aria-label="favorită" />}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Clock size={13} strokeWidth={1.75} /> {totalMinutes(r)} min
              </span>
              <span>· {r.servings} porții</span>
              {c && c.priced_count > 0 && (
                <span>· {perServing ? `${perServing}/porție` : partialCostLabel(c.priced_count, c.costable_count)}</span>
              )}
              {r.household_id && <Badge tone="brand">a gospodăriei</Badge>}
            </div>
            {extra}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Rețete"
        subtitle={`${filtered.length === data.recipes.length ? data.recipes.length : `${filtered.length} din ${data.recipes.length}`} rețete`}
      />
      <RecipeNavigation active="retete" />

      <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:ring-2 focus-within:ring-brand/25">
        <Search size={18} className="text-ink-3" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după nume sau ingredient" aria-label="Caută rețete" className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none" />
        <button type="button" aria-expanded={filtersOpen} aria-controls="recipe-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="flex min-h-12 items-center gap-2 px-2 text-sm font-medium">
          <SlidersHorizontal size={18} /> Filtre{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>
      <div aria-label="Categoria mesei" className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {MEAL_CATEGORIES.map((c) => <span key={c.id} className="contents"><Chip active={category === c.id} onClick={() => setCategory(c.id)}><span className="whitespace-nowrap">{c.label}</span></Chip>{c.id==='toate'&&<Chip active={readyOnly} onClick={()=>setReadyOnly(!readyOnly)}><span className="whitespace-nowrap">Gata de gătit</span></Chip>}</span>)}
      </div>
      {filtersOpen && (
        <div id="recipe-filters" className="mt-2 rounded-2xl border border-line bg-surface p-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart size={14} /> Favorite</Chip>
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
      {filtered.length === 0 ? (
        <EmptyState title={(pantryOnly || readyOnly) && data.pantryCount === 0 ? "Cămara e goală" : favoritesOnly && data.favorites.size === 0 ? "Încă nu ai rețete favorite" : "Nicio rețetă găsită"} action={
          (query || category !== "toate" || activeFilters > 0) ? <Button variant="secondary" onClick={() => { setQuery(""); setCategory("toate"); setTime(null); setStyle(null); setFavoritesOnly(false); setPantryOnly(false); setReadyOnly(false); }}>Șterge filtrele</Button> : undefined
        }>
          {(pantryOnly || readyOnly) && data.pantryCount === 0 ? <Link href="/camara/" className="font-medium text-brand underline">Adaugă ce ai acasă</Link> : favoritesOnly ? "Apasă inima de pe o rețetă ca s-o găsești repede aici." : "Încearcă alt cuvânt sau alt filtru."}
        </EmptyState>
      ) : (
        <ul className="mt-3 grid gap-3 min-[900px]:grid-cols-2">
          {filtered.map((r) => <RecipeRow key={r.id} r={r} extra={pantryOnly ? <p className="mt-1 text-xs text-ink-2">{data.cook.find((m) => m.recipe.id === r.id)?.missing.length === 0 ? "Ai tot ce trebuie" : `Îți lipsesc ${data.cook.find((m) => m.recipe.id === r.id)?.missing.length} ingrediente`}</p> : undefined} />)}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <RecipesScreen />
    </AppShell>
  );
}
