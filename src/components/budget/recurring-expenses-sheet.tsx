"use client";

import { useState } from "react";
import { useAction } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { createExpense } from "@/lib/services/expenses";
import { expenseCategoryName } from "@/lib/domain/expense-categories";
import { parseMoney } from "@/lib/domain/money";
import type { ISODate, ManualExpense } from "@/lib/domain/types";

interface DraftItem {
  sourceId: string;
  selected: boolean;
  description: string;
  category_id: ManualExpense["category_id"];
  amountText: string;
  source: ManualExpense["source"];
  retailer_id: ManualExpense["retailer_id"];
  place_name: ManualExpense["place_name"];
  note: ManualExpense["note"];
}

function RecurringExpensesForm({
  onClose,
  candidates,
  today,
}: {
  onClose: () => void;
  candidates: ManualExpense[];
  today: ISODate;
}) {
  const { run, busy } = useAction();
  const [items, setItems] = useState<DraftItem[]>(() =>
    candidates.map((expense) => ({
      sourceId: expense.id,
      selected: true,
      description: expense.description,
      category_id: expense.category_id,
      amountText: expense.amount.toFixed(2).replace(".", ","),
      source: expense.source,
      retailer_id: expense.retailer_id,
      place_name: expense.place_name,
      note: expense.note,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const selected = items.filter((item) => item.selected);

  async function saveSelected() {
    if (selected.length === 0) return onClose();
    const parsed: { item: DraftItem; amount: number }[] = [];
    for (const item of selected) {
      const amount = parseMoney(item.amountText);
      if (amount == null || amount <= 0) {
        setError(`Verifică suma pentru „${item.description}”.`);
        return;
      }
      parsed.push({ item, amount });
    }
    const ok = await run(async (ctx) => {
      for (const { item, amount } of parsed) {
        await createExpense(ctx, {
          description: item.description,
          category_id: item.category_id,
          amount,
          spent_on: today,
          source: item.source,
          retailer_id: item.retailer_id,
          place_name: item.place_name,
          note: item.note,
        });
      }
      return true;
    }, parsed.length === 1 ? "Am înregistrat plata în această lună." : `Am înregistrat ${parsed.length} plăți în această lună.`);
    if (ok) onClose();
  }

  return (
    <Sheet
      open={true}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Preia plăți din luna trecută"
      footer={
        <Button block onClick={saveSelected} disabled={busy || selected.length === 0}>
          {selected.length === 1 ? "Adaugă 1 plată" : `Adaugă ${selected.length} plăți`}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-2">
        Bifează cheltuielile fixe de luna trecută și ajustează sumele dacă s-au schimbat. Se înregistrează cu data de azi.
      </p>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <ul className="app-card divide-y divide-line overflow-hidden">
        {items.map((item, index) => (
          <li key={item.sourceId} className="flex items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={item.selected}
              aria-label={`Selectează ${item.description}`}
              onChange={() => {
                setError(null);
                setItems((prev) => prev.map((entry, i) => (i === index ? { ...entry, selected: !entry.selected } : entry)));
              }}
              className="h-5 w-5 shrink-0 cursor-pointer"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.description}</p>
              <p className="text-xs text-ink-2">{expenseCategoryName(item.category_id)}</p>
            </div>
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Sumă pentru ${item.description}`}
              value={item.amountText}
              disabled={!item.selected}
              onChange={(e) => {
                setError(null);
                const val = e.target.value;
                setItems((prev) => prev.map((entry, i) => (i === index ? { ...entry, amountText: val } : entry)));
              }}
              className="h-11 w-24 shrink-0 rounded-xl border-0 bg-surface-container-high px-2.5 text-right text-sm font-medium tabular-nums text-ink focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function RecurringExpensesSheet({
  open,
  onClose,
  candidates,
  today,
}: {
  open: boolean;
  onClose: () => void;
  candidates: ManualExpense[];
  today: ISODate;
}) {
  if (!open || candidates.length === 0) return null;
  return <RecurringExpensesForm key={candidates.map((c) => c.id).join(",")} onClose={onClose} candidates={candidates} today={today} />;
}
