"use client";

import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAction } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { createBudget, incomeSourcesSchema, updateBudget } from "@/lib/services/money";
import { incomeSummary } from "@/lib/domain/income";
import { formatRon, parseMoney } from "@/lib/domain/money";
import type { Budget } from "@/lib/domain/types";

export type DraftSource = { key: number; name: string; amount: string };

export interface IncomeSheetProps {
  open: boolean;
  onClose: () => void;
  budget: Budget | undefined;
  initialAdd?: boolean;
}

function initSources(budget: Budget | undefined, initialAdd: boolean): DraftSource[] {
  const existing = (budget?.income_sources ?? []).map((source, index) => ({
    key: index + 1,
    name: source.name,
    amount: source.amount.toFixed(2).replace(".", ","),
  }));
  return initialAdd || existing.length === 0
    ? [...existing, { key: existing.length + 1, name: "", amount: "" }]
    : existing;
}

function IncomeForm({
  onClose,
  budget,
  initialAdd,
}: {
  onClose: () => void;
  budget: Budget | undefined;
  initialAdd: boolean;
}) {
  const { run, busy } = useAction();
  const formId = useId();
  const submitting = useRef(false);

  const [sources, setSources] = useState<DraftSource[]>(() => initSources(budget, initialAdd));
  const serial = useRef(sources.length + 2);
  const [allocation, setAllocation] = useState(() => (budget ? budget.amount.toFixed(2).replace(".", ",") : ""));
  const [error, setError] = useState<string | null>(null);

  const draft = incomeSummary(
    sources.map((source) => ({ name: source.name, amount: parseMoney(source.amount) ?? 0 })),
    parseMoney(allocation) ?? 0,
  );

  function update(key: number, patch: Partial<DraftSource>) {
    setSources((previous) => previous.map((source) => (source.key === key ? { ...source, ...patch } : source)));
    setError(null);
  }

  async function save() {
    if (submitting.current) return;
    const parsed = incomeSourcesSchema.safeParse(sources.map((source) => ({ name: source.name, amount: parseMoney(source.amount) })));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifică numele și suma fiecărui venit.");
      return;
    }
    const amount = parseMoney(allocation);
    if (amount == null || amount <= 0 || amount > 9_999_999) {
      setError("Scrie bugetul pentru cheltuieli, între 0,01 și 9.999.999 lei.");
      return;
    }
    submitting.current = true;
    try {
      const ok = await run(async (ctx) => {
        const input = { income_sources: parsed.data, amount, scope: { kind: "familie" as const }, period: "lunar" as const };
        if (budget) await updateBudget(ctx, budget.id, input);
        else await createBudget(ctx, { ...input, name: "Bugetul lunii" });
        return true;
      }, "Am salvat veniturile și bugetul pentru cheltuieli.");
      if (ok) onClose();
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Sheet
      open={true}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Venituri și alocare"
      footer={
        <Button block type="submit" form={formId} disabled={busy} aria-busy={busy}>
          {busy ? "Se salvează…" : "Salvează veniturile"}
        </Button>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-ink-2">Sume lunare recurente. Totalul veniturilor și plafonul de cheltuieli se aleg separat.</p>
        {sources.map((source, index) => (
          <fieldset key={source.key} className="space-y-3 rounded-2xl border border-line p-3">
            <legend className="text-sm font-medium">Venit {index + 1}</legend>
            <div className="flex justify-end">
              <IconButton label={`Elimină venitul ${index + 1}`} onClick={() => setSources((previous) => previous.filter((item) => item.key !== source.key))}>
                <Trash2 size={17} />
              </IconButton>
            </div>
            <LabeledInput
              label={`Numele venitului ${index + 1}`}
              maxLength={60}
              placeholder="ex. Salariu soț"
              value={source.name}
              onChange={(event) => update(source.key, { name: event.target.value })}
            />
            <LabeledInput
              label={`Venitul ${index + 1} (RON)`}
              inputMode="decimal"
              placeholder="ex. 3000"
              value={source.amount}
              onChange={(event) => update(source.key, { amount: event.target.value })}
            />
          </fieldset>
        ))}
        <Button
          block
          variant="secondary"
          icon={<Plus size={17} />}
          disabled={sources.length >= 30}
          onClick={() => setSources((previous) => [...previous, { key: serial.current++, name: "", amount: "" }])}
        >
          Adaugă o sursă
        </Button>
        <p className="font-semibold tabular-nums">Total venituri: {formatRon(draft.total)}</p>
        <LabeledInput
          label="Buget pentru cheltuieli (RON)"
          inputMode="decimal"
          placeholder="ex. 4000"
          value={allocation}
          onChange={(event) => {
            setAllocation(event.target.value);
            setError(null);
          }}
        />
        <p className={`text-sm tabular-nums ${draft.unallocated < 0 ? "text-accent" : "text-info"}`}>
          {formatRon(Math.abs(draft.unallocated))} {draft.unallocated < 0 ? "peste venituri — poți salva dacă acoperi diferența din alte fonduri." : "nealocați din venituri"}
        </p>
        {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      </form>
    </Sheet>
  );
}

export function IncomeSheet({ open, onClose, budget, initialAdd = false }: IncomeSheetProps) {
  if (!open) return null;
  const key = `${budget?.id ?? "new"}:${initialAdd ? "add" : "view"}`;
  return <IncomeForm key={key} onClose={onClose} budget={budget} initialAdd={initialAdd} />;
}
