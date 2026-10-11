"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, SectionTitle, Spinner } from "@/components/ui/misc";
import { Field, Input, LabeledInput, LabeledSelect, TextArea } from "@/components/ui/fields";
import { RECIPE_CATEGORY_LABELS } from "@/components/recipes/recipe-visual";
import { saveRecipe } from "@/lib/services/kitchen";
import { productMap } from "@/lib/services/queries";
import { UNIT_CODES, unitLabel } from "@/lib/domain/units";
import type { Difficulty, RecipeCategoryId, UnitCode } from "@/lib/domain/types";

interface IngredientDraft {
  key: string;
  product_id: string;
  name: string;
  quantity: string;
  unit: UnitCode | "";
  note: string;
  optional: boolean;
}

const ALL_CATEGORIES = Object.keys(RECIPE_CATEGORY_LABELS) as RecipeCategoryId[];

type Source = {
  products: Map<string, { name: string }>;
  recipe: import("@/lib/domain/types").Recipe | null;
  ingredients: import("@/lib/domain/types").RecipeIngredient[];
  steps: import("@/lib/domain/types").RecipeStep[];
};

function Editor() {
  const params = useSearchParams();
  const id = params.get("id");
  const source = useData(
    async (ctx) => {
      const products = await productMap(ctx.db, ctx.householdId);
      if (!id) return { products, recipe: null, ingredients: [], steps: [] };
      const recipe = (await ctx.db.recipes.get(id)) ?? null;
      const ings = (await ctx.db.recipe_ingredients.where("recipe_id").equals(id).toArray()).filter((i) => !i.deleted_at).sort((a, b) => a.sort_order - b.sort_order);
      const st = (await ctx.db.recipe_steps.where("recipe_id").equals(id).toArray()).filter((s) => !s.deleted_at).sort((a, b) => a.position - b.position);
      return { products, recipe, ingredients: ings, steps: st };
    },
    [id],
  );
  if (!source) return <Spinner />;
  // Formularul pornește o singură dată din datele salvate (cheia îl reinițializează la altă rețetă).
  return <EditorForm key={id ?? "nou"} id={id} wantsGlobal={params.get("global") === "1"} source={source} />;
}

