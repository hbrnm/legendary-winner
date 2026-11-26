"use client";

import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { calorieDatabase } from "@/lib/db/calorie-database";
import { energySummary, entryEnergy, kcalFormat, type CalorieEntry, type CalorieSnapshot } from "@/lib/domain/calories";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";

function todayDate() {
  return toISODate(now());
}

function Activation({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="space-y-4">
      <p>Jurnalul este personal. Intrările se păstrează în acest browser, pe acest dispozitiv, și sunt disponibile offline. Dacă ștergi datele aplicației din browser, jurnalul se pierde.</p>
      <Button block onClick={onActivate}>Activează jurnalul</Button>
    </div>
  );
}

function EntryForm({ entry, onSave }: { entry: CalorieEntry; onSave: (entry: CalorieEntry) => Promise<void> }) {
  const [date, setDate] = useState(entry.date);
  const [servings, setServings] = useState(String(entry.servings));
  const [energy, setEnergy] = useState(entry.manual_kcal == null ? "" : String(entry.manual_kcal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const manual = energy.trim() === "" ? null : Number(energy.replace(",", "."));
  const portions = Number(servings.replace(",", "."));
  const next = { ...entry, date, servings: portions, manual_kcal: manual };
  const preview = entryEnergy(next);

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
      <LabeledInput label="Data" type="date" max={todayDate()} required value={date} onChange={(e) => setDate(e.target.value)} />
      {entry.recipe && (
        <>
          <div className="grid grid-cols-4 gap-1" aria-label="Porții rapide" role="group">
            {([[0.5, "½"], [1, "1"], [1.5, "1½"], [2, "2"]] as const).map(([value, label]) => (
              <Button key={value} type="button" variant={portions === value ? "tonal" : "outlined"} aria-pressed={portions === value} onClick={() => setServings(String(value))}>{label}</Button>
            ))}
          </div>
          <LabeledInput label="Număr de porții" inputMode="decimal" required value={servings} onChange={(e) => setServings(e.target.value)} />
        </>
      )}
      {(!entry.recipe?.per_serving || entry.manual_kcal != null) && (
        <LabeledInput label={entry.recipe ? "Calorii pentru intrare (opțional)" : "Calorii (kcal)"} inputMode="decimal" required={!entry.recipe} value={energy} onChange={(e) => setEnergy(e.target.value)} />
      )}
      {entry.recipe && (
        <p aria-live="polite" className="text-sm text-ink-2">
          {preview == null || !Number.isFinite(preview) ? "Calorii necunoscute" : energySummary([next])}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <Button block type="submit" disabled={busy}>Salvează intrarea</Button>
    </form>
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
      <Button variant="outlined" onClick={() => setEntry({ id: crypto.randomUUID(), user_id: userId, date: todayDate(), recipe, servings: 1, manual_kcal: null })}>Adaugă în jurnal</Button>
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
  const date = selectedDate ?? today;
  const active = useLiveQuery(() => ctx ? calorieDatabase().preferences.get(ctx.userId) : undefined, [ctx?.userId], null);
  const todayRows = useLiveQuery(() => ctx ? calorieDatabase().entries.where("[user_id+date]").equals([ctx.userId, today]).toArray() : [], [ctx?.userId, today]);
  const otherRows = useLiveQuery(() => ctx && open && date !== today ? calorieDatabase().entries.where("[user_id+date]").equals([ctx.userId, date]).toArray() : [], [ctx?.userId, date, open, today]);
  const rows = date === today ? todayRows : otherRows;
  if (!ctx) return null;
  const { userId } = ctx;
  const db = calorieDatabase();

  return (
    <>
      <Button variant={active ? "tonal" : "ghost"} size="auto" block={Boolean(active)} onClick={() => { setSelectedDate(null); setOpen(true); }}>
        {active ? (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="shrink-0">Calorii azi</span>
            <span className="text-right tabular">{todayRows && energySummary(todayRows)}</span>
          </span>
        ) : "Jurnal calorii"}
      </Button>
      <Sheet open={open} title={deleting ? "Ștergi intrarea?" : editing ? (editing.existing ? "Editează intrarea" : "Adaugă calorii") : "Jurnal calorii"} onClose={() => { setOpen(false); setEditing(null); setDeleting(null); }}>
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
        ) : editing ? (
          <EntryForm key={editing.entry.id} entry={editing.entry} onSave={async (entry) => {
            if (editing.existing) {
              if (await db.entries.update(entry.id, { date: entry.date, servings: entry.servings, manual_kcal: entry.manual_kcal }) === 0) throw new Error("Intrarea a fost ștearsă.");
            } else await db.entries.add(entry);
            setSelectedDate(entry.date);
            setEditing(null);
          }} />
        ) : active ? (
          <div className="space-y-4">
            <LabeledInput label="Ziua jurnalului" type="date" max={today} value={date} onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }} />
            {rows && <p className="text-lg font-semibold" aria-live="polite">{energySummary(rows)}</p>}
            <Button variant="outlined" onClick={() => setEditing({ entry: { id: crypto.randomUUID(), user_id: userId, date, recipe: null, servings: 1, manual_kcal: null }, existing: false })}>Adaugă calorii</Button>
            {rows?.length === 0 && <p className="text-sm text-ink-2">Nu ai intrări pentru ziua aleasă.</p>}
            <ul className="divide-y divide-line">
              {rows?.map((entry) => (
                <li key={entry.id} className="space-y-1 py-3">
                  <p className="break-words font-semibold">{entry.recipe?.name ?? "Calorii introduse manual"}</p>
                  <p className="text-sm text-ink-2">{entry.recipe && `${kcalFormat.format(entry.servings)} ${entry.servings === 1 ? "porție" : "porții"} · `}{energySummary([entry])}
                    {entry.recipe && entry.manual_kcal == null && ` · ${entry.recipe.source === "declared" ? "Declarate" : "Estimate"}`}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditing({ entry, existing: true })}>Editează</Button>
                    <Button variant="ghost" onClick={() => setDeleting(entry)}>Șterge</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : <Activation onActivate={() => void db.preferences.put({ user_id: userId }).catch(() => toast("Jurnalul nu a putut fi activat."))} />)}
      </Sheet>
    </>
  );
}
