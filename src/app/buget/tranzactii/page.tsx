"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { Spinner, PageHeader } from "@/components/ui/misc";
import { TransactionFeed } from "@/components/budget/transaction-feed";
import { BudgetNavigation } from "@/components/budget/navigation";
import { ALL_SPEND, BudgetMonthPicker, budgetSplit, budgetViewHref, selectedBudgetMonth, selectMonthlyBudget } from "@/components/budget/budget-view";
import { scopeLabel } from "@/components/budget/budget-editor-sheet";
import { householdSpendRecords, owned, visible } from "@/lib/services/queries";
import { startOfMonth, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import { matchesScope, SOURCE_LABELS, spendForCategoryKey } from "@/lib/domain/budget";
import { EXPENSE_CATEGORIES } from "@/lib/domain/expense-categories";
import type { PurchaseSource } from "@/lib/domain/types";

// Lista completă de tranzacții ale lunii, separată de pagina de buget ca
// aceasta să rămână scurtă (decizia proprietarului, 23 nov. 2026).

function TransactionsScreen() {
  const today = toISODate(now());
  const router = useRouter();
  const params = useSearchParams();
  const month = selectedBudgetMonth(params.get("luna"), today);
  const data = useData(async (ctx) => {
    const [spend, transactions, expenses, retailers, categories, budgets] = await Promise.all([
      householdSpendRecords(ctx.db, ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      owned(ctx.db, "manual_expenses", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
    ]);
    return { spend, transactions, expenses, retailers, categories, budgets };
  });

  if (!data) return <Spinner />;
  const budget = selectMonthlyBudget(data.budgets, params.get("buget") ?? ALL_SPEND);
  const scope = budget?.id ?? ALL_SPEND;
  const group = params.get("grup");
  const split = budgetSplit(group);
  const key = params.get("categorie");
  const category = key && (group === "familie" || group === "categorii" || group === "magazine") ? { split: group, key } as const : undefined;
  const categories = new Map(data.categories.map(item => [item.id, item]));
  const names = {
    categories: new Map(data.categories.map(item => [item.id, item.name])),
    retailers: new Map(data.retailers.map(item => [item.id, item.name])),
  };
  const scoped = budget ? data.spend.filter(item => matchesScope(item, budget, categories)) : data.spend;
  const records = category ? spendForCategoryKey(scoped, category.key, category.split, categories) : scoped;
  const categoryLabel = category && (
    category.split === "familie" ? EXPENSE_CATEGORIES.find(item => item.id === category.key)?.name ?? "Nealocat"
      : category.split === "categorii" ? names.categories.get(category.key) ?? "Altele"
      : names.retailers.get(category.key) ?? SOURCE_LABELS[category.key.replace("sursa:", "") as PurchaseSource] ?? "Nespecificat"
  );

  return (
    <>
      <PageHeader back={{ href: budgetViewHref("/buget/", month, scope, { split }), label: "Înapoi la buget" }} title="Tranzacții"
        subtitle={budget ? scopeLabel(budget.scope, names) : "Toate cheltuielile gospodăriei"} />
      <BudgetNavigation active="tranzactii" summaryHref={budgetViewHref("/buget/", month, scope, { split })} transactionsHref={budgetViewHref("/buget/tranzactii/", month, scope, { split })} />

      <BudgetMonthPicker month={month} currentMonth={startOfMonth(today)} onChange={next => router.replace(budgetViewHref("/buget/tranzactii/", next, scope, category ?? { split }), { scroll: false })} />
      {categoryLabel && <div className="app-card mb-3 flex flex-wrap items-center justify-between gap-x-4 px-4 text-sm">
        <p className="py-2 font-semibold">{categoryLabel}</p>
        <Link className="inline-flex min-h-11 items-center font-medium text-brand" href={budgetViewHref("/buget/tranzactii/", month, scope, { split })}>Elimină filtrul</Link>
      </div>}
      <TransactionFeed month={month} records={records} transactions={data.transactions} expenses={data.expenses} retailers={data.retailers}
        scoped={Boolean(category || (budget && budget.scope.kind !== "familie" && budget.scope.kind !== "total"))} />
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}><TransactionsScreen /></Suspense>
    </AppShell>
  );
}
