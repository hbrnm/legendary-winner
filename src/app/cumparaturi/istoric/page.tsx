"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Receipt, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { Card, EmptyState, Spinner, Badge } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { owned, visible } from "@/lib/services/queries";
import { deleteTransaction, setTransactionItemAmount } from "@/lib/services/shopping";
import { formatRon, parseMoney, sumMoney } from "@/lib/domain/money";
import { formatLongDate, formatMonth, localDateOf } from "@/lib/domain/dates";
import { formatQuantity } from "@/lib/domain/units";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import type { ShoppingTransaction, ShoppingTransactionItem } from "@/lib/domain/types";

interface Trip {
  tx: ShoppingTransaction;
  listName: string;
  items: ShoppingTransactionItem[];
  total: number;
  missing: number;
  places: string[];
}

function HistoryScreen() {
  const { run } = useAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const data = useData(async (ctx) => {
    const [txs, items, lists, retailers] = await Promise.all([
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      owned(ctx.db, "shopping_transaction_items", ctx.householdId),
      ctx.db.shopping_lists.where("household_id").equals(ctx.householdId).toArray(),
      visible(ctx.db, "retailers", ctx.householdId),
    ]);
    const listName = new Map(lists.map((l) => [l.id, l.name]));
    const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
    const trips: Trip[] = txs
      .map((tx) => {
        const its = items.filter((i) => i.transaction_id === tx.id).sort((a, b) => a.name.localeCompare(b.name, "ro"));
        const places = [...new Set(its.map((i) => (i.retailer_id ? (retailerName.get(i.retailer_id) ?? "") : i.source !== "supermarket" ? SOURCE_LABELS[i.source] : "")).filter(Boolean))];
        return { tx, listName: tx.list_id ? (listName.get(tx.list_id) ?? "Listă ștearsă") : "Cumpărături", items: its, total: sumMoney(its.map((i) => i.amount ?? 0)), missing: its.filter((i) => i.amount == null).length, places };
      })
      .sort((a, b) => (b.tx.completed_at ?? b.tx.started_at).localeCompare(a.tx.completed_at ?? a.tx.started_at));
    return trips;
  });

  if (!data) return <Spinner />;
  const open = data.find((t) => t.tx.id === openId) ?? null;
  const byMonth = new Map<string, Trip[]>();
  for (const t of data) {
    const m = localDateOf(t.tx.completed_at ?? t.tx.started_at).slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), t]);
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link href="/cumparaturi/" aria-label="Înapoi la liste" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Istoric</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={<Receipt size={32} />} title="Încă nu ai cumpărături finalizate">
          Când termini cumpărăturile dintr-o listă și apeși „Gata”, ele apar aici, cu sumele plătite.
        </EmptyState>
      ) : (
        [...byMonth.entries()].map(([month, trips]) => (
          <section key={month} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{formatMonth(`${month}-01`)}</h2>
              <span className="text-sm font-medium tabular">{formatRon(sumMoney(trips.map((t) => t.total)))}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {trips.map((t) => (
                <li key={t.tx.id}>
                  <button type="button" onClick={() => setOpenId(t.tx.id)} className="block w-full text-left">
                    <Card className="flex items-center gap-3 p-4 hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.listName}</p>
                        <p className="text-sm text-ink-2">
                          {formatLongDate(localDateOf(t.tx.completed_at ?? t.tx.started_at))} · {t.items.length} produse
                          {t.places.length > 0 && ` · ${t.places.join(", ")}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular">{formatRon(t.total)}</p>
                        {t.missing > 0 && <Badge tone="warn">{t.missing} fără preț</Badge>}
                      </div>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet
        open={Boolean(open)}
        onClose={() => {
          setOpenId(null);
          setDrafts({});
        }}
        title={open?.listName ?? ""}
        footer={
          <Button variant="danger" onClick={() => setConfirmDelete(true)} icon={<Trash2 size={18} />}>
            Șterge din istoric
          </Button>
        }
      >
        {open && (
          <div className="flex flex-col gap-1">
            <p className="mb-2 text-sm text-ink-2">
              {formatLongDate(localDateOf(open.tx.completed_at ?? open.tx.started_at))}. Completează prețurile lipsă: intră în buget și în istoricul de prețuri.
            </p>
            <ul className="divide-y divide-line">
              {open.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">{i.name}</p>
                    <p className="text-xs text-ink-2">{formatQuantity(i.quantity, i.unit)}</p>
                  </div>
                  <Input
                    inputMode="decimal"
                    aria-label={`Suma pentru ${i.name}`}
                    className="w-28 text-right tabular"
                    placeholder="lei"
                    value={drafts[i.id] ?? (i.amount == null ? "" : i.amount.toFixed(2).replace(".", ","))}
                    onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: e.target.value }))}
                    onBlur={async (e) => {
                      const raw = e.target.value.trim();
                      const amount = raw ? parseMoney(raw) : null;
                      if (raw && amount == null) return;
                      if (amount !== i.amount) await run((ctx) => setTransactionItemAmount(ctx, i.id, amount));
                    }}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold tabular">
              <span>Total</span>
              <span>{formatRon(open.total)}</span>
            </p>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Ștergi cumpărătura din istoric?"
        message="Suma ei dispare din buget și din rapoarte, pentru toți membrii gospodăriei."
        confirmLabel="Șterge"
        onConfirm={async () => {
          const id = openId!;
          setOpenId(null);
          await run((ctx) => deleteTransaction(ctx, id), "Cumpărătura a fost ștearsă din istoric.");
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <HistoryScreen />
    </AppShell>
  );
}
