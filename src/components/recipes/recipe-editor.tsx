"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, SectionTitle } from "@/components/ui/misc";
import { Field, Input, LabeledInput, LabeledSelect, Select, TextArea } from "@/components/ui/fields";
import { RECIPE_CATEGORY_LABELS } from "@/components/recipes/recipe-visual";
import { saveRecipe } from "@/lib/services/kitchen";
import { addRecipePhoto, type NewRecipePhoto } from "@/lib/services/recipe-photos";
import { ImportedPhoto } from "@/components/recipes/imported-photo";
import { createProduct } from "@/lib/services/catalog";
import { visible } from "@/lib/services/queries";
import { UserError } from "@/lib/services/context";
import type { PreparedImport } from "@/lib/services/recipe-import";
import { UNIT_CODES, unitLabel } from "@/lib/domain/units";
import type { Difficulty, Product, Recipe, RecipeCategoryId, RecipeIngredient, RecipeStep, UnitCode } from "@/lib/domain/types";

interface IngredientDraft {
  key: string;
  /** "" = de ales (din import, fără produs potrivit). */
  product_id: string;
  name: string;
  quantity: string;
  unit: UnitCode | "";
  note: string;
  optional: boolean;
  /** Rândul din rețeta importată și denumirea citită din el. */
  text?: string;
  parsedName?: string;
  candidates?: Pick<Product, "id" | "name">[];
}

const ALL_CATEGORIES = Object.keys(RECIPE_CATEGORY_LABELS) as RecipeCategoryId[];

