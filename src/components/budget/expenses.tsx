"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAction, useData } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Card, SectionTitle, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { now } from "@/lib/clock";
import { formatShortDate, inPeriod, monthPeriod, toISODate } from "@/lib/domain/dates";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import { formatRon, parseMoney } from "@/lib/domain/money";
import type { ManualExpense } from "@/lib/domain/types";
import { createExpense, deleteExpense, updateExpense } from "@/lib/services/expenses";
import { owned } from "@/lib/services/queries";

export function ManualExpenses({ month }: { month: string }) {
  const expenses = useData(async (ctx) => {
    const rows = await owned(ctx.db, "manual_expenses", ctx.householdId);
    return rows.filter((row) => inPeriod(row.spent_on, monthPeriod(month)))
      .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
  }, [month]);
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [editing, setEditing] = useState<ManualExpense | "nou" | null>(null);
  const [removing, setRemoving] = useState<ManualExpense | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ExpenseCategoryId>("altele");
  const [error, setError] = useState<string | null>(null);

  function openForm(expense: ManualExpense | "nou") {
    setEditing(expense);
    setError(null);
    setDescription(expense === "nou" ? "" : expense.description);
    setAmount(expense === "nou" ? "" : expense.amount.toFixed(2).replace(".", ","));
    const lastDay = monthPeriod(month).to;
    setDate(expense === "nou" ? (lastDay < today ? lastDay : today) : expense.spent_on);
    setCategory(expense === "nou" ? "altele" : expense.category_id);
  }

  async function save() {
    const value = parseMoney(amount);
    if (!description.trim()) return setError("Scrie descrierea cheltuielii.");
    if (value == null || value <= 0) return setError("Scrie o sumă mai mare decât zero, cu cel mult două zecimale.");
    if (!date || date > today) return setError("Alege data plății, până astăzi.");
    const input = { description: description.trim(), amount: value, category_id: category, spent_on: date };
    const ok = await run(async (ctx) => {
      if (editing === "nou") await createExpense(ctx, input);
      else if (editing) await updateExpense(ctx, editing.id, input);
      return true;
    }, "Am salvat cheltuiala.");
    if (ok) setEditing(null);
  }

  return (
    <>
      <SectionTitle>Cheltuieli manuale</SectionTitle>
      <Button block variant="secondary" icon={<Plus size={18} />} onClick={() => openForm("nou")}>Adaugă cheltuială</Button>
      {!expenses ? <Spinner /> : expenses.length > 0 ? (
        <Card className="mt-3 divide-y divide-line">
          <ul>
            {expenses.map((expense) => (
              <li key={expense.id} className="border-b border-line p-3 last:border-b-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{expense.description}</p>
                    <p className="mt-1 break-words text-xs text-ink-2">{formatShortDate(expense.spent_on)} · {EXPENSE_CATEGORIES.find((item) => item.id === expense.category_id)?.name}</p>
                    <p className="mt-1 text-sm font-medium tabular">{formatRon(expense.amount)}</p>
                  </div>
                  <IconButton label={`Modifică cheltuiala ${expense.description}`} onClick={() => openForm(expense)}><Pencil size={18} /></IconButton>
                  <IconButton label={`Șterge cheltuiala ${expense.description}`} onClick={() => setRemoving(expense)}><Trash2 size={18} /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "nou" ? "Cheltuială nouă" : `Modifică cheltuiala ${editing?.description ?? ""}`}
        footer={<Button block disabled={busy} onClick={save}>{editing === "nou" ? "Adaugă cheltuială" : "Salvează"}</Button>}>
        <div className="flex flex-col gap-4">
          <LabeledInput label="Descriere" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} autoFocus error={error} />
          <LabeledInput label="Suma (lei)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <LabeledInput label="Data plății" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          <LabeledSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategoryId)}>
            {EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </LabeledSelect>
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
