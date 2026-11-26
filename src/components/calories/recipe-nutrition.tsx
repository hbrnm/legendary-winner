"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Card } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { calorieDatabase } from "@/lib/db/calorie-database";
import { kcalFormat, type ProductNutritionLabel, type ProductNutritionSuggestion } from "@/lib/domain/calories";
import { isGtin } from "@/lib/domain/barcode";
import { callLookupNutrition } from "@/lib/supabase/client";
import { scaleNutrition, type NutritionValues, type RecipeNutrition } from "@/lib/domain/recipes";
import type { Product, Recipe } from "@/lib/domain/types";
import { AddRecipeCalories } from "./journal";
import { BarcodeCamera } from "./barcode-camera";

const nutrients = [
  ["kcal", "Energie"],
  ["protein_g", "Proteine"],
  ["carbs_g", "Glucide"],
  ["fat_g", "Grăsimi"],
] as const;

function NutritionNumbers({ values, fiber }: { values: NutritionValues; fiber?: number }) {
  return (
    <dl className="space-y-1 text-sm">
      {nutrients.map(([key, label]) => (
        <div key={key} className="flex justify-between gap-1">
          <dt>{label}</dt>
          <dd className="font-semibold tabular">{kcalFormat.format(values[key])} {key === "kcal" ? "kcal" : "g"}</dd>
        </div>
      ))}
      {fiber != null && <div className="flex justify-between gap-1"><dt>Fibre</dt><dd className="font-semibold tabular">{kcalFormat.format(fiber)} g</dd></div>}
    </dl>
  );
}

