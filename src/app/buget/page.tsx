"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronRight, Copy, Download, Pencil, Plus, PurseIcon, ReceiptIcon, Shapes, Tags } from "@/components/ui/icons";
import { IncomeSheet } from "@/components/budget/income-sheet";
import { BudgetEditorSheet, scopeLabel } from "@/components/budget/budget-editor-sheet";
import { ALL_SPEND, BudgetMonthPicker, budgetSplit, budgetViewHref, selectedBudgetMonth, selectMonthlyBudget } from "@/components/budget/budget-view";
import { CategoryDetailSheet } from "@/components/budget/category-detail-sheet";
import { BudgetNavigation } from "@/components/budget/navigation";
import { RecurringExpensesSheet } from "@/components/budget/recurring-expenses-sheet";
import { projectTransactions } from "@/components/budget/transactions";
import { dispatchCapture } from "@/components/capture/events";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { AddMark, Button, IconButton } from "@/components/ui/button";
import { BudgetBar, Card, DualBudgetBar, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { LabeledSelect, Segmented } from "@/components/ui/fields";
import { BarList, ColumnChart } from "@/components/budget/charts";
import { listItems, owned, priceIndex, householdSpendRecords, visible } from "@/lib/services/queries";
import { diverseToSort } from "@/lib/services/receipts";
import { budgetStatus, dailyBudgetAvailable, byCategory, byExpenseCategory, byRetailer, monthlyTotals, matchesScope, spendInPeriod, spendToCsv, sumAmounts, weeklyTotals, type BudgetStatus } from "@/lib/domain/budget";
import { incomeSummary } from "@/lib/domain/income";
import { listTotals } from "@/lib/domain/shopping";
import { addMonths, formatMonth, formatShortDate, inPeriod, localDateOf, monthPeriod, startOfMonth, toISODate } from "@/lib/domain/dates";
import { formatRon, roundMoney, sumMoney } from "@/lib/domain/money";
import { normalize } from "@/lib/domain/search";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import { now } from "@/lib/clock";
import { count } from "@/lib/domain/text";
import type { Budget, BudgetScope } from "@/lib/domain/types";

const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function BudgetScreen({ captureTarget, captureRef }: { captureTarget: HTMLDivElement | null; captureRef: Ref<HTMLDivElement> }) {
  const today = toISODate(now());
  const router = useRouter();
  const params = useSearchParams();
  const month = selectedBudgetMonth(params.get("luna"), today);
  const requestedBudget = params.get("buget");
  const [chartPeriod, setChartPeriod] = useState<"luni" | "saptamani">("luni");
  const split = budgetSplit(params.get("grup"));
  const [detail, setDetail] = useState<{ key: string; label: string } | null>(null);
  const [editing, setEditing] = useState<Budget | "nou" | null>(null);
  const [newBudgetDraft, setNewBudgetDraft] = useState<{ scope?: BudgetScope; name?: string } | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeInitialAdd, setIncomeInitialAdd] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const fromFabRef = useRef(false);

  useEffect(() => {
    const handleIncome = () => {
      fromFabRef.current = true;
      setIncomeInitialAdd(true);
      setIncomeOpen(true);
    };
    window.addEventListener("camara:income", handleIncome);
    return () => window.removeEventListener("camara:income", handleIncome);
  }, []);

  function handleCloseIncome() {
    setIncomeOpen(false);
    if (fromFabRef.current) {
      fromFabRef.current = false;
      requestAnimationFrame(() => captureTarget?.querySelector("button")?.focus());
    }
  }

  const data = useData(async (ctx) => {
    const [spend, budgets, categories, retailers, lists, prices, transactions, manualExpenses] = await Promise.all([
      householdSpendRecords(ctx.db, ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      owned(ctx.db, "manual_expenses", ctx.householdId),
    ]);
    const open = await Promise.all(lists.filter(list => !list.archived_at).map(async list => {
      const items = await listItems(ctx.db, list.id);
      // The paid lines are already in spend. Estimate only amounts that have not been entered yet.
      return listTotals(items.filter(item => !item.checked || item.actual_price == null), prices, today);
    }));
    return {
      spend,
      transactions,
      manualExpenses,
      budgets: budgets.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      categories: categories.sort((a, b) => a.sort_order - b.sort_order),
      retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      openEstimate: sumMoney(open.map((t) => t.remaining_estimate)),
      openUnknown: open.reduce((n, t) => n + t.unknown_price_count, 0),
      // Produsele din „Diverse” ale cumpărăturilor încheiate, de mutat (.tasks/016).
      diverse: (await diverseToSort(ctx, spend.filter((item) => !item.manual_expense_id))).length,
    };
  }, [today]);

  const view = useMemo(() => {
    if (!data) return null;
    const catMap = new Map(data.categories.map((c) => [c.id, c]));
    const retMap = new Map(data.retailers.map((r) => [r.id, r]));
    const period = monthPeriod(month);
    const prevPeriod = monthPeriod(addMonths(month, -1));
    const isCurrent = month === startOfMonth(today);
    const anchor = isCurrent ? today : period.to;
    const budget = selectMonthlyBudget(data.budgets, requestedBudget);
    const scopedSpend = budget ? data.spend.filter(item => matchesScope(item, budget, catMap)) : data.spend;
    const monthSpend = spendInPeriod(scopedSpend, period);
    const prevMonthSpend = spendInPeriod(scopedSpend, prevPeriod);
    const shoppingSpend = monthSpend.filter(item => !item.manual_expense_id);
    const prevShoppingSpend = prevMonthSpend.filter(item => !item.manual_expense_id);
    const chartSpend = scopedSpend.filter(item => localDateOf(item.purchased_at) <= anchor);
    const statuses = data.budgets.filter(b => b.active && (isCurrent || b.period === "lunar")).map(b => budgetStatus(b, data.spend, catMap, anchor));
    const budgetByCategory = new Map<string, (typeof statuses)[number]>();
    for (const status of statuses) {
      const scope = status.budget.scope;
      if (status.budget.period === "lunar" && scope.kind === "cheltuiala" && !budgetByCategory.has(scope.category_id)) {
        budgetByCategory.set(scope.category_id, status);
      }
    }
    const groups = split === "familie" ? byExpenseCategory(monthSpend, catMap)
      : split === "magazine" ? byRetailer(shoppingSpend, retMap) : byCategory(shoppingSpend, catMap);
    const prevGroups = split === "familie" ? byExpenseCategory(prevMonthSpend, catMap)
      : split === "magazine" ? byRetailer(prevShoppingSpend, retMap) : byCategory(prevShoppingSpend, catMap);
    const prevByKey = new Map(prevGroups.map(g => [g.key, g.amount]));
    const mainStatus = statuses.find(status => status.budget.id === budget?.id);
    const useOpenLists = isCurrent && (budget?.scope.kind === "familie" || budget?.scope.kind === "total") && (data.openEstimate > 0 || data.openUnknown > 0);
    const transactionRows = projectTransactions(monthSpend, data.transactions, Boolean(budget && budget.scope.kind !== "familie" && budget.scope.kind !== "total"))
      .filter(row => inPeriod(localDateOf(row.date), period));
    const total = sumAmounts(monthSpend);
    const prevTotal = sumAmounts(prevMonthSpend);
    const monthDeltaPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

    // Plățile manuale din luna anterioară care încă nu au fost înregistrate în luna curentă.
    const currentManualKeys = new Set(
      data.manualExpenses
        .filter(e => !e.deleted_at && inPeriod(e.spent_on, period))
        .map(e => `${e.category_id}:${normalize(e.description)}`),
    );
    const seenPrev = new Set<string>();
    const recurringCandidates = isCurrent
      ? data.manualExpenses
          .filter(e => !e.deleted_at && inPeriod(e.spent_on, prevPeriod))
          .sort((a, b) => b.spent_on.localeCompare(a.spent_on))
          .filter(e => {
            const k = `${e.category_id}:${normalize(e.description)}`;
            if (currentManualKeys.has(k) || seenPrev.has(k)) return false;
            seenPrev.add(k);
            return true;
          })
      : [];

    return {
      catMap, retMap, monthSpend, scopedSpend, statuses, mainStatus, useOpenLists,
      total, monthDeltaPct, recurringCandidates,
      splitTotal: sumAmounts(split === "familie" ? monthSpend : shoppingSpend),
      split: groups.filter(group => group.amount !== 0).map(group => {
        const related = split === "familie" && (!budget || budget.scope.kind === "familie" || budget.scope.kind === "cheltuiala") ? budgetByCategory.get(group.key) : undefined;
        const prevAmt = prevByKey.get(group.key) ?? 0;
        const catDelta = prevAmt > 0 ? Math.round(((group.amount - prevAmt) / prevAmt) * 100) : null;
        const deltaText = catDelta != null && catDelta !== 0 ? `${catDelta > 0 ? "+" : ""}${catDelta}% față de luna trecută` : undefined;
        const budgetText = related ? formatRon(Math.abs(related.remaining)) + (related.over ? " peste bugetul categoriei" : " rămași din bugetul categoriei") : undefined;
        return {
          key: group.key, label: group.label, value: group.amount,
          detail: [budgetText, deltaText].filter(Boolean).join(" · ") || undefined,
        };
      }),
      months: monthlyTotals(chartSpend, anchor, 6).map(m => ({
        key: m.period.from, label: MONTHS_SHORT[Number(m.period.from.slice(5, 7)) - 1],
        value: m.amount, current: m.period.from === month,
        noData: !spendInPeriod(chartSpend, m.period).some((item) => item.amount != null),
      })),
      weeks: weeklyTotals(chartSpend, anchor, 8).map(w => ({
        key: w.period.from, label: formatShortDate(w.period.from).replace(/\.$/, ""),
        value: w.amount, current: w.period.to >= anchor,
        noData: !spendInPeriod(chartSpend, w.period).some((item) => item.amount != null),
      })),
      noAmount: monthSpend.filter(item => item.amount == null).length,
      txCount: transactionRows.length,
      pendingCount: transactionRows.filter(row => row.pending).length,
    };
  }, [data, month, requestedBudget, split, today]);

  if (!data || !view) return <Spinner />;
  const names = { categories: new Map(data.categories.map(c => [c.id, c.name])), retailers: new Map(data.retailers.map(r => [r.id, r.name])) };
  const { mainStatus } = view;
  const { openEstimate, openUnknown } = data;
  const incomeBudget = selectMonthlyBudget(data.budgets, null);
  const basketStatus = view.useOpenLists ? mainStatus : undefined;
  const otherStatuses = view.statuses.filter(status => status !== mainStatus);
  const isCurrentMonth = month === startOfMonth(today);
  const scope = mainStatus?.budget.id ?? ALL_SPEND;

  function exportCsv(all: boolean) {
    const items = all ? data!.spend : view!.monthSpend;
    const csv = spendToCsv(items, view!.catMap, view!.retMap);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = all ? "camara-cheltuieli.csv" : `camara-cheltuieli-${month.slice(0, 7)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function openCategory(key: string) {
    const bar = view!.split.find((b) => b.key === key);
    if (bar) setDetail({ key: bar.key, label: bar.label });
  }

  function openCategoryBudget() {
    if (!detail) return;
    let scope: BudgetScope | undefined;
    if (split === "familie" && EXPENSE_CATEGORIES.some((c) => c.id === detail.key)) {
      scope = { kind: "cheltuiala", category_id: detail.key as ExpenseCategoryId };
    } else if (split === "categorii" && detail.key !== "_") {
      scope = { kind: "categorie", category_id: detail.key };
    } else if (split === "magazine" && !detail.key.startsWith("sursa:") && detail.key !== "_") {
      scope = { kind: "magazin", retailer_id: detail.key };
    }
    if (!scope) return;
    setNewBudgetDraft({ scope, name: `Buget ${detail.label}` });
    setDetail(null);
    setEditing("nou");
  }

  function renderBudgetCard(s: BudgetStatus) {
    const primary = s === mainStatus;
    const hasLists = s === basketStatus;
    const afterLists = hasLists && openEstimate > 0;
    const balance = afterLists ? roundMoney(s.remaining - openEstimate) : s.remaining;
    const balanceLabel = afterLists
      ? (openUnknown > 0 ? "Sold după costurile cunoscute" : "Sold după cumpărăturile planificate")
      : balance < 0 ? "Depășire" : hasLists ? "Rămas înainte de cumpărături" : "Rămas";
    return (
      <div className={primary ? "rounded-[24px] bg-meal-hero p-4 text-ink shadow-card sm:p-5" : "app-card p-4 sm:p-5"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-sans text-lg font-semibold leading-snug">{s.budget.name}</p>
            <p className="text-xs text-ink-2">
              {scopeLabel(s.budget.scope, names)} · {s.budget.period === "lunar" ? formatMonth(s.period.from) : `${formatShortDate(s.period.from)} – ${formatShortDate(s.period.to)}`}
            </p>
          </div>
          {isCurrentMonth && <IconButton label={`Modifică bugetul ${s.budget.name}`} onClick={() => setEditing(s.budget)} className="-mr-2 -mt-2">
            <Pencil size={18} />
          </IconButton>}
        </div>
        <dl className={`mt-4 grid gap-x-3 gap-y-3 tabular ${hasLists ? "grid-cols-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1 sm:grid-cols-2"}`}>
          <div className={hasLists ? "col-span-2 min-w-0 sm:col-span-1" : "min-w-0"}>
            <dt className="text-sm font-medium text-ink-2">{balanceLabel}</dt>
            <dd className={`mt-1 wrap-anywhere font-bold leading-tight tracking-tight ${primary ? "text-3xl" : "text-2xl"} ${balance < 0 ? "text-accent" : "text-ink"}`}>
              {formatRon(Math.abs(balance))} <span className={balance < 0 ? "text-sm font-medium" : "sr-only"}>{balance < 0 ? "peste buget" : "rămași"}</span>
            </dd>
            <dd className="text-xs text-ink-2">din {formatRon(s.budget.amount)}</dd>
          </div>
          <div className={`min-w-0 ${hasLists ? "border-l pl-3" : "border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3"} ${primary ? "border-meal-hero-border" : "border-line"}`}>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
              {s === basketStatus && openEstimate > 0 && <span aria-hidden className={`h-2 w-2 rounded-full ${s.over ? "bg-accent" : "bg-secondary"}`} />}
              {s.budget.period === "lunar" ? "Cheltuit în lună" : "Cheltuit în săptămână"}
            </dt>
            <dd className="mt-1 wrap-anywhere text-lg font-semibold leading-tight">{formatRon(s.spent)}</dd>
            {primary && view!.monthDeltaPct != null && view!.monthDeltaPct !== 0 && (
              <dd className={`mt-0.5 text-xs font-medium ${view!.monthDeltaPct > 0 ? "text-accent" : "text-info"}`}>
                {view!.monthDeltaPct > 0 ? `+${view!.monthDeltaPct}%` : `${view!.monthDeltaPct}%`} față de luna trecută
              </dd>
            )}
          </div>
          {s === basketStatus && (
            <div className={`min-w-0 border-l pl-3 ${primary ? "border-meal-hero-border" : "border-line"}`}>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                {openEstimate > 0 && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-tertiary" />}
                Liste deschise
              </dt>
              <dd className="mt-1 wrap-anywhere text-lg font-semibold leading-tight">
                {openEstimate === 0 && openUnknown > 0 ? "Necunoscut" : formatRon(openEstimate)}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-4">
          {s === basketStatus && openEstimate > 0 ? (
            <DualBudgetBar spent={s.spent} pending={openEstimate} total={s.budget.amount} label={`${s.budget.name}: cheltuit și coșul de acum`} />
          ) : (
            <BudgetBar pct={s.used_pct} label={`${s.budget.name}: ${s.used_pct}% folosit`} />
          )}
        </div>
        {!isCurrentMonth && <p className="mt-3 text-xs text-ink-2">Calculat cu plafonul configurat acum.</p>}
        {s === basketStatus && <p className="mt-3 text-sm text-ink-2">
          {openUnknown > 0 && <>Estimare parțială · {count(openUnknown, "produs", "produse")} fără preț cunoscut. </>}
          <Link href="/cumparaturi/" className="inline-flex min-h-11 items-center font-medium text-brand hover:underline">Deschide cumpărăturile <ChevronRight size={16} aria-hidden /></Link>
        </p>}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {primary && isCurrentMonth && balance >= 0 && !(s === basketStatus && openUnknown > 0) && (
            <p className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-2 tabular">Disponibil pe zi până la finalul lunii · ≈ {formatRon(dailyBudgetAvailable(balance, today))}</p>
          )}
          {primary && isCurrentMonth && s.projected != null && (
            <p className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tabular ${s.projected > s.budget.amount ? "bg-accent-soft text-accent" : "bg-surface text-info"}`}>
              Estimat ~{formatRon(s.projected)} la final de lună
            </p>
          )}
        </div>
        {s.items_without_amount > 0 && <p className="mt-2 text-xs text-warn">{s.items_without_amount === 1 ? "Un produs cumpărat nu are preț" : `${count(s.items_without_amount, "produs", "produse")} cumpărate nu au preț`}. Totalurile declarate ale bonurilor sunt incluse.</p>}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Buget"
        captureRef={captureRef}
      />
      <BudgetNavigation active="rezumat" transactionsHref={budgetViewHref("/buget/tranzactii/", month, scope, { split })} />

      <BudgetMonthPicker month={month} currentMonth={startOfMonth(today)} onChange={next => router.replace(budgetViewHref("/buget/", next, requestedBudget ?? undefined, { split }), { scroll: false })} />
      {data.budgets.some(budget => budget.active && budget.period === "lunar") && <div className="mb-4">
        <LabeledSelect label="Buget și domeniu" value={scope} onChange={event => router.replace(budgetViewHref("/buget/", month, event.target.value, { split }), { scroll: false })}>
          <option value={ALL_SPEND}>Toate cheltuielile gospodăriei</option>
          {data.budgets.filter(budget => budget.active && budget.period === "lunar").map(budget =>
            <option key={budget.id} value={budget.id}>{budget.name} · {scopeLabel(budget.scope, names)}</option>
          )}
        </LabeledSelect>
      </div>}

      <IncomeSheet
        open={incomeOpen}
        onClose={handleCloseIncome}
        budget={incomeBudget?.scope.kind === "familie" || incomeBudget?.scope.kind === "total" ? incomeBudget : undefined}
        initialAdd={incomeInitialAdd}
      />

      {isCurrentMonth && data.budgets.length === 0 ? (
        <EmptyState icon={<PurseIcon size={32} />} title="Setează un buget" action={<Button onClick={() => { setNewBudgetDraft(null); setEditing("nou"); }}>Setează bugetul lunar</Button>}>
          Spune cât vrei să cheltui pe lună (sau pe săptămână, la piață, la un anumit magazin) și urmărești cum te încadrezi, chiar din magazin.
        </EmptyState>
      ) : null}

      {mainStatus && renderBudgetCard(mainStatus)}

      {!mainStatus && <div className="mt-3 rounded-[24px] bg-meal-hero p-5 text-ink shadow-card">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-2">Cheltuit în lună</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular">{formatRon(view.total)}</p>
          </div>
          {view.monthDeltaPct != null && view.monthDeltaPct !== 0 && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${view.monthDeltaPct > 0 ? "bg-accent-soft text-accent" : "bg-surface text-info"}`}>
              {view.monthDeltaPct > 0 ? `+${view.monthDeltaPct}%` : `${view.monthDeltaPct}%`} față de luna trecută
            </span>
          )}
        </div>
      </div>}

      {data.diverse > 0 && (
        <Link href="/buget/diverse/" className="mt-3 flex items-center gap-3 rounded-[20px] bg-brand-soft px-4 py-3 text-sm shadow-card transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand" aria-hidden>
            <Shapes size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">Mută din Diverse ({data.diverse})</span>
            <span className="block text-xs text-ink-2">Produse de pe bonuri fără categorie clară</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-brand" aria-hidden />
        </Link>
      )}

      {isCurrentMonth && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => dispatchCapture({ mode: "manual" })}>
            Cheltuială
          </Button>
          <Button size="sm" variant="secondary" icon={<Camera size={16} />} onClick={() => dispatchCapture({ mode: "scan" })}>
            Scanează bon
          </Button>
          {view.recurringCandidates.length > 0 && (
            <Button size="sm" variant="outlined" icon={<Copy size={15} />} onClick={() => setRecurringOpen(true)}>
              Preia plăți fixe ({view.recurringCandidates.length})
            </Button>
          )}
        </div>
      )}

      {isCurrentMonth && incomeBudget?.income_sources && incomeBudget.income_sources.length > 0 && (() => {
        const incSum = incomeSummary(incomeBudget.income_sources, incomeBudget.amount);
        return (
          <Card aria-label="Venituri lunare" as="section" className="mt-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-xs font-medium text-ink-2">Venituri și alocare</span>
                <span className="text-base font-bold text-ink tabular-nums">
                  {formatRon(incSum.total)} <span className="text-xs font-normal text-ink-2">venituri</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold tabular ${incSum.unallocated < 0 ? "text-accent" : "text-info"}`}>
                  {formatRon(Math.abs(incSum.unallocated))} {incSum.unallocated < 0 ? "peste venituri" : "nealocați"}
                </span>
                <IconButton
                  label="Modifică veniturile și alocarea"
                  onClick={() => {
                    setIncomeInitialAdd(false);
                    setIncomeOpen(true);
                  }}
                >
                  <Pencil size={15} />
                </IconButton>
              </div>
            </div>
            <ul className="mt-2 space-y-1 border-t border-line/70 pt-2">
              {incomeBudget.income_sources.map((source, index) => (
                <li key={index} className="flex justify-between gap-3 text-xs text-ink-2">
                  <span className="min-w-0 truncate">{source.name}</span>
                  <span className="shrink-0 tabular">{formatRon(source.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })()}

      <Link href={budgetViewHref("/buget/tranzactii/", month, scope, { split })} className="app-card mt-3 flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-surface-2/40 active:bg-surface-2">
        <span className="flex items-center gap-2 font-medium"><ReceiptIcon size={18} strokeWidth={1.75} /> Tranzacții</span>
        <span className="flex items-center gap-1 text-sm text-ink-2 tabular">{count(view.txCount, "tranzacție", "tranzacții")} <ChevronRight size={18} strokeWidth={1.75} className="text-ink-3" /></span>
      </Link>
      {view.pendingCount > 0 && <p className="mt-2 text-xs text-ink-2">Totalul include sumele înregistrate pentru produse bifate din liste deschise.</p>}

      <SectionTitle>Categorii de cheltuieli</SectionTitle>
      <div className="mb-3">
        <Segmented
          label="Împarte după"
          value={split}
          onChange={next => router.replace(budgetViewHref("/buget/", month, requestedBudget ?? undefined, { split: next }), { scroll: false })}
          options={[
            { value: "familie", label: "Familie" },
            { value: "categorii", label: "Produse" },
            { value: "magazine", label: "Magazine" },
          ]}
        />
        {split !== "familie" && <p className="mt-1.5 text-xs text-ink-2">Aceste grupe includ doar cumpărături.</p>}
      </div>
      <Card className="p-4">
        {view.split.length === 0 ? <p className="text-sm text-ink-2">Nicio cheltuială în această grupare pentru {formatMonth(month)}.</p>
          : <BarList bars={view.split} total={view.splitTotal} onSelect={openCategory}
            hrefFor={key => budgetViewHref("/buget/tranzactii/", month, scope, { key, split })} />}
        {view.noAmount > 0 && <p className="mt-3 text-xs text-ink-2">{count(view.noAmount, "produs fără preț individual", "produse fără preț individual")}. Totalurile declarate ale bonurilor sunt incluse.</p>}
      </Card>

      <SectionTitle>Evoluția cheltuielilor</SectionTitle>
      <Card className="p-4">
        <Segmented label="Perioada graficului" value={chartPeriod} onChange={setChartPeriod} options={[
          { value: "luni", label: "Luni" }, { value: "saptamani", label: "Săptămâni" },
        ]} />
        <ColumnChart
          key={chartPeriod}
          bars={chartPeriod === "luni" ? view.months : view.weeks}
          title={chartPeriod === "luni" ? "Cheltuieli pe lună" : "Cheltuieli pe săptămână"}
          reference={chartPeriod === "luni" && mainStatus?.budget.period === "lunar" ? { value: mainStatus.budget.amount, label: `Plafon ${formatRon(mainStatus.budget.amount)}` } : undefined}
        />
        <p className="text-xs text-ink-2">{chartPeriod === "luni" ? "6 luni, inclusiv luna selectată" : "8 săptămâni, până la ultima săptămână cuprinsă în perioada selectată"}.</p>
      </Card>

      {otherStatuses.length > 0 && <SectionTitle>Alte bugete</SectionTitle>}
      {otherStatuses.map(status => (
        <details key={status.budget.id} className="app-card mb-2">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">{status.budget.name} · {formatRon(status.spent)} cheltuiți</summary>
          <div className="px-3 pb-3">{renderBudgetCard(status)}</div>
        </details>
      ))}
      {isCurrentMonth && data.budgets.length > 0 && <Button className="mt-2" variant="ghost" icon={<AddMark size={16} />} onClick={() => { setNewBudgetDraft(null); setEditing("nou"); }}>Adaugă un buget</Button>}

      {/* Fără flex-1 în coloană: butoanele își păstrează înălțimea de 44 px. */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/buget/preturi/" className="col-span-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-secondary-container text-[15px] font-medium text-on-secondary-container transition duration-150 ease-out hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <Tags size={18} /> Prețuri și comparații
        </Link>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(false)} disabled={view.monthSpend.length === 0}>
          Exportă luna
        </Button>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(true)} disabled={data.spend.length === 0}>
          Exportă tot
        </Button>
      </div>

      <CategoryDetailSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        categoryKey={detail?.key ?? ""}
        label={detail?.label ?? ""}
        split={split}
        month={month}
        spend={view.scopedSpend}
        categories={view.catMap}
        retailers={view.retMap}
        onSetBudget={detail && ((split === "familie" && EXPENSE_CATEGORIES.some((c) => c.id === detail.key)) || (split === "categorii" && detail.key !== "_") || (split === "magazine" && !detail.key.startsWith("sursa:") && detail.key !== "_")) ? openCategoryBudget : undefined}
      />

      <BudgetEditorSheet
        editing={editing}
        onClose={() => { setEditing(null); setNewBudgetDraft(null); }}
        categories={data.categories}
        retailers={data.retailers}
        isFirstBudget={data.budgets.length === 0}
        initialScope={newBudgetDraft?.scope}
        initialName={newBudgetDraft?.name}
        onOpenIncome={() => {
          setIncomeInitialAdd(false);
          setIncomeOpen(true);
        }}
      />

      <RecurringExpensesSheet
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        candidates={view.recurringCandidates}
        today={today}
      />
    </>
  );
}

export default function Page() {
  const [captureTarget, setCaptureTarget] = useState<HTMLDivElement | null>(null);

  return (
    <AppShell captureTarget={captureTarget} mainClassName="budget-overview">
      <Suspense fallback={<Spinner />}><BudgetScreen captureTarget={captureTarget} captureRef={setCaptureTarget} /></Suspense>
    </AppShell>
  );
}