export type EditorSource = {
  products: Map<string, { name: string }>;
  recipe: Recipe | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

const qty = (q: number | null) => (q == null ? "" : String(q).replace(".", ","));

/**
 * Formularul rețetei: rețetă nouă, modificare sau confirmarea unei rețete
 * importate (`imported`), unde ingredientele fără produs sunt de ales.
 */
export function RecipeEditor({ id, isGlobal, source, imported, onBack }: { id: string | null; isGlobal: boolean; source: EditorSource; imported?: PreparedImport; onBack?: () => void }) {
  const router = useRouter();
  const { isAppAdmin } = useApp();
  const { run, busy } = useAction();
  const r = source.recipe;
  const d = imported?.draft;
  const [name, setName] = useState(r?.name ?? d?.name ?? "");
  const [description, setDescription] = useState(r?.description ?? d?.description ?? "");
  const [categories, setCategories] = useState<RecipeCategoryId[]>(r?.categories ?? []);
  const [cuisine, setCuisine] = useState<"romaneasca" | "internationala">(r?.cuisine ?? "romaneasca");
  const [servings, setServings] = useState(String(r?.servings ?? d?.servings ?? 4));
  const [prep, setPrep] = useState(String(r?.prep_minutes ?? d?.prep_minutes ?? 15));
  const [cook, setCook] = useState(String(r?.cook_minutes ?? d?.cook_minutes ?? 30));
  const [difficulty, setDifficulty] = useState<Difficulty>(r?.difficulty ?? "usor");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    imported
      ? imported.ingredients.map((i) => ({
          key: crypto.randomUUID(),
          product_id: i.product_id ?? "",
          name: (i.product_id && source.products.get(i.product_id)?.name) || "",
          quantity: qty(i.quantity),
          unit: i.unit ?? "",
          note: i.note ?? "",
          optional: i.optional,
          text: i.text,
          parsedName: i.name,
          candidates: i.candidates,
        }))
      : source.ingredients.map((i) => ({
          key: i.id,
          product_id: i.product_id,
          name: source.products.get(i.product_id)?.name ?? i.product_id,
          quantity: qty(i.quantity),
          unit: i.unit ?? "",
          note: i.note ?? "",
          optional: i.optional,
        })),
  );
  const [photo, setPhoto] = useState<Omit<NewRecipePhoto, "recipeId"> | null>(null);
  const [steps, setSteps] = useState<string[]>(source.steps.length ? source.steps.map((s) => s.text) : d?.steps.length ? d.steps : [""]);

  if (isGlobal && !isAppAdmin) return <p className="text-ink-2">Rețetele din catalogul comun pot fi modificate doar de administratori.</p>;

  const pending = ingredients.filter((i) => !i.product_id).length;

  async function save() {
    const savedId = await run(async (ctx) => {
      if (pending) throw new UserError("Alege produsul pentru fiecare ingredient sau scoate-l din rețetă.");
      const savedId = await saveRecipe(
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
          image_url: r?.image_url ?? null,
          // La modificare, sursa rămâne cea de la import.
          source_url: r ? (r.source_url ?? null) : (d?.source_url ?? null),
          ingredients: ingredients.map((i) => {
            const q = i.quantity.trim() ? Number(i.quantity.replace(",", ".")) : null;
            return { product_id: i.product_id, quantity: q, unit: q == null ? null : ((i.unit || "buc") as UnitCode), note: i.note.trim() || null, optional: i.optional };
          }),
          steps: steps.map((s) => s.trim()).filter(Boolean),
        },
        { id: id ?? undefined, global: isGlobal },
      );
      // Fotografia de pe site (.tasks/013), ca fotografia gospodăriei la rețetă.
      if (photo) await addRecipePhoto(ctx, { ...photo, recipeId: savedId });
      return savedId;
    });
    if (savedId) router.replace(`/retete/reteta/?id=${savedId}`);
  }

  const patch = (key: string, p: Partial<IngredientDraft>) => setIngredients((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const choose = (key: string, product: Pick<Product, "id" | "name">) => patch(key, { product_id: product.id, name: product.name });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="mb-4 flex items-center gap-1">
        <button type="button" onClick={() => (onBack ? onBack() : router.back())} aria-label="Înapoi" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">{imported ? "Verifică rețeta" : id ? "Modifică rețeta" : "Rețetă nouă"}</h1>
        {isGlobal && <span className="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-xs text-info">catalog comun</span>}
      </div>
      {imported && (
        <p className="mb-4 text-sm text-ink-2">
          Am citit rețeta{d?.source_url ? ` de pe ${new URL(d.source_url).hostname.replace(/^www\./, "")}` : ""}
          {imported.translation === "done" ? " și am tradus-o în română" : ""}. Verifică ce am înțeles, alege categoriile și produsele lipsă, apoi salvează.
        </p>
      )}
      {d?.image_url && (
        <ImportedPhoto imageUrl={d.image_url} site={new URL(d.source_url ?? d.image_url).hostname.replace(/^www\./, "")} onChange={setPhoto} />
      )}
      {imported?.translation === "failed" && (
        <p role="note" className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink">
          Nu am putut traduce rețeta, așa că am păstrat textul original. Îl poți corecta aici.
        </p>
      )}

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
      {pending > 0 && (
        <p role="status" className="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {pending === 1 ? "Un ingredient nu are încă produsul ales." : `${pending} ingrediente nu au încă produsul ales.`}
        </p>
      )}
      <ProductSearch
        allowNew={false}
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
        {ingredients.map((i) =>
          i.product_id ? (
            <li key={i.key} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{i.name}</span>
                  {i.text && <span className="block truncate text-xs text-ink-3">din rețetă: {i.text}</span>}
                </span>
                {i.text && (
                  <button type="button" onClick={() => patch(i.key, { product_id: "", name: "" })} className="h-11 shrink-0 rounded-lg px-2 text-sm text-brand hover:bg-surface-2">
                    Schimbă
                  </button>
                )}
                <IconButton label={`Scoate ${i.name}`} onClick={() => setIngredients((xs) => xs.filter((x) => x.key !== i.key))}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_8rem] gap-2">
                <Input inputMode="decimal" placeholder="după gust" aria-label={`Cantitate ${i.name}`} value={i.quantity} onChange={(e) => patch(i.key, { quantity: e.target.value })} />
                <select aria-label={`Unitate ${i.name}`} value={i.unit} onChange={(e) => patch(i.key, { unit: e.target.value as UnitCode })} className="h-11 rounded-lg border border-line bg-surface px-2">
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
          ) : (
            <PendingIngredient key={i.key} item={i} onChoose={(p) => choose(i.key, p)} onRemove={() => setIngredients((xs) => xs.filter((x) => x.key !== i.key))} />
          ),
        )}
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

/** Un ingredient importat fără produs: variantele propuse, căutarea în catalog sau un produs nou al gospodăriei. */
function PendingIngredient({ item, onChoose, onRemove }: { item: IngredientDraft; onChoose: (p: Pick<Product, "id" | "name">) => void; onRemove: () => void }) {
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [category, setCategory] = useState("");
  const categories = useData(async (ctx) => (await visible(ctx.db, "product_categories", ctx.householdId)).filter((c) => c.is_food).sort((a, b) => a.sort_order - b.sort_order));

  async function create() {
    const name = newName.trim();
    const id = await run((ctx) => createProduct(ctx, { name, category_id: category, default_unit: (item.unit || "buc") as UnitCode }));
    if (id) onChoose({ id, name });
  }

  return (
    <li className="rounded-lg border border-warn bg-warn-soft p-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">De ales:</span> {item.text}
        </p>
        <IconButton label={`Scoate ${item.text}`} onClick={onRemove}>
          <Trash2 size={18} />
        </IconButton>
      </div>
      {!!item.candidates?.length && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Produse propuse">
          {item.candidates.map((c) => (
            <Chip key={c.id} onClick={() => onChoose(c)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-2">
        <ProductSearch allowNew={false} placeholder="Caută produsul în catalog" onPick={({ product }) => product && onChoose(product)} />
      </div>
      {creating ? (
        <div className="mt-2 grid gap-2">
          <Input aria-label="Numele produsului nou" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} />
          <Select aria-label="Categoria produsului nou" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Alege categoria</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={busy || !newName.trim() || !category} onClick={() => void create()}>
            Adaugă produsul
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setNewName(item.parsedName ?? "");
            setCreating(true);
          }}
          className="mt-1 h-11 rounded-lg px-2 text-sm font-medium text-brand hover:bg-surface-2"
        >
          Nu e în catalog? Creează produsul
        </button>
      )}
    </li>
  );
}