function NutritionLabelForm({ product, label, onClose }: { product: Product; label?: ProductNutritionLabel; onClose: () => void }) {
  const { ctx, mode } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(label?.open_food_facts_code ?? product.ean ?? "");
  const [suggestion, setSuggestion] = useState<ProductNutritionSuggestion | null>(null);
  const [applied, setApplied] = useState<ProductNutritionSuggestion | null>(null);
  const [lookup, setLookup] = useState(false);
  const [status, setStatus] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const setBarcode = useCallback((value: string) => {
    setCode(value);
    setSuggestion(null);
    setStatus("");
  }, []);
  const acceptScan = useCallback((value: string) => {
    setBarcode(value);
    closeCamera();
    setStatus("Cod citit. Apasă «Caută produsul» pentru a verifica rezultatul.");
  }, [closeCamera, setBarcode]);

  async function search() {
    const gtin = code.trim();
    setSuggestion(null);
    if (!isGtin(gtin)) {
      setStatus("Verifică cifrele codului de bare.");
      return;
    }
    setLookup(true);
    setStatus("Se caută produsul…");
    try {
      const response = await callLookupNutrition(gtin);
      if (response.status === 429) {
        setStatus("Încearcă din nou peste câteva secunde. Poți completa și manual.");
        return;
      }
      if (!response.ok) throw new Error("lookup");
      const { product: found } = await response.json() as { product: ProductNutritionSuggestion | null };
      setSuggestion(found);
      setStatus(found ? (found.nutrition ? "Compară produsul, gramajul și valorile cu ambalajul." : "Datele nutriționale sunt incomplete. Completează valorile de pe ambalaj.") : "Codul nu a fost găsit. Poți completa valorile de pe ambalaj.");
    } catch {
      setStatus("Căutarea nu este disponibilă acum. Poți completa valorile manual.");
    } finally {
      setLookup(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ctx || busy) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(nutrients.map(([key]) => {
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
        && nutrients.every(([key]) => label.values[key] === values[key]),
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
        <details className="space-y-3 rounded-xl border border-line p-3" onToggle={(event) => {
          if (!event.currentTarget.open) closeCamera();
        }}>
          <summary className="cursor-pointer font-medium">Caută după codul de bare</summary>
          <LabeledInput label="Cod de bare" inputMode="numeric" maxLength={14} value={code} disabled={lookup} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (!lookup && !cameraOpen) void search();
          }} />
          <div className="flex flex-wrap gap-2">
            <Button size="auto" variant="outlined" disabled={lookup || cameraOpen} onClick={() => void search()}>Caută produsul</Button>
            {!cameraOpen && <Button size="auto" variant="ghost" disabled={lookup} onClick={() => setCameraOpen(true)}>Scanează codul</Button>}
          </div>
          {cameraOpen && <BarcodeCamera onRead={acceptScan} onClose={closeCamera} />}
          <p role="status" className="text-sm text-ink-2">{status}</p>
          {suggestion && (
            <div className="space-y-2">
              <p className="font-semibold">{[suggestion.name, suggestion.brand, suggestion.quantity].filter(Boolean).join(" · ") || suggestion.code}</p>
              <a className="text-sm text-brand underline" href={`https://world.openfoodfacts.org/product/${suggestion.code}`} target="_blank" rel="noreferrer">Sursă Open Food Facts · ODbL</a>
              {suggestion.nutrition && (
                <>
                  <p className="text-sm">La 100 {suggestion.nutrition.basis}</p>
                  <NutritionNumbers values={suggestion.nutrition.values} />
                  <Button size="auto" variant="tonal" onClick={() => { setApplied(suggestion); setSuggestion(null); setStatus("Valorile sunt în formular. Le poți corecta înainte de salvare."); }}>Confirmă produsul și preia valorile</Button>
                </>
              )}
            </div>
          )}
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
        {nutrients.map(([key, title]) => (
          <LabeledInput key={key} name={key} label={`${title} (${key === "kcal" ? "kcal" : "g"})`} inputMode="decimal" required defaultValue={(applied?.nutrition?.values ?? label?.values)?.[key]} />
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează valorile</Button>
    </form>
  );
}

export function RecipeNutritionCard({ recipe, calculation, products, labels, servings }: {
  recipe: Recipe;
  calculation: RecipeNutrition;
  products: ReadonlyMap<string, Product>;
  labels: readonly ProductNutritionLabel[];
  servings: number;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const original = recipe.nutrition;
  const declared = servings === recipe.servings ? original : null;
  const perServing = declared ?? calculation.exact_per_serving;
  const total = perServing && scaleNutrition(perServing, servings);
  const partial = !declared && calculation.missing.length > 0;
  const factor = servings / recipe.servings;

  return (
    <Card as="section" className="space-y-4 p-4 sm:p-5" aria-label="Valori nutriționale">
      {perServing && total ? (
        <>
          <p className="text-sm text-ink-2">{declared ? "Valori declarate de sursă pentru rețeta originală" : partial ? "Estimare parțială · ingrediente necalculate" : "Estimare din ingrediente"}</p>
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
        <summary className="min-h-10 cursor-pointer py-2 font-medium">Contribuția estimată pe ingredient</summary>
        <ul className="divide-y divide-line">
          {calculation.contributions.map((row) => {
            const product = products.get(row.product_id);
            const label = labels.find((entry) => entry.product_id === row.product_id);
            const sourceCode = label?.open_food_facts_code;
            return (
              <li key={row.ingredient_id} className="space-y-1 py-2">
                <p className="font-medium">{product?.name ?? row.product_id}</p>
                {row.values ? (
                  <>
                    {row.source && <p className="text-xs text-ink-2">{sourceCode
                      ? <a className="underline" href={`https://world.openfoodfacts.org/product/${sourceCode}`} target="_blank" rel="noreferrer">{row.source} · ODbL</a>
                      : row.source}</p>}
                    <NutritionNumbers values={scaleNutrition(row.values, factor)} />
                  </>
                ) : <p className="text-sm text-ink-2">{row.reason}</p>}
                {product && (
                  <Button variant="ghost" onClick={() => setEditing(product)}>{sourceCode ? "Editează valorile" : label ? "Editează eticheta" : "Valori de pe etichetă"}</Button>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      <AddRecipeCalories recipe={{ name: recipe.name, per_serving: perServing, source: declared ? "declared" : "estimated", incomplete: partial }} />
      <Sheet open={editing != null} title="Valori de pe etichetă" onClose={() => setEditing(null)}>
        {editing && <NutritionLabelForm key={editing.id} product={editing} label={labels.find((label) => label.product_id === editing.id)} onClose={() => setEditing(null)} />}
      </Sheet>
    </Card>
  );
}
