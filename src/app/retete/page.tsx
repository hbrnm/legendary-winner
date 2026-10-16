"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChefHat, Clock, Download, Heart, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/fields";
import { RECIPE_CATEGORY_LABELS } from "@/components/recipes/recipe-visual";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { normalize } from "@/lib/domain/search";
import { recipeCost, totalMinutes, whatCanICook } from "@/lib/domain/recipes";
import { productUnitsOf } from "@/lib/domain/quantities";
import { pantryStock } from "@/lib/domain/pantry";
import { formatRon } from "@/lib/domain/money";
import type { Recipe, RecipeCategoryId } from "@/lib/domain/types";

type Tab = "toate" | "favorite" | "camara";
const CATEGORY_FILTERS: RecipeCategoryId[] = ["mic_dejun", "supe_ciorbe", "traditionale", "carne", "peste", "vegetariene", "salate", "deserturi", "rapide", "meal_prep", "gustari"];

function RecipesScreen() {
  const [tab, setTab] = useState<Tab>("toate");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategoryId | null>(null);
  const [maxTime, setMaxTime] = useState<number | null>(null);

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
      cook: whatCanICook(recipes, ingredients, pantryStock(pantry), 0.5, productUnitsOf(products)),
      pantryCount: pantry.filter((p) => p.quantity > 0).length,
    };
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const words = normalize(query).split(" ").filter(Boolean);
    return data.recipes.filter((r) => {
      if (tab === "favorite" && !data.favorites.has(r.id)) return false;
      if (category && !r.categories.includes(category)) return false;
      if (maxTime && totalMinutes(r) > maxTime) return false;
      if (words.length && !words.every((w) => data.searchText.get(r.id)!.includes(w))) return false;
      return true;
    });
  }, [data, query, category, maxTime, tab]);

  if (!data) return <Spinner />;

  function RecipeRow({ r, extra }: { r: Recipe; extra?: React.ReactNode }) {
    const c = data!.costs.get(r.id);
    return (
      <li>
        <Link href={`/retete/reteta/?id=${r.id}`} className="block">
          <Card className="flex items-center gap-3 p-3 hover:bg-surface-2">
            <RecipeImage recipe={r} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">
                {r.name}
                {data!.favorites.has(r.id) && <Heart size={14} className="ml-1.5 inline fill-accent text-accent" aria-label="favorită" />}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} /> {totalMinutes(r)} min
                </span>
                <span>· {r.servings} porții</span>
                {c && c.priced_count > 0 && (
                  <span className="tabular">
                    · {formatRon(c.per_serving)}/porție{!c.complete && " (parțial)"}
                  </span>
                )}
                {r.household_id && <Badge>a gospodăriei</Badge>}
              </p>
              {extra}
            </div>
          </Card>
        </Link>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Rețete"
        subtitle={`${data.recipes.length} rețete`}
        action={
          <div className="flex gap-2">
            <Link href="/plan/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[15px] font-medium hover:bg-surface-2">
              <CalendarDays size={18} />
              <span className="hidden sm:inline">Planul meselor</span>
              <span className="sm:hidden">Plan</span>
            </Link>
            <Link href="/retete/import/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[15px] font-medium hover:bg-surface-2">
              <Download size={18} />
              Importă
            </Link>
            <Link href="/retete/editare/" aria-label="Rețetă nouă" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Plus size={20} />
            </Link>
          </div>
        }
      />

      <Segmented<Tab>
        label="Ce rețete arăt"
        value={tab}
        onChange={setTab}
        options={[
          { value: "toate", label: "Toate" },
          { value: "favorite", label: "Favorite" },
          { value: "camara", label: "Ce pot găti?" },
        ]}
      />

      {tab === "camara" ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-ink-2">Rețete pentru care ai în cămară și frigider cel puțin jumătate din ingrediente (sarea și piperul nu contează).</p>
          {data.pantryCount === 0 ? (
            <EmptyState icon={<ChefHat size={32} />} title="Cămara e goală" action={<Link href="/camara/" className="font-medium text-brand underline">Adaugă ce ai acasă</Link>}>
              Spune-ne ce ai în frigider și cămară și îți arătăm ce poți găti.
            </EmptyState>
          ) : data.cook.length === 0 ? (
            <EmptyState title="Nicio rețetă nu se potrivește încă">Adaugă mai multe produse în cămară sau caută o rețetă și vezi ce-ți lipsește.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.cook.slice(0, 30).map((m) => (
                <RecipeRow
                  key={m.recipe.id}
                  r={m.recipe}
                  extra={
                    <p className={`mt-1 text-xs ${m.missing.length === 0 ? "text-brand" : "text-ink-2"}`}>
                      {m.missing.length === 0 ? "Ai tot ce trebuie" : `Îți ${m.missing.length === 1 ? "lipsește 1 ingredient" : `lipsesc ${m.missing.length} ingrediente`}`}
                    </p>
                  }
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
            <Search size={18} className="text-ink-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută după nume sau ingredient (ex. dovlecei)"
              aria-label="Caută rețete"
              className="h-12 min-w-0 flex-1 bg-transparent text-base placeholder:text-ink-3 focus:outline-none"
            />
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={maxTime === 30} onClick={() => setMaxTime(maxTime === 30 ? null : 30)}>
              <Clock size={14} /> sub 30 min
            </Chip>
            <Chip active={maxTime === 60} onClick={() => setMaxTime(maxTime === 60 ? null : 60)}>
              sub 1 oră
            </Chip>
            {CATEGORY_FILTERS.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {RECIPE_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
          <p className="mb-2 mt-3 text-sm text-ink-2">{filtered.length === data.recipes.length ? "" : `${filtered.length} rezultate`}</p>
          {filtered.length === 0 ? (
            <EmptyState
              title={tab === "favorite" && data.favorites.size === 0 ? "Încă nu ai rețete favorite" : "Nicio rețetă găsită"}
              action={
                (query || category || maxTime) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setCategory(null);
                      setMaxTime(null);
                    }}
                  >
                    Șterge filtrele
                  </Button>
                )
              }
            >
              {tab === "favorite" ? "Apasă inima de pe o rețetă ca s-o găsești repede aici." : "Încearcă alt cuvânt sau alt filtru."}
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((r) => (
                <RecipeRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </>
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
