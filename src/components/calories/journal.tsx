"use client";

import { useState, type FormEvent } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/components/app/app-provider";
import { useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect, Segmented } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { defaultFoodFromItem, loadCalorieSearchCatalog, searchCalorieCatalog } from "@/data/calorie-search";
import { calorieDatabase } from "@/lib/db/calorie-database";
import { isGtin } from "@/lib/domain/barcode";
import {
  MEAL_SLOTS,
  dailyTotals,
  defaultMealForDate,
  energySummary,
  entryEnergy,
  entryNutrition,
  foodNutrition,
  foodUnitsFor,
  formatDailyMacros,
  formatFoodQuantity,
  formatMacros,
  goalProgress,
  kcalFormat,
  macroFormat,
  recentFoodChoices,
  type CalorieEntry,
  type CalorieGoal,
  type CalorieSnapshot,
  type FoodCalorieSnapshot,
  type FoodUnit,
} from "@/lib/domain/calories";
import { toISODate } from "@/lib/domain/dates";
import type { MealSlot } from "@/lib/domain/types";
import { now } from "@/lib/clock";
import { BarcodeLookup } from "./barcode-lookup";

const UNIT_LABELS: Record<FoodUnit, string> = {
  g: "grame (g)",
  ml: "mililitri (ml)",
  buc: "bucăți (buc)",
};

function todayDate() {
  return toISODate(now());
}

function ProgressBar({ pct, over, value, max, label }: { pct: number; over: boolean; value: number; max: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full rounded-full ${over ? "bg-accent" : "bg-brand"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MealSelect({ value, onChange }: { value: MealSlot; onChange: (meal: MealSlot) => void }) {
  return (
    <LabeledSelect label="Masă" value={value} onChange={(e) => onChange(e.target.value as MealSlot)}>
      {MEAL_SLOTS.map((m) => (
        <option key={m.slot} value={m.slot}>{m.label}</option>
      ))}
    </LabeledSelect>
  );
}

function Activation({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="space-y-4">
      <p>Jurnalul este personal. Intrările se păstrează în acest browser, pe acest dispozitiv, și sunt disponibile offline. Dacă ștergi datele aplicației din browser, jurnalul se pierde.</p>
      <Button block onClick={onActivate}>Activează jurnalul</Button>
    </div>
  );
}

function parseOptionalGoalNumber(raw: string, allowZero: boolean): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n <= 0)) return "invalid";
  return n;
}

