"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRon, sumMoney } from "@/lib/domain/money";
import type { Bar } from "./charts";

/** First months show actual spending, with receipt differences kept unclassified. */
export function CompactCategories({ bars }: { bars: Bar[] }) {
  const [expanded, setExpanded] = useState(false);
  const active = bars.filter(bar => bar.value !== 0).sort((a, b) => b.value - a.value);
  if (active.length === 0) return <p className="text-sm text-ink-2">Încă nu ai cheltuieli</p>;
  const unallocated = active.find(bar => bar.key === "nealocat");
  const initial = [...active.filter(bar => bar.key !== "nealocat").slice(0, unallocated ? 4 : 5), ...(unallocated ? [unallocated] : [])];
  const visible = expanded ? active : initial;
  const max = Math.max(1, ...active.map(bar => bar.value));
  const hidden = active.filter(bar => !initial.some(item => item.key === bar.key));
  return <>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{visible.map(category => <div key={category.key} className="min-w-0"><dt className="text-xs text-ink-2">{category.label}</dt><dd className="mt-1 text-sm font-medium tabular">{formatRon(category.value)}</dd><div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{width:`${Math.max(0, category.value / max * 100)}%`}} /></div></div>)}</dl>
    {hidden.length > 0 && <div className="mt-2">
      {!expanded && <p className="text-xs text-ink-2">Încă {hidden.length} categorii · {formatRon(sumMoney(hidden.map(bar => bar.value)))}</p>}
      <Button variant="ghost" className="px-0 text-sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Vezi mai puține categorii" : "Vezi toate categoriile"}</Button>
    </div>}
  </>;
}
