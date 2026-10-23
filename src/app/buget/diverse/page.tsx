"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { LabeledSelect } from "@/components/ui/fields";
import { visible } from "@/lib/services/queries";
import { diverseToSort, moveOutOfDiverse } from "@/lib/services/receipts";
import { formatRon } from "@/lib/domain/money";
import { formatShortDate } from "@/lib/domain/dates";

// Produsele ajunse în „Diverse” (de pe bonuri, înainte de categoriile propuse),
// mutate în categoria potrivită, cu tot cu cumpărăturile de până acum (.tasks/016).

function DiverseScreen() {
  const { run, busy } = useAction();
  const data = useData(async (ctx) => {
    const [groups, categories] = await Promise.all([diverseToSort(ctx), visible(ctx.db, "product_categories", ctx.householdId)]);
    return {
      groups,
      categories: categories.sort((a, b) => a.sort_order - b.sort_order),
    };
  });

  if (!data) return <Spinner />;
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link href="/buget/" aria-label="Înapoi la buget" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Produse din Diverse</h1>
      </div>
      {data.groups.length === 0 ? (
        <EmptyState title="Nu mai ai nimic în Diverse." />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">Alege categoria potrivită. Se mută și cumpărăturile de până acum, ca bugetul să arate unde s-au dus banii.</p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {data.groups.map((g) => (
              <li key={g.key} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{g.label}</p>
                    <p className="text-xs text-ink-2">{formatShortDate(g.last_bought)}</p>
                  </div>
                  <span className="shrink-0 font-medium">{formatRon(g.total)}</span>
                </div>
                <LabeledSelect
                  label="Categoria"
                  value="diverse"
                  disabled={busy}
                  onChange={(e) => {
                    const to = e.target.value;
                    void run((ctx) => moveOutOfDiverse(ctx, g.key, to), `Am mutat „${g.label}” la ${catName.get(to) ?? to}.`);
                  }}
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </LabeledSelect>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <DiverseScreen />
    </AppShell>
  );
}