function GoalForm({ goal, onSave, onCancel }: {
  goal?: CalorieGoal | null;
  onSave: (goal: CalorieGoal | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [kcal, setKcal] = useState(goal?.kcal == null ? "" : String(goal.kcal));
  const [protein, setProtein] = useState(goal?.protein_g == null ? "" : String(goal.protein_g));
  const [carbs, setCarbs] = useState(goal?.carbs_g == null ? "" : String(goal.carbs_g));
  const [fat, setFat] = useState(goal?.fat_g == null ? "" : String(goal.fat_g));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const k = parseOptionalGoalNumber(kcal, false);
    const p = parseOptionalGoalNumber(protein, true);
    const c = parseOptionalGoalNumber(carbs, true);
    const f = parseOptionalGoalNumber(fat, true);
    if (k === "invalid" || p === "invalid" || c === "invalid" || f === "invalid") {
      setError("Introdu valori numerice valide (mai mari decât 0 pentru calorii).");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const next = k == null && p == null && c == null && f == null
        ? null
        : { kcal: k, protein_g: p, carbs_g: c, fat_g: f };
      await onSave(next);
    } catch {
      setError("Obiectivul nu a putut fi salvat pe dispozitiv.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <LabeledInput label="Calorii (kcal / zi)" inputMode="decimal" placeholder="ex. 2000" value={kcal} onChange={(e) => setKcal(e.target.value)} />
      <LabeledInput label="Proteine (g / zi, opțional)" inputMode="decimal" placeholder="ex. 120" value={protein} onChange={(e) => setProtein(e.target.value)} />
      <LabeledInput label="Carbohidrați (g / zi, opțional)" inputMode="decimal" placeholder="ex. 220" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
      <LabeledInput label="Grăsimi (g / zi, opțional)" inputMode="decimal" placeholder="ex. 70" value={fat} onChange={(e) => setFat(e.target.value)} />
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează obiectivul</Button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Renunță</Button>
        {goal && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void onSave(null)}>Șterge obiectivul</Button>
        )}
      </div>
    </form>
  );
}

function EntryForm({ entry, onSave }: { entry: CalorieEntry; onSave: (entry: CalorieEntry) => Promise<void> }) {
  const [date, setDate] = useState(entry.date);
  const [meal, setMeal] = useState<MealSlot>(entry.meal ?? defaultMealForDate(now()));
  const [label, setLabel] = useState(entry.label ?? "");
  const [servings, setServings] = useState(String(entry.servings));
  const [energy, setEnergy] = useState(entry.manual_kcal == null ? "" : String(entry.manual_kcal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const manual = energy.trim() === "" ? null : Number(energy.replace(",", "."));
  const portions = Number(servings.replace(",", "."));
  const next: CalorieEntry = {
    ...entry,
    date,
    meal,
    logged_at: entry.logged_at ?? now().toISOString(),
    label: entry.recipe ? undefined : label.trim() || null,
    servings: portions,
    manual_kcal: manual,
  };
  const preview = entryEnergy(next);
  const previewMacros = entryNutrition(next);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!date || date > todayDate() || (entry.recipe && (!Number.isFinite(portions) || portions <= 0))
        || (manual != null && (!Number.isFinite(manual) || manual < 0)) || (!entry.recipe && manual == null)
        || (preview != null && !Number.isFinite(preview))) {
      setError("Verifică data, numărul de porții și caloriile.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSave(next);
    } catch {
      setError("Intrarea nu a putut fi salvată pe dispozitiv.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {entry.recipe && <p className="font-semibold">{entry.recipe.name}</p>}
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Data" type="date" max={todayDate()} required value={date} onChange={(e) => setDate(e.target.value)} />
        <MealSelect value={meal} onChange={setMeal} />
      </div>
      {!entry.recipe && (
        <LabeledInput label="Denumire (opțional)" placeholder="ex. Cafea cu lapte" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
      )}
      {entry.recipe && (
        <>
          <div className="grid grid-cols-4 gap-1" aria-label="Porții rapide" role="group">
            {([[0.5, "½"], [1, "1"], [1.5, "1½"], [2, "2"]] as const).map(([value, text]) => (
              <Button key={value} type="button" variant={portions === value ? "tonal" : "outlined"} aria-pressed={portions === value} onClick={() => setServings(String(value))}>{text}</Button>
            ))}
          </div>
          <LabeledInput label="Număr de porții" inputMode="decimal" required value={servings} onChange={(e) => setServings(e.target.value)} />
        </>
      )}
      {(!entry.recipe?.per_serving || entry.manual_kcal != null) && (
        <LabeledInput label={entry.recipe ? "Calorii pentru intrare (opțional)" : "Calorii (kcal)"} inputMode="decimal" required={!entry.recipe} value={energy} onChange={(e) => setEnergy(e.target.value)} />
      )}
      {entry.recipe && (
        <div aria-live="polite" className="space-y-0.5 text-sm text-ink-2">
          <p>{preview == null || !Number.isFinite(preview) ? "Calorii necunoscute" : energySummary([next])}</p>
          {previewMacros && <p className="tabular">{formatMacros(previewMacros)}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează intrarea</Button>
    </form>
  );
}

function FoodEntryForm({ entry, food, onSave }: { entry: CalorieEntry; food: FoodCalorieSnapshot; onSave: (entry: CalorieEntry) => Promise<void> }) {
  const [date, setDate] = useState(entry.date);
  const [meal, setMeal] = useState<MealSlot>(entry.meal ?? defaultMealForDate(now()));
  const [quantity, setQuantity] = useState(String(food.quantity));
  const [unit, setUnit] = useState<FoodUnit>(food.unit);
  const [energy, setEnergy] = useState(entry.manual_kcal == null ? "" : String(entry.manual_kcal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const units = foodUnitsFor(food);
  const unitOptions = units.includes(unit) ? units : [unit, ...units];
  const parsedQty = Number(quantity.replace(",", "."));
  const manual = energy.trim() === "" ? null : Number(energy.replace(",", "."));
  const nextFood: FoodCalorieSnapshot = { ...food, quantity: parsedQty, unit };
  const next: CalorieEntry = {
    ...entry,
    date,
    meal,
    logged_at: entry.logged_at ?? now().toISOString(),
    recipe: null,
    food: nextFood,
    manual_kcal: manual,
  };
  const preview = entryEnergy(next);
  const previewMacros = foodNutrition(nextFood);
  const quickAmounts = unit === "buc"
    ? ([[0.5, "½"], [1, "1"], [1.5, "1½"], [2, "2"]] as const)
    : ([[50, "50"], [100, "100"], [150, "150"], [200, "200"]] as const);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!date || date > todayDate() || !Number.isFinite(parsedQty) || parsedQty <= 0
        || (manual != null && (!Number.isFinite(manual) || manual < 0))
        || (preview != null && !Number.isFinite(preview))) {
      setError("Verifică data, cantitatea și caloriile.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSave(next);
    } catch {
      setError("Intrarea nu a putut fi salvată pe dispozitiv.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1">
        <p className="font-semibold">{food.name}</p>
        {food.open_food_facts_code && (
          <a className="text-xs text-brand underline" href={`https://world.openfoodfacts.org/product/${food.open_food_facts_code}`} target="_blank" rel="noreferrer">
            Sursă Open Food Facts · ODbL
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Data" type="date" max={todayDate()} required value={date} onChange={(e) => setDate(e.target.value)} />
        <MealSelect value={meal} onChange={setMeal} />
      </div>
      <div className="grid grid-cols-4 gap-1" aria-label="Cantități rapide" role="group">
        {quickAmounts.map(([value, text]) => (
          <Button key={value} type="button" variant={parsedQty === value ? "tonal" : "outlined"} aria-pressed={parsedQty === value} onClick={() => setQuantity(String(value))}>{text}</Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Cantitate" inputMode="decimal" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <LabeledSelect label="Unitate" value={unit} onChange={(e) => setUnit(e.target.value as FoodUnit)}>
          {unitOptions.map((u) => (
            <option key={u} value={u}>{UNIT_LABELS[u]}</option>
          ))}
        </LabeledSelect>
      </div>
      {(!food.per_100 || entry.manual_kcal != null) && (
        <>
          {!food.per_100 && (
            <p className="text-sm text-ink-2">Nu avem valorile pentru acest produs. Introdu caloriile sau valorile de pe etichetă.</p>
          )}
          <LabeledInput label="Calorii pentru intrare (opțional)" inputMode="decimal" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </>
      )}
      <div aria-live="polite" className="space-y-0.5 text-sm text-ink-2">
        <p>{preview == null || !Number.isFinite(preview) ? "Calorii necunoscute" : energySummary([next])}</p>
        {manual == null && previewMacros && <p className="tabular">{formatMacros(previewMacros)}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează intrarea</Button>
    </form>
  );
}

function AddFoodPicker({ userId, date, recentEntries, onSave }: {
  userId: string;
  date: string;
  recentEntries: readonly CalorieEntry[];
  onSave: (entry: CalorieEntry) => Promise<void>;
}) {
  const { mode } = useApp();
  const [addMode, setAddMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [picked, setPicked] = useState<CalorieEntry | null>(null);

  const catalog = useData(
    async (c) => (c.db && c.householdId ? loadCalorieSearchCatalog(c) : undefined),
    [],
  );

  if (picked) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" onClick={() => setPicked(null)}>Alege alt aliment</Button>
        {picked.food ? (
          <FoodEntryForm key={picked.id} entry={picked} food={picked.food} onSave={onSave} />
        ) : (
          <EntryForm key={picked.id} entry={picked} onSave={onSave} />
        )}
      </div>
    );
  }

  const hits = query.trim() && catalog ? searchCalorieCatalog(catalog, query, 12) : [];
  const recents = recentFoodChoices(recentEntries, 8);
  const suggestedMeal = defaultMealForDate(now());

  return (
    <div className="space-y-4">
      <Segmented
        label="Mod de adăugare"
        value={addMode}
        onChange={(nextMode) => setAddMode(nextMode)}
        options={[
          { value: "search", label: "Caută sau scanează" },
          { value: "manual", label: "Scrie manual" },
        ]}
      />
      {addMode === "manual" ? (
        <EntryForm
          key={`manual-${date}`}
          entry={{ id: crypto.randomUUID(), user_id: userId, date, meal: suggestedMeal, recipe: null, food: null, label: null, servings: 1, manual_kcal: null }}
          onSave={onSave}
        />
      ) : (
        <div className="space-y-3">
          <LabeledInput
            label="Caută un aliment sau o rețetă"
            placeholder="ex. lapte, ouă, omletă"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="button" variant="outlined" onClick={() => setScanOpen((open) => !open)}>
            {scanOpen ? "Închide codul de bare" : "Scanează codul de bare"}
          </Button>
          {scanOpen && (
            <div className="rounded-xl border border-line p-3">
              <BarcodeLookup
                initialCode={isGtin(query.trim()) ? query.trim() : ""}
                cloudAvailable={mode === "cloud"}
                findLocal={(gtin) => catalog?.findByGtin(gtin)?.suggestion ?? null}
                requireNutritionForAccept={false}
                acceptLabel="Alege produsul"
                onAccept={(suggestion) => {
                  const local = catalog?.findByGtin(suggestion.code);
                  const basis = suggestion.nutrition?.basis ?? local?.food.basis ?? "g";
                  const food: FoodCalorieSnapshot = {
                    name: [suggestion.name, suggestion.brand].filter(Boolean).join(" · ") || local?.food.name || suggestion.code,
                    per_100: suggestion.nutrition?.values ?? local?.food.per_100 ?? null,
                    basis,
                    piece_grams: local?.food.piece_grams ?? null,
                    grams_per_ml: local?.food.grams_per_ml ?? null,
                    quantity: local?.food.quantity ?? 100,
                    unit: local?.food.unit ?? basis,
                    source: suggestion.nutrition ? "Open Food Facts" : local?.food.source,
                    open_food_facts_code: suggestion.code,
                    product_id: local?.food.product_id,
                  };
                  setPicked({ id: crypto.randomUUID(), user_id: userId, date, meal: suggestedMeal, recipe: null, food, servings: 1, manual_kcal: null });
                }}
              />
            </div>
          )}
          {query.trim() === "" ? (
            recents.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink-2">Adăugate recent</p>
                <ul aria-label="Adăugate recent" className="divide-y divide-line">
                  {recents.map((item) => {
                    const name = item.recipe?.name ?? item.food?.name ?? item.label ?? "";
                    const detail = item.food
                      ? formatFoodQuantity(item.food)
                      : item.recipe
                        ? `${kcalFormat.format(item.servings)} ${item.servings === 1 ? "porție" : "porții"}`
                        : null;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                          onClick={() => setPicked({
                            ...item,
                            id: crypto.randomUUID(),
                            date,
                            meal: suggestedMeal,
                            logged_at: null,
                          })}
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-medium">{name}</span>
                            {detail && <span className="block text-xs text-ink-2">{detail}</span>}
                          </span>
                          <span className="shrink-0 text-sm text-ink-2 tabular">{energySummary([item])}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-ink-2">Scrie numele unui aliment din catalog sau al unei rețete, ori scanează codul de bare.</p>
            )
          ) : hits.length === 0 ? (
            <p className="text-sm text-ink-2">Niciun rezultat în catalog. Poți căuta după codul de bare sau alege «Scrie manual».</p>
          ) : (
            <ul aria-label="Rezultate alimente și rețete" className="divide-y divide-line">
              {hits.map((item) => {
                const badge = item.kind === "recipe"
                  ? item.snapshot.per_serving
                    ? `${kcalFormat.format(item.snapshot.per_serving.kcal)} kcal / porție`
                    : "Calorii necunoscute"
                  : item.per_100
                    ? `${kcalFormat.format(item.per_100.kcal)} kcal / 100 ${item.basis}`
                    : "Fără valori";
                const subtitle = item.kind === "recipe" ? "Rețetă" : item.source ?? "Produs din catalog";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                      onClick={() => {
                        if (item.kind === "recipe") {
                          setPicked({ id: crypto.randomUUID(), user_id: userId, date, meal: suggestedMeal, recipe: item.snapshot, servings: 1, manual_kcal: null });
                        } else {
                          setPicked({ id: crypto.randomUUID(), user_id: userId, date, meal: suggestedMeal, recipe: null, food: defaultFoodFromItem(item), servings: 1, manual_kcal: null });
                        }
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-medium">{item.name}</span>
                        <span className="block text-xs text-ink-2">{subtitle}</span>
                      </span>
                      <span className="shrink-0 text-sm text-ink-2 tabular">{badge}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete }: { entry: CalorieEntry; onEdit: () => void; onDelete: () => void }) {
  const itemMacros = entryNutrition(entry);
  const offCode = entry.food?.open_food_facts_code;
  return (
    <li className="space-y-1 py-3">
      <p className="break-words font-semibold">{entry.recipe?.name ?? entry.food?.name ?? (entry.label || "Calorii introduse manual")}</p>
      <p className="text-sm text-ink-2">
        {entry.recipe && `${kcalFormat.format(entry.servings)} ${entry.servings === 1 ? "porție" : "porții"} · `}
        {entry.food && `${formatFoodQuantity(entry.food)} · `}
        {energySummary([entry])}
        {entry.recipe && entry.manual_kcal == null && ` · ${entry.recipe.source === "declared" ? "Declarate" : "Estimate"}`}
        {entry.food && entry.manual_kcal == null && entry.food.source && !offCode && ` · ${entry.food.source}`}
      </p>
      {(itemMacros || (offCode && entry.manual_kcal == null)) && (
        <p className="text-xs text-ink-2 tabular">
          {itemMacros && formatMacros(itemMacros)}
          {itemMacros && offCode && entry.manual_kcal == null && " · "}
          {offCode && entry.manual_kcal == null && (
            <a className="underline" href={`https://world.openfoodfacts.org/product/${offCode}`} target="_blank" rel="noreferrer">Open Food Facts · ODbL</a>
          )}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onEdit}>Editează</Button>
        <Button variant="ghost" onClick={onDelete}>Șterge</Button>
      </div>
    </li>
  );
}

export function AddRecipeCalories({ recipe }: { recipe: CalorieSnapshot }) {
  const { ctx } = useApp();
  const toast = useToast();
  const [entry, setEntry] = useState<CalorieEntry | null>(null);
  const active = useLiveQuery(() => ctx ? calorieDatabase().preferences.get(ctx.userId) : undefined, [ctx?.userId], null);
  if (!ctx) return null;
  const { userId } = ctx;
  const db = calorieDatabase();
  return (
    <>
      <Button variant="outlined" onClick={() => setEntry({ id: crypto.randomUUID(), user_id: userId, date: todayDate(), meal: defaultMealForDate(now()), recipe, servings: 1, manual_kcal: null })}>Adaugă în jurnal</Button>
      <Sheet open={entry != null} title="Adaugă în jurnal" onClose={() => setEntry(null)}>
        {entry && (active ? (
          <EntryForm key={entry.id} entry={entry} onSave={async (value) => {
            await db.entries.add(value);
            setEntry(null);
            toast("Intrare salvată în jurnal.");
          }} />
        ) : <Activation onActivate={() => void db.preferences.put({ user_id: userId }).catch(() => toast("Jurnalul nu a putut fi activat."))} />)}
      </Sheet>
    </>
  );
}

export function HomeCalories({ today }: { today: string }) {
  const { ctx } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entry: CalorieEntry; existing: boolean } | null>(null);
  const [deleting, setDeleting] = useState<CalorieEntry | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const date = selectedDate ?? today;

  const active = useLiveQuery(() => ctx ? calorieDatabase().preferences.get(ctx.userId) : undefined, [ctx?.userId], null);
  const todayRows = useLiveQuery(() => ctx ? calorieDatabase().entries.where("[user_id+date]").equals([ctx.userId, today]).toArray() : [], [ctx?.userId, today]);
  const otherRows = useLiveQuery(() => ctx && open && date !== today ? calorieDatabase().entries.where("[user_id+date]").equals([ctx.userId, date]).toArray() : [], [ctx?.userId, date, open, today]);
  const allEntries = useLiveQuery(
    () => {
      if (!ctx || !open || !active) return [];
      const dbRef = calorieDatabase();
      const idx = dbRef.entries.where("[user_id+date]");
      return typeof idx.between === "function"
        ? idx.between([ctx.userId, Dexie.minKey], [ctx.userId, Dexie.maxKey]).toArray()
        : idx.equals([ctx.userId, date]).toArray();
    },
    [ctx?.userId, open, Boolean(active), date],
    [],
  );

  const rows = date === today ? todayRows : otherRows;
  if (!ctx) return null;
  const { userId } = ctx;
  const db = calorieDatabase();
  const goal = active?.goal ?? null;
  const todayTotals = todayRows ? dailyTotals(todayRows) : null;
  const homeGoalProgress = goal?.kcal && todayTotals ? goalProgress(todayTotals.kcal ?? 0, goal.kcal) : null;
  const dayTotals = rows ? dailyTotals(rows) : null;
  const dayGoalProgress = goal?.kcal && dayTotals ? goalProgress(dayTotals.kcal ?? 0, goal.kcal) : null;

  async function saveEntry(entry: CalorieEntry) {
    if (editing?.existing) {
      const updated = await db.entries.update(entry.id, {
        date: entry.date,
        meal: entry.meal ?? null,
        logged_at: entry.logged_at ?? now().toISOString(),
        servings: entry.servings,
        manual_kcal: entry.manual_kcal,
        food: entry.food ?? null,
        label: entry.label ?? null,
      });
      if (updated === 0) throw new Error("Intrarea a fost ștearsă.");
    } else {
      await db.entries.add(entry);
    }
    setSelectedDate(entry.date);
    setEditing(null);
  }

  const macroTargets = [
    { label: "Proteine", consumed: dayTotals?.macros?.protein_g ?? 0, target: goal?.protein_g },
    { label: "Carbohidrați", consumed: dayTotals?.macros?.carbs_g ?? 0, target: goal?.carbs_g },
    { label: "Grăsimi", consumed: dayTotals?.macros?.fat_g ?? 0, target: goal?.fat_g },
  ].flatMap((m) => (m.target != null ? [{ label: m.label, consumed: m.consumed, target: m.target }] : []));

  const mealGroups = rows
    ? MEAL_SLOTS
      .map((m) => ({ ...m, entries: rows.filter((r) => r.meal === m.slot) }))
      .filter((m) => m.entries.length > 0)
    : [];
  const unassignedRows = rows ? rows.filter((r) => !r.meal) : [];

  return (
    <>
      <Button variant={active ? "tonal" : "ghost"} size="auto" block={Boolean(active)} onClick={() => { setSelectedDate(null); setOpen(true); }}>
        {active ? (
          <span className="w-full space-y-1.5 py-0.5 text-left">
            <span className="flex w-full items-center justify-between gap-3">
              <span className="shrink-0">Calorii azi</span>
              <span className="text-right tabular">
                {todayRows && (goal?.kcal ? `${energySummary(todayRows)} / ${kcalFormat.format(goal.kcal)} kcal` : energySummary(todayRows))}
              </span>
            </span>
            {homeGoalProgress && goal?.kcal && (
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className={`block h-full rounded-full ${homeGoalProgress.over ? "bg-accent" : "bg-brand"}`} style={{ width: `${homeGoalProgress.pct}%` }} />
              </span>
            )}
          </span>
        ) : "Jurnal calorii"}
      </Button>
      <Sheet
        open={open}
        title={deleting ? "Ștergi intrarea?" : goalOpen ? "Obiectiv zilnic" : editing ? (editing.existing ? "Editează intrarea" : "Adaugă mâncare") : "Jurnal calorii"}
        onClose={() => { setOpen(false); setEditing(null); setDeleting(null); setGoalOpen(false); }}
      >
        {open && (deleting ? (
          <div className="space-y-4">
            <p>Intrarea va fi eliminată din totalul zilei.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)}>Renunță</Button>
              <Button variant="danger" onClick={async () => {
                try {
                  await db.entries.delete(deleting.id);
                  setDeleting(null);
                } catch {
                  toast("Intrarea nu a putut fi ștearsă.");
                }
              }}>Șterge</Button>
            </div>
          </div>
        ) : goalOpen ? (
          <GoalForm
            goal={goal}
            onCancel={() => setGoalOpen(false)}
            onSave={async (nextGoal) => {
              await db.preferences.put({ user_id: userId, goal: nextGoal });
              setGoalOpen(false);
              toast(nextGoal ? "Obiectivul zilnic a fost salvat." : "Obiectivul zilnic a fost șters.");
            }}
          />
        ) : editing ? (
          editing.existing ? (
            editing.entry.food ? (
              <FoodEntryForm key={editing.entry.id} entry={editing.entry} food={editing.entry.food} onSave={saveEntry} />
            ) : (
              <EntryForm key={editing.entry.id} entry={editing.entry} onSave={saveEntry} />
            )
          ) : (
            <AddFoodPicker userId={userId} date={editing.entry.date} recentEntries={allEntries ?? []} onSave={saveEntry} />
          )
        ) : active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <LabeledInput label="Ziua jurnalului" type="date" max={today} value={date} onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }} />
              </div>
              <Button type="button" variant="secondary" size="auto" onClick={() => setGoalOpen(true)}>
                {goal?.kcal ? "Obiectiv zilnic" : "Setează obiectiv"}
              </Button>
            </div>
            {rows && dayTotals && (
              <div className="space-y-2 rounded-2xl bg-surface-container-low p-3">
                <p className="text-lg font-semibold" aria-live="polite">{energySummary(rows)}</p>
                {dayGoalProgress && goal?.kcal && (
                  <div className="space-y-1">
                    <p className={`text-sm tabular ${dayGoalProgress.over ? "font-medium text-accent" : "text-ink-2"}`}>
                      {dayGoalProgress.over
                        ? `Depășit cu ${kcalFormat.format(Math.abs(dayGoalProgress.remaining))} kcal`
                        : `Rămase: ${kcalFormat.format(dayGoalProgress.remaining)} kcal`}
                      {" "}din {kcalFormat.format(goal.kcal)} kcal
                    </p>
                    <ProgressBar pct={dayGoalProgress.pct} over={dayGoalProgress.over} value={dayTotals.kcal ?? 0} max={goal.kcal} label="Progres calorii zilnice" />
                  </div>
                )}
                {dayTotals.macros && <p className="text-sm text-ink-2 tabular">{formatDailyMacros(dayTotals.macros)}</p>}
                {macroTargets.length > 0 && (
                  <div className="grid gap-2 pt-1 sm:grid-cols-3">
                    {macroTargets.map(({ label, consumed, target }) => {
                      const p = goalProgress(consumed, target);
                      return (
                        <div key={label} className="space-y-1">
                          <div className="flex justify-between text-xs text-ink-2 tabular">
                            <span>{label}</span>
                            <span>{macroFormat.format(consumed)} / {macroFormat.format(target)} g</span>
                          </div>
                          <ProgressBar pct={p.pct} over={p.over} value={consumed} max={target} label={`Progres ${label.toLowerCase()}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <Button variant="outlined" onClick={() => setEditing({ entry: { id: crypto.randomUUID(), user_id: userId, date, meal: defaultMealForDate(now()), recipe: null, food: null, label: null, servings: 1, manual_kcal: null }, existing: false })}>Adaugă mâncare</Button>
            {rows?.length === 0 && <p className="text-sm text-ink-2">Nu ai intrări pentru ziua aleasă.</p>}
            {mealGroups.map((group) => (
              <section key={group.slot} aria-label={group.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1 pt-2">
                  <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
                  <span className="text-xs text-ink-2 tabular">{energySummary(group.entries)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {group.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} onEdit={() => setEditing({ entry, existing: true })} onDelete={() => setDeleting(entry)} />
                  ))}
                </ul>
              </section>
            ))}
            {unassignedRows.length > 0 && (
              <ul className="divide-y divide-line">
                {unassignedRows.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onEdit={() => setEditing({ entry, existing: true })} onDelete={() => setDeleting(entry)} />
                ))}
              </ul>
            )}
          </div>
        ) : <Activation onActivate={() => void db.preferences.put({ user_id: userId }).catch(() => toast("Jurnalul nu a putut fi activat."))} />)}
      </Sheet>
    </>
  );
}
