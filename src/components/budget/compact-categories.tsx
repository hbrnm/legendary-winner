"use client";

import { formatRon } from "@/lib/domain/money";
import type { Bar } from "./charts";

/** Primele luni arată cheltuielile reale: toate categoriile active, fiecare deschizând detaliile ei. */
export function CompactCategories({ bars, onSelect }: { bars: Bar[]; onSelect?: (key: string) => void }) {
  const active = bars.filter(bar => bar.value !== 0).sort((a, b) => b.value - a.value);
  if (active.length === 0) return <p className="text-sm text-ink-2">Încă nu ai cheltuieli</p>;
  const max = Math.max(1, ...active.map(bar => bar.value));
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
      {active.map(category => {
        const inner = (
          <>
            <span className="block text-xs text-ink-2">{category.label}</span>
            <span className="mt-1 block text-sm font-medium tabular">{formatRon(category.value)}</span>
            <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(0, (category.value / max) * 100)}%` }} />
            </span>
          </>
        );
        return (
          <li key={category.key} className="min-w-0">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(category.key)}
                aria-label={`Vezi cheltuielile din ${category.label}`}
                className="-m-1 block min-h-11 w-[calc(100%+8px)] rounded-xl p-1 text-left transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
