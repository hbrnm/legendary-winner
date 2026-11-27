"use client";

import { useMemo, useState, type FormEvent } from "react";
import { catalogNutrition } from "@/data/nutrition-lookup";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Card } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { calorieDatabase } from "@/lib/db/calorie-database";
import { kcalFormat, type ProductNutritionLabel, type ProductNutritionSuggestion } from "@/lib/domain/calories";
import { recipeNutrition, scaleNutrition, type NutritionValues } from "@/lib/domain/recipes";
import type { Product, Recipe, RecipeIngredient } from "@/lib/domain/types";
import { AddRecipeCalories } from "./journal";
import { BarcodeLookup, NUTRIENT_FIELDS, NutritionNumbers } from "./barcode-lookup";

function NutritionLabelForm({ product, label, onClose }: { product: Product; label?: ProductNutritionLabel; onClose: () => void }) {
  const { ctx, mode } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<ProductNutritionSuggestion | null>(null);
  const [lookupStatus, setLookupStatus] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ctx || busy) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(NUTRIENT_FIELDS.map(([key]) => {
      const raw = String(form.get(key) ?? "").trim();
      return [key, raw ? Number(raw.replace(",", ".")) : Number.NaN];
    })) as unknown as NutritionValues;
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Introdu valori numerice pozitive sau zero.");
      return;
    }
    const basis = form.get("basis") === "ml" ? "ml" : "g";
    const state = form.get("preparation");
    const preparation = state === "raw" || state === "cooked" ? state : "as_sold";
    setBusy(true);
    try {
      const unchangedLabel = Boolean(
        label
        && label.basis === basis
        && label.preparation === preparation
        && NUTRIENT_FIELDS.every(([key]) => label.values[key] === values[key]),
      );
      const open_food_facts_code = applied?.code ?? (unchangedLabel ? label?.open_food_facts_code : undefined);
      await calorieDatabase().labels.put({ user_id: ctx.userId, product_id: product.id, basis, preparation, values, open_food_facts_code });
      toast("Valorile nutriționale au fost salvate.");
      onClose();
    } catch {
      setError("Valorile nu au putut fi salvate pe dispozitiv.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="font-semibold">{product.name}</p>
      {mode === "cloud" && (
        <details className="space-y-3 rounded-xl border border-line p-3">
          <summary className="cursor-pointer font-medium">Caută după codul de bare</summary>
          <BarcodeLookup
            initialCode={label?.open_food_facts_code ?? product.ean ?? ""}
            cloudAvailable
            acceptLabel="Confirmă produsul și preia valorile"
            onAccept={(suggestion) => {
              setApplied(suggestion);
              setLookupStatus("Valorile sunt în formular. Le poți corecta înainte de salvare.");
            }}
          />
          {lookupStatus && <p role="status" className="text-sm text-ink-2">{lookupStatus}</p>}
        </details>
      )}
      <div className="space-y-3" key={applied ? `off-${applied.code}` : "label"}>
        <LabeledSelect label="Baza de calcul" name="basis" defaultValue={applied?.nutrition?.basis ?? label?.basis ?? "g"}>
          <option value="g">La 100 g</option>
          <option value="ml">La 100 ml</option>
        </LabeledSelect>
        <LabeledSelect label="Starea produsului" name="preparation" defaultValue={applied ? "as_sold" : label?.preparation ?? "as_sold"}>
          <option value="as_sold">Așa cum se vinde</option>
          <option value="raw">Crud</option>
          <option value="cooked">Gătit</option>
        </LabeledSelect>
        {NUTRIENT_FIELDS.map(([key, title]) => (
          <LabeledInput key={key} name={key} label={`${title} (${key === "kcal" ? "kcal" : "g"})`} inputMode="decimal" required defaultValue={(applied?.nutrition?.values ?? label?.values)?.[key]} />
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează valorile</Button>
    </form>
  );
}

type NutritionAmount = { quantity: number; unit: "g" | "ml" };

function NutritionAmountForm({ name, initial, onApply }: {
  name: string;
  initial?: NutritionAmount;
  onApply: (amount: NutritionAmount) => void;
}) {
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(String(form.get("quantity") ?? "").trim().replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Introdu o cantitate mai mare decât zero.");
      return;
    }
    onApply({ quantity, unit: form.get("unit") === "ml" ? "ml" : "g" });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="font-semibold">{name}</p>
      <p className="text-sm text-ink-2">Introdu cantitatea folosită pentru toate porțiile afișate. Se aplică doar acestui calcul nutrițional.</p>
      <LabeledInput name="quantity" label="Cantitate" inputMode="decimal" required defaultValue={initial?.quantity} />
      <LabeledSelect name="unit" label="Unitate" defaultValue={initial?.unit ?? "g"}>
        <option value="g">Grame (g)</option>
        <option value="ml">Mililitri (ml)</option>
      </LabeledSelect>
      {error && <p role="alert" className="text-sm text-ink">{error}</p>}
      <Button block type="submit">Recalculează</Button>
    </form>
  );
}

export function RecipeNutritionCard({ recipe, ingredients, products, labels, servings }: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  products: ReadonlyMap<string, Product>;
  labels: readonly ProductNutritionLabel[];
  servings: number;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingAmount, setEditingAmount] = useState<{ id: string; name: string } | null>(null);
  const [amounts, setAmounts] = useState<Record<string, NutritionAmount>>({});
  const factor = servings / recipe.servings;
  const calculation = useMemo(() => recipeNutrition(
    recipe,
    ingredients.map((ingredient) => ({ ...ingredient, ...amounts[ingredient.id] })),
    catalogNutrition(products, labels),
  ), [recipe, ingredients, amounts, products, labels]);
  const hasAdjustedAmount = ingredients.some((ingredient) => amounts[ingredient.id] != null);
  const original = recipe.nutrition;
  const declared = servings === recipe.servings && !hasAdjustedAmount ? original : null;
  const perServing = declared ?? calculation.exact_per_serving;
  const total = perServing && scaleNutrition(perServing, servings);
  const excluded = calculation.contributions.filter((row) => !row.values && row.reason !== "Opțional").length;
  const excludedText = excluded === 1 ? "1 ingredient necalculat" : `${excluded} ingrediente necalculate`;
  const partial = !declared && excluded > 0;

  return (
    <Card as="section" className="space-y-4 p-4 sm:p-5" aria-label="Valori nutriționale">
      <h2 className="font-semibold">Valori nutriționale</h2>
      <div role="status" className="empty:hidden">
        {excluded > 0 && <p className="text-sm text-ink">{partial ? "Calcul parțial" : "Calcul pe ingrediente"} · {excludedText}</p>}
      </div>
      {perServing && total ? (
        <>
          <p className="text-sm text-ink-2">{declared ? "Valori declarate de sursă pentru rețeta originală" : "Estimare din ingrediente"}</p>
          <div className="grid gap-3 min-[390px]:grid-cols-2">
            <div className="rounded-2xl bg-surface-container-low p-3">
              <h3 className="mb-2 font-semibold">Per porție</h3>
              <NutritionNumbers values={perServing} fiber={declared?.fiber_g} />
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3">
              <h3 className="mb-2 font-semibold">Toată rețeta · {servings} porții</h3>
              <NutritionNumbers values={total} fiber={declared?.fiber_g == null ? undefined : declared.fiber_g * servings} />
            </div>
          </div>
        </>
      ) : <p className="text-sm text-ink-2">Calorii necunoscute. Lipsesc date pentru calcul.</p>}
      {original && !declared && <p className="text-sm text-ink-2">Sursa declară {kcalFormat.format(original.kcal)} kcal pentru o porție din rețeta originală.</p>}
      <details className="border-y border-line py-2">
        <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-brand">Contribuția estimată pe ingredient</summary>
        <ul className="divide-y divide-line">
          {calculation.contributions.map((row) => {
            const product = products.get(row.product_id);
            const label = labels.find((entry) => entry.product_id === row.product_id);
            const sourceCode = label?.open_food_facts_code;
            const amount = amounts[row.ingredient_id];
            const needsAmount = row.reason === "După gust" || row.reason === "Lipsește conversia cantității";
            const name = product?.name ?? row.product_id;
            return (
              <li key={row.ingredient_id} className="space-y-1 py-2">
                <p className="font-medium">{name}</p>
                {row.values ? (
                  <>
                    {row.source && <p className="text-xs text-ink-2">{sourceCode
                      ? <a className="underline" href={`https://world.openfoodfacts.org/product/${sourceCode}`} target="_blank" rel="noreferrer">{row.source} · ODbL</a>
                      : row.source}</p>}
                    <NutritionNumbers values={scaleNutrition(row.values, factor)} />
                  </>
                ) : <p className="text-sm text-ink">{row.reason}</p>}
                {(needsAmount || amount) && (
                  <Button variant="ghost" size="auto" onClick={() => setEditingAmount({ id: row.ingredient_id, name })}>
                    {amount ? "Modifică gramajul sau volumul" : row.reason === "După gust" ? "Introdu cantitatea" : "Introdu gramajul sau volumul"}
                  </Button>
                )}
                {amount && <Button variant="ghost" size="auto" onClick={() => setAmounts((previous) => {
                  const next = { ...previous };
                  delete next[row.ingredient_id];
                  return next;
                })}>Revino la cantitatea din rețetă</Button>}
                {product && !needsAmount && row.reason !== "Opțional" && row.reason !== "Absorbție necunoscută la prăjire" && (
                  <Button variant="ghost" onClick={() => setEditing(product)}>{sourceCode ? "Editează valorile" : label ? "Editează eticheta" : "Valori de pe etichetă"}</Button>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      <div className="space-y-3">
        <p className="text-sm text-ink">
          {perServing ? `În jurnal · ${kcalFormat.format(perServing.kcal)} kcal per porție` : "În jurnal · energia se poate introduce manual"}
          {partial && perServing && ` · Total parțial · ${excludedText}`}
        </p>
        {perServing && <p className="text-sm text-ink-2">
          Proteine {kcalFormat.format(perServing.protein_g)} g · Carbohidrați {kcalFormat.format(perServing.carbs_g)} g · Grăsimi {kcalFormat.format(perServing.fat_g)} g
        </p>}
        <AddRecipeCalories recipe={{ name: recipe.name, per_serving: perServing, source: declared ? "declared" : "estimated", incomplete: partial }} />
      </div>
      <Sheet open={editingAmount != null} title="Cantitate pentru calcul" onClose={() => setEditingAmount(null)}>
        {editingAmount && <NutritionAmountForm
          key={editingAmount.id}
          name={editingAmount.name}
          initial={amounts[editingAmount.id] && { ...amounts[editingAmount.id], quantity: amounts[editingAmount.id].quantity * factor }}
          onApply={(amount) => {
            setAmounts((previous) => ({ ...previous, [editingAmount.id]: { ...amount, quantity: amount.quantity / factor } }));
            setEditingAmount(null);
          }}
        />}
      </Sheet>
      <Sheet open={editing != null} title="Valori de pe etichetă" onClose={() => setEditing(null)}>
        {editing && <NutritionLabelForm key={editing.id} product={editing} label={labels.find((label) => label.product_id === editing.id)} onClose={() => setEditing(null)} />}
      </Sheet>
    </Card>
  );
}
