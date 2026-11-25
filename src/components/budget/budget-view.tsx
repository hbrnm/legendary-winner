"use client";

import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";
import { addMonths, formatMonth, startOfMonth } from "@/lib/domain/dates";
import { capitalizeFirst } from "@/lib/domain/text";
import type { Budget } from "@/lib/domain/types";
import type { SpendSplit } from "@/lib/domain/budget";

export const ALL_SPEND = "toate";

export function selectedBudgetMonth(value: string | null, today: string) {
  const current = startOfMonth(today);
  if (!value || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) return current;
  const month = value + "-01";
  return month > current ? current : month;
}

export function selectMonthlyBudget(budgets: Budget[], id: string | null) {
  if (id === ALL_SPEND) return undefined;
  const monthly = budgets.filter(budget => budget.active && budget.period === "lunar")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return monthly.find(budget => budget.id === id)
    ?? monthly.find(budget => budget.scope.kind === "familie")
    ?? monthly.find(budget => budget.scope.kind === "total")
    ?? monthly.find(budget => budget.scope.kind === "alimente");
}

export function budgetViewHref(path: "/buget/" | "/buget/tranzactii/", month: string, budget?: string, grouping?: { split: SpendSplit; key?: string }) {
  const search = new URLSearchParams({ luna: month.slice(0, 7) });
  if (budget) search.set("buget", budget);
  if (grouping) {
    search.set("grup", grouping.split);
    if (grouping.key) search.set("categorie", grouping.key);
  }
  return path + "?" + search.toString();
}

export function budgetSplit(value: string | null): SpendSplit {
  return value === "categorii" || value === "magazine" ? value : "familie";
}

export function BudgetMonthPicker({ month, currentMonth, onChange }: { month: string; currentMonth: string; onChange: (month: string) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <IconButton label="Luna anterioară" onClick={() => onChange(addMonths(month, -1))} className="bg-surface-container-low shadow-card hover:bg-surface-container">
        <ChevronLeft size={20} aria-hidden />
      </IconButton>
      <h2 className="min-w-0 text-center text-section-title font-semibold tracking-tight text-on-surface" aria-live="polite">{capitalizeFirst(formatMonth(month))}</h2>
      <IconButton label="Luna următoare" disabled={month >= currentMonth} onClick={() => onChange(addMonths(month, 1))} className="bg-surface-container-low shadow-card hover:bg-surface-container">
        <ChevronRight size={20} aria-hidden />
      </IconButton>
    </div>
  );
}
