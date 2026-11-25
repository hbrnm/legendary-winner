"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "@/components/ui/icons";
import { useAction } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { now } from "@/lib/clock";
import { toISODate } from "@/lib/domain/dates";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import { parseMoney } from "@/lib/domain/money";
import type { ManualExpense, PurchaseSource, Retailer } from "@/lib/domain/types";
import { deleteExpense, updateExpense } from "@/lib/services/expenses";

/** Existing manual CRUD controls, embedded in the unified transaction row. */
export function ManualExpenseActions({ expense, retailers = [] }: { expense: ManualExpense; retailers?: Retailer[] }) {
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [editing, setEditing] = useState<ManualExpense | null>(null);
  const [removing, setRemoving] = useState<ManualExpense | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ExpenseCategoryId>("altele");
  const [place, setPlace] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [source, setSource] = useState<PurchaseSource | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openForm(expense: ManualExpense) {
    setEditing(expense);
    setError(null);
    setDescription(expense.description);
    setAmount(expense.amount.toFixed(2).replace(".", ","));
    setDate(expense.spent_on);
    setCategory(expense.category_id);
    setPlace(expense.place_name ?? "");
    setRetailerId(expense.retailer_id ?? "");
    setSource(expense.source ?? "");
    setNote(expense.note ?? "");
  }

  async function save() {
    const value = parseMoney(amount);
    if (!description.trim()) return setError("Scrie descrierea cheltuielii.");
    if (value == null || value <= 0) return setError("Scrie o sumă mai mare decât zero, cu cel mult două zecimale.");
    if (!date || date > today) return setError("Alege data plății, până astăzi.");
    if (!editing) return;
    // Keep absent legacy metadata and historical retailer references intact on unrelated edits.
    const input = { description: description.trim(), amount: value, category_id: category, spent_on: date,
      ...(place.trim() !== (editing.place_name ?? "") ? { place_name: place.trim() || null } : {}),
      ...(retailerId !== (editing.retailer_id ?? "") ? { retailer_id: retailerId || null } : {}),
      ...(source !== (editing.source ?? "") ? { source: source || null } : {}),
      ...(note.trim() !== (editing.note ?? "") ? { note: note.trim() || null } : {}),
    };
    const ok = await run(async (ctx) => {
      if (editing) await updateExpense(ctx, editing.id, input);
      return true;
    }, "Am salvat cheltuiala.");
    if (ok) setEditing(null);
  }

  return (
    <>
      <IconButton label={`Modifică cheltuiala ${expense.description}`} onClick={() => openForm(expense)}><Pencil size={18} /></IconButton>
      <IconButton label={`Șterge cheltuiala ${expense.description}`} onClick={() => setRemoving(expense)}><Trash2 size={18} /></IconButton>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={`Modifică cheltuiala ${editing?.description ?? ""}`}
        footer={<Button block disabled={busy} onClick={save}>Salvează</Button>}>
        <div className="flex flex-col gap-4">
          <LabeledInput label="Descriere" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} autoFocus error={error} />
          <LabeledInput label="Suma (lei)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <LabeledInput label="Data plății" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          <LabeledSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategoryId)}>
            {EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </LabeledSelect>
          <LabeledSelect label="Magazin salvat" value={retailerId} onChange={(event) => {
            const id = event.target.value;
            setRetailerId(id);
            const retailer = retailers.find(item => item.id === id);
            if (retailer) setPlace(retailer.name);
          }}>
            <option value="">Alt loc / fără magazin salvat</option>
            {retailerId && !retailers.some(item => item.id === retailerId) && <option value={retailerId}>{place || "Magazin înregistrat anterior"}</option>}
            {retailers.map(retailer => <option key={retailer.id} value={retailer.id}>{retailer.name}</option>)}
          </LabeledSelect>
          <LabeledInput label="Magazin / Loc" value={place} maxLength={120} onChange={(event) => { setPlace(event.target.value); setRetailerId(""); }} />
          <LabeledSelect label="Sursa" value={source} onChange={(event) => setSource(event.target.value as PurchaseSource | "")}>
            <option value="">Nespecificată</option>
            {Object.entries(SOURCE_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </LabeledSelect>
          <LabeledInput label="Notă (opțional)" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </div>
      </Sheet>
      <Sheet open={removing !== null} onClose={() => setRemoving(null)} title="Ștergi această cheltuială?" footer={
        <div className="flex gap-2">
          <Button className="flex-1 px-3" variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>Anulează</Button>
          <Button className="flex-1 px-3" variant="danger" disabled={busy} onClick={async () => {
            if (!removing) return;
            const ok = await run(async (ctx) => { await deleteExpense(ctx, removing.id); return true; }, "Am șters cheltuiala.");
            if (ok) setRemoving(null);
          }}>Șterge</Button>
        </div>
      }><p className="break-words text-ink-2">{removing?.description}</p></Sheet>
    </>
  );
}