function EditorForm({ id, wantsGlobal, source }: { id: string | null; wantsGlobal: boolean; source: Source }) {
  const router = useRouter();
  const { isAppAdmin } = useApp();
  const { run, busy } = useAction();
  const r = source.recipe;
  const isGlobal = r ? r.household_id === null : wantsGlobal && isAppAdmin;
  const [name, setName] = useState(r?.name ?? "");
  const [description, setDescription] = useState(r?.description ?? "");
  const [categories, setCategories] = useState<RecipeCategoryId[]>(r?.categories ?? []);
  const [cuisine, setCuisine] = useState<"romaneasca" | "internationala">(r?.cuisine ?? "romaneasca");
  const [servings, setServings] = useState(String(r?.servings ?? 4));
  const [prep, setPrep] = useState(String(r?.prep_minutes ?? 15));
  const [cook, setCook] = useState(String(r?.cook_minutes ?? 30));
  const [difficulty, setDifficulty] = useState<Difficulty>(r?.difficulty ?? "usor");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    source.ingredients.map((i) => ({
      key: i.id,
      product_id: i.product_id,
      name: source.products.get(i.product_id)?.name ?? i.product_id,
      quantity: i.quantity == null ? "" : String(i.quantity).replace(".", ","),
      unit: i.unit ?? "",
      note: i.note ?? "",
      optional: i.optional,
    })),
  );
  const [steps, setSteps] = useState<string[]>(source.steps.length ? source.steps.map((s) => s.text) : [""]);

  if (isGlobal && !isAppAdmin) return <p className="text-ink-2">Rețetele din catalogul comun pot fi modificate doar de administratori.</p>;

  async function save() {
    const savedId = await run((ctx) =>
      saveRecipe(
        ctx,
        {
          name,
          description,
          categories,
          cuisine,
          servings: Number(servings),
          prep_minutes: Number(prep) || 0,
          cook_minutes: Number(cook) || 0,
          difficulty,
          image_url: source?.recipe?.image_url ?? null,
          ingredients: ingredients.map((i) => {
            const q = i.quantity.trim() ? Number(i.quantity.replace(",", ".")) : null;
            return { product_id: i.product_id, quantity: q, unit: q == null ? null : ((i.unit || "buc") as UnitCode), note: i.note.trim() || null, optional: i.optional };
          }),
          steps: steps.map((s) => s.trim()).filter(Boolean),
        },
        { id: id ?? undefined, global: isGlobal },
      ),
    );
    if (savedId) router.replace(`/retete/reteta/?id=${savedId}`);
  }

  const patch = (key: string, p: Partial<IngredientDraft>) => setIngredients((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="mb-4 flex items-center gap-1">
        <button type="button" onClick={() => router.back()} aria-label="Înapoi" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">{id ? "Modifică rețeta" : "Rețetă nouă"}</h1>
        {isGlobal && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-xs text-info">catalog comun</span>}
      </div>

      <div className="flex flex-col gap-4">
        <LabeledInput label="Numele rețetei" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        <Field label="Descriere scurtă">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-16" />
        </Field>
        <Field label="Categorii">
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c} active={categories.includes(c)} onClick={() => setCategories((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>
                {RECIPE_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Porții" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
          <LabeledSelect label="Dificultate" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option value="usor">Ușor</option>
            <option value="mediu">Mediu</option>
            <option value="dificil">Dificil</option>
          </LabeledSelect>
          <LabeledInput label="Pregătire (min)" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
          <LabeledInput label="Gătire (min)" inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
        </div>
        <LabeledSelect label="Bucătărie" value={cuisine} onChange={(e) => setCuisine(e.target.value as "romaneasca" | "internationala")}>
          <option value="romaneasca">Românească</option>
          <option value="internationala">Internațională</option>
        </LabeledSelect>
      </div>

      <SectionTitle>Ingrediente</SectionTitle>
      <p className="mb-2 text-sm text-ink-2">Alege din catalog, ca rețeta să poată calcula costul și lista de cumpărături. Lasă cantitatea goală pentru „după gust”.</p>
      <ProductSearch
        placeholder="Adaugă ingredient: ex. 500 g piept de pui"
        onPick={({ product, parsed }) => {
          if (!product) return;
          setIngredients((xs) => [
            ...xs,
            {
              key: crypto.randomUUID(),
              product_id: product.id,
              name: product.name,
              quantity: parsed.quantity ? String(parsed.quantity).replace(".", ",") : "",
              unit: parsed.unit ?? (parsed.quantity ? product.default_unit : ""),
              note: "",
              optional: false,
            },
          ]);
        }}
      />
      <ul className="mt-3 flex flex-col gap-2">
        {ingredients.map((i) => (
          <li key={i.key} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 font-medium">{i.name}</span>
              <IconButton label={`Scoate ${i.name}`} onClick={() => setIngredients((xs) => xs.filter((x) => x.key !== i.key))}>
                <Trash2 size={18} />
              </IconButton>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_8rem] gap-2">
              <Input inputMode="decimal" placeholder="după gust" aria-label={`Cantitate ${i.name}`} value={i.quantity} onChange={(e) => patch(i.key, { quantity: e.target.value })} />
              <select aria-label={`Unitate ${i.name}`} value={i.unit} onChange={(e) => patch(i.key, { unit: e.target.value as UnitCode })} className="h-11 rounded-xl border border-line bg-surface px-2">
                <option value="">—</option>
                {UNIT_CODES.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u, 2)}
                  </option>
                ))}
              </select>
              <Input placeholder="observație (ex. tocat)" aria-label={`Observație ${i.name}`} value={i.note} onChange={(e) => patch(i.key, { note: e.target.value })} maxLength={120} />
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={i.optional} onChange={(e) => patch(i.key, { optional: e.target.checked })} className="h-5 w-5 accent-[var(--brand)]" />
                opțional
              </label>
            </div>
          </li>
        ))}
      </ul>

      <SectionTitle>Pași</SectionTitle>
      <ol className="flex flex-col gap-2">
        {steps.map((s, k) => (
          <li key={k} className="flex gap-2">
            <span className="mt-2.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{k + 1}</span>
            <TextArea value={s} onChange={(e) => setSteps((xs) => xs.map((x, j) => (j === k ? e.target.value : x)))} aria-label={`Pasul ${k + 1}`} className="min-h-16" maxLength={1500} />
            <IconButton label={`Șterge pasul ${k + 1}`} onClick={() => setSteps((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== k) : [""]))}>
              <Trash2 size={18} />
            </IconButton>
          </li>
        ))}
      </ol>
      <Button variant="secondary" className="mt-2" icon={<Plus size={18} />} onClick={() => setSteps((xs) => [...xs, ""])}>
        Adaugă un pas
      </Button>

      <div className="mt-8">
        <Button type="submit" block size="lg" disabled={busy}>
          Salvează rețeta
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <Editor />
      </Suspense>
    </AppShell>
  );
}
