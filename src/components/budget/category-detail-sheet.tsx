"use client";

import { useMemo } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ColumnChart } from "./charts";
import { monthlyTotals, SOURCE_LABELS, spendForCategoryKey, spendInPeriod, sumAmounts, type SpendSplit } from "@/lib/domain/budget";
import { addMonths, formatMonth, formatShortDate, localDateOf, monthPeriod } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import { capitalizeFirst, count } from "@/lib/domain/text";
import { formatQuantity } from "@/lib/domain/units";
import type { ProductCategory, Retailer, SpendRecord, UnitCode } from "@/lib/domain/types";

const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

/** Detaliile unei categorii din graficul „Categorii de cheltuieli”: totalul lunii, evoluția și liniile cumpărate. */
export function CategoryDetailSheet({
  open,
  onClose,
  categoryKey,
  label,
  split,
  month,
  spend,
  categories,
  retailers,
  onSetBudget,
}: {
  open: boolean;
  onClose: () => void;
  categoryKey: string;
  label: string;
  split: SpendSplit;
  /** Prima zi a lunii alese (ISO). */
  month: string;
  spend: SpendRecord[];
  categories: Map<string, ProductCategory>;
  retailers: Map<string, Retailer>;
  onSetBudget?: () => void;
}) {
  const view = useMemo(() => {
    const all = spendForCategoryKey(spend, categoryKey, split, categories);
    const period = monthPeriod(month);
    const prevPeriod = monthPeriod(addMonths(month, -1));
    const items = spendInPeriod(all, period).sort((a, b) => b.purchased_at.localeCompare(a.purchased_at) || a.id.localeCompare(b.id));
    const total = sumAmounts(items);
    const prevTotal = sumAmounts(spendInPeriod(all, prevPeriod));
    const deltaPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    return {
      items,
      total,
      deltaPct,
      months: monthlyTotals(all, period.from, 6).map((m) => ({
        key: m.period.from,
        label: MONTHS_SHORT[Number(m.period.from.slice(5, 7)) - 1],
        value: m.amount,
        current: m.period.from === month,
      })),
    };
  }, [spend, categoryKey, split, month, categories]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={label}
      footer={onSetBudget ? (
        <Button block variant="secondary" onClick={onSetBudget}>
          Setează limită pentru această categorie
        </Button>
      ) : undefined}
    >
      <p className="text-xs text-ink-2">
        {capitalizeFirst(formatMonth(month))} · {count(view.items.length, "linie", "linii")}
        {view.deltaPct != null && (
          <span className={`ml-2 font-semibold ${view.deltaPct > 0 ? "text-accent" : "text-info"}`}>
            {view.deltaPct > 0 ? `+${view.deltaPct}%` : `${view.deltaPct}%`} față de luna trecută
          </span>
        )}
      </p>
      <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular text-ink">{formatRon(view.total)}</p>

      <div className="mt-4">
        <ColumnChart bars={view.months} title={`Cheltuieli pe lună: ${label}`} />
      </div>

      {view.items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">Nicio cheltuială în {formatMonth(month)}.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {view.items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-medium text-ink">{i.name}</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  {formatShortDate(localDateOf(i.purchased_at))}
                  {i.quantity != null && i.unit ? ` · ${formatQuantity(i.quantity, i.unit as UnitCode)}` : ""}
                  {" · "}
                  {i.manual_expense_id ? "Cheltuială manuală" : i.retailer_id ? retailers.get(i.retailer_id)?.name ?? SOURCE_LABELS[i.source] : SOURCE_LABELS[i.source]}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular text-ink">{i.amount == null ? "Sumă necunoscută" : formatRon(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}