"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Shapes, Tags, Wallet } from "lucide-react";
import { IncomeSheet } from "@/components/budget/income-sheet";
import { BudgetEditorSheet, scopeLabel } from "@/components/budget/budget-editor-sheet";
import { CompactCategories } from "@/components/budget/compact-categories";
import { TransactionFeed } from "@/components/budget/transaction-feed";
import { hasSpendHistory } from "@/components/budget/transactions";
import { EXPENSE_CATEGORIES } from "@/lib/domain/expense-categories";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { BudgetBar, Card, DualBudgetBar, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { LabeledSelect } from "@/components/ui/fields";
import { BarList, ColumnChart } from "@/components/budget/charts";
import { listItems, owned, priceIndex, householdSpendRecords, visible } from "@/lib/services/queries";
import { diverseToSort } from "@/lib/services/receipts";
import { averageTrip, budgetStatus, dailyBudgetAvailable, byCategory, byExpenseCategory, byRetailer, monthlyTotals, SOURCE_LABELS, spendInPeriod, spendToCsv, sumAmounts, weeklyTotals } from "@/lib/domain/budget";
import { incomeSummary } from "@/lib/domain/income";
import { listTotals } from "@/lib/domain/shopping";
import { addDays, formatMonth, formatShortDate, monthPeriod, startOfMonth, toISODate } from "@/lib/domain/dates";
import { formatRon, sumMoney } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import { capitalizeFirst, count } from "@/lib/domain/text";
import type { Budget, PurchaseSource } from "@/lib/domain/types";

const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function BudgetScreen() {
  const today = toISODate(now());
  const [month, setMonth] = useState(startOfMonth(today));
  const [split, setSplit] = useState<"familie" | "categorii" | "magazine">("familie");
  const [editing, setEditing] = useState<Budget | "nou" | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeInitialAdd, setIncomeInitialAdd] = useState(false);
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
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.capture-fab')?.focus());
    }
  }

  const data = useData(async (ctx) => {
    const [spend, budgets, categories, retailers, lists, prices, transactions, expenses] = await Promise.all([
      householdSpendRecords(ctx.db, ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      owned(ctx.db, "manual_expenses", ctx.householdId),
    ]);
    const open = await Promise.all(lists.filter((l) => !l.archived_at).map(async (l) => listTotals(await listItems(ctx.db, l.id), prices)));
    return {
      spend,
      transactions,
      expenses,
      hasHistory: hasSpendHistory(spend),
      budgets: budgets.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      categories: categories.sort((a, b) => a.sort_order - b.sort_order),
      retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      openEstimate: sumMoney(open.map((t) => t.remaining_estimate)),
      openUnknown: open.reduce((n, t) => n + t.remaining_unknown_count, 0),
      // Produsele din „Diverse” ale cumpărăturilor încheiate, de mutat (.tasks/016).
      diverse: (await diverseToSort(ctx, spend.filter((item) => !item.manual_expense_id))).length,
    };
  });

  const view = useMemo(() => {
    if (!data) return null;
    const catMap = new Map(data.categories.map((c) => [c.id, c]));
    const retMap = new Map(data.retailers.map((r) => [r.id, r]));
    const period = monthPeriod(month);
    const monthSpend = spendInPeriod(data.spend, period);
    const total = sumAmounts(monthSpend);
    const shoppingSpend = monthSpend.filter((item) => !item.manual_expense_id);
    const familySplit = !data.hasHistory || split === "familie";
    const familyCategories = new Map(byExpenseCategory(monthSpend, catMap).map(item => [item.key, item.amount]));
    const statuses = data.budgets.filter((b) => b.active).map((b) => budgetStatus(b, data.spend, catMap, today));
    return {
      catMap,
      retMap,
      total,
      splitTotal: familySplit ? total : sumAmounts(shoppingSpend),
      monthSpend,
      statuses,
      months: monthlyTotals(data.spend, period.to > today ? today : period.to, 6).map((m) => ({
        key: m.period.from,
        label: MONTHS_SHORT[Number(m.period.from.slice(5, 7)) - 1],
        value: m.amount,
        current: m.period.from === month,
      })),
      weeks: weeklyTotals(data.spend, today, 8).map((w) => ({ key: w.period.from, label: formatShortDate(w.period.from).replace(/\.$/, ""), value: w.amount, current: w.period.to >= today })),
      split: familySplit
        ? [
            ...EXPENSE_CATEGORIES.map(category => ({ key: category.id, label: category.name, value: familyCategories.get(category.id) ?? 0 })),
            ...(familyCategories.has("nealocat") ? [{ key: "nealocat", label: "Nealocat", value: familyCategories.get("nealocat") ?? 0 }] : []),
          ]
        : (split === "magazine" ? byRetailer(shoppingSpend, retMap) : byCategory(shoppingSpend, catMap)).map(item => ({ key: item.key, label: item.label, value: item.amount })),
      sources: (["supermarket", "piata", "producator", "alta"] as PurchaseSource[])
        .map((s) => ({ source: s, amount: sumAmounts(shoppingSpend.filter((i) => i.source === s)) }))
        .filter((x) => x.amount > 0),
      avgTrip: averageTrip(shoppingSpend.filter((i) => !i.transaction_id.startsWith("in-curs"))),
      noAmount: monthSpend.filter((i) => i.amount == null).length,
    };
  }, [data, month, split, today]);

  if (!data || !view) return <Spinner />;
  const names = { categories: new Map(data.categories.map((c) => [c.id, c.name])), retailers: new Map(data.retailers.map((r) => [r.id, r.name])) };
  const mainStatus = view.statuses.find((s) => s.budget.period === "lunar" && s.budget.scope.kind === "familie")
    ?? view.statuses.find((s) => s.budget.period === "lunar" && (s.budget.scope.kind === "total" || s.budget.scope.kind === "alimente"));
  const basketStatus = mainStatus && (mainStatus.budget.scope.kind === "familie" || mainStatus.budget.scope.kind === "total") ? mainStatus : undefined;
  const isCurrentMonth = month === startOfMonth(today);

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

  return (
    <>
      <PageHeader
        title="Buget"
        subtitle="Ce plănuiești și ce cheltui de fapt"
      />

      <IncomeSheet
        open={incomeOpen}
        onClose={handleCloseIncome}
        budget={mainStatus?.budget.scope.kind === "familie" || mainStatus?.budget.scope.kind === "total" ? mainStatus.budget : undefined}
        initialAdd={incomeInitialAdd}
      />

      {view.statuses.length === 0 ? (
        <EmptyState icon={<Wallet size={32} />} title="Setează un buget" action={<Button onClick={() => setEditing("nou")}>Setează bugetul lunar</Button>}>
          Spune cât vrei să cheltui pe lună (sau pe săptămână, la piață, la un anumit magazin) și urmărești cum te încadrezi, chiar din magazin.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3.5">
          {view.statuses.map((s) => (
            <Card key={s.budget.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-sans text-lg font-semibold leading-snug">{s.budget.name}</p>
                  <p className="text-xs text-ink-2">
                    {scopeLabel(s.budget.scope, names)} · {s.budget.period === "lunar" ? formatMonth(s.period.from) : `${formatShortDate(s.period.from)} – ${formatShortDate(s.period.to)}`}
                  </p>
                </div>
                <IconButton label={`Modifică bugetul ${s.budget.name}`} onClick={() => setEditing(s.budget)} className="-mr-2 -mt-2">
                  <Pencil size={18} />
                </IconButton>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className={`text-[28px] font-bold leading-none tracking-tight tabular ${s.over ? "text-accent" : "text-ink"}`}>{formatRon(Math.abs(s.remaining))} <span className="text-sm font-normal text-ink-2">{s.over ? "peste buget" : "rămași"}</span></span>
                <span className="whitespace-nowrap text-sm text-ink-2 tabular">din {formatRon(s.budget.amount)}</span>
              </div>
              {s.budget.period === "lunar" && isCurrentMonth && !s.over && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-2 tabular">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sprout" aria-hidden />
                  <span>~{formatRon(dailyBudgetAvailable(s.remaining, today))}/zi disponibili până la finalul lunii</span>
                </div>
              )}
              <p className="mt-1 text-xs text-ink-2 tabular">Cheltuit {formatRon(s.spent)}</p>
              <div className="mt-2.5">
                {s === basketStatus && data.openEstimate > 0 ? (
                  <>
                    <DualBudgetBar spent={s.spent} pending={data.openEstimate} total={s.budget.amount} label={`${s.budget.name}: cheltuit și coșul de acum`} />
                    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 tabular">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand" /> Cheltuit {formatRon(s.spent)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-warn" /> În coș, estimat {formatRon(data.openEstimate)}
                      </span>
                    </p>
                  </>
                ) : (
                  <BudgetBar pct={s.used_pct} label={`${s.budget.name}: ${s.used_pct}% folosit`} />
                )}
              </div>
              {s.over ? (
                <p className="mt-2 text-sm font-medium text-accent">
                  Ai depășit bugetul cu {formatRon(-s.remaining)}.
                  {s.projected != null && ` La ritmul actual ajungi la ${formatRon(s.projected)} la final de lună.`}
                </p>
              ) : s.projected != null ? (
                <p className="mt-2 text-sm text-ink-2">
                  La ritmul actual ajungi la {formatRon(s.projected)} la final de lună.
                </p>
              ) : null}
              {s.items_without_amount > 0 && <p className="mt-1 text-xs text-warn">{s.items_without_amount === 1 ? "Un produs cumpărat nu are preț" : `${count(s.items_without_amount, "produs", "produse")} cumpărate nu au preț`}. Totalurile declarate ale bonurilor sunt incluse.</p>}
              {s.budget.income_sources && s.budget.income_sources.length > 0 && (() => {
                const incSum = incomeSummary(s.budget.income_sources, s.budget.amount);
                return (
                  <div aria-label="Venituri lunare" role="region" className="mt-3 border-t border-line/60 pt-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">
                        {formatRon(incSum.total)} <span className="font-normal text-ink-2">venituri</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular ${incSum.unallocated < 0 ? "font-medium text-accent" : "text-info"}`}>
                          {formatRon(Math.abs(incSum.unallocated))} {incSum.unallocated < 0 ? "peste venituri" : "nealocați"}
                        </span>
                        <IconButton
                          label="Modifică veniturile și alocarea"
                          onClick={() => {
                            setIncomeInitialAdd(false);
                            setIncomeOpen(true);
                          }}
                          className="-my-1"
                        >
                          <Pencil size={14} />
                        </IconButton>
                      </div>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {s.budget.income_sources.map((source, index) => (
                        <li key={index} className="flex justify-between gap-3 text-xs text-ink-2">
                          <span className="min-w-0 truncate">{source.name}</span>
                          <span className="shrink-0 tabular">{formatRon(source.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {view.statuses.length > 0 && <Button className="mt-3" variant="ghost" icon={<Plus size={16} />} onClick={() => setEditing("nou")}>Adaugă un buget</Button>}

      {data.openEstimate > 0 || data.openUnknown > 0 ? (
        // Toată caseta duce la liste (decizia proprietarului, 18 oct. 2026).
        <Link href="/cumparaturi/" className="mt-3 flex items-center gap-3 rounded-full border border-line bg-surface p-4 transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-2">Înainte de cumpărături</span>
            <span className="mt-1 block text-[15px]">
              {data.openEstimate > 0 ? (
                <>
                  Listele deschise mai au de cumpărat produse de aproximativ <strong className="font-medium">{formatRon(data.openEstimate)}</strong>
                  {data.openUnknown > 0 && <> și {count(data.openUnknown, "produs", "produse")} cu preț necunoscut</>}.
                </>
              ) : (
                <>Listele deschise au {count(data.openUnknown, "produs", "produse")} fără preț cunoscut, deci nu pot estima cât vor costa. Prețurile apar după primele cumpărături.</>
              )}
              {basketStatus && data.openEstimate > 0 && (
                <>
                  {" "}
                  {basketStatus.remaining - data.openEstimate >= 0 ? (
                    <span className="text-brand">După ele, rămân {formatRon(basketStatus.remaining - data.openEstimate)} din buget.</span>
                  ) : (
                    <span className="font-medium text-accent">Depășesc bugetul cu {formatRon(data.openEstimate - basketStatus.remaining)}.</span>
                  )}
                </>
              )}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        </Link>
      ) : null}

      <div className="mb-2 mt-8 flex items-center justify-between">
        <IconButton label="Luna anterioară" onClick={() => setMonth(startOfMonth(addDays(month, -1)))} className="border border-line bg-surface-2 transition-transform active:scale-[0.94]">
          <ChevronLeft size={20} />
        </IconButton>
        <h2 className="font-sans text-xl font-bold tracking-tight text-ink">{capitalizeFirst(formatMonth(month))}</h2>
        <IconButton label="Luna următoare" disabled={isCurrentMonth} onClick={() => setMonth(startOfMonth(addDays(month, 32)))} className="border border-line bg-surface-2 transition-transform active:scale-[0.94]">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Card className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-[24px]">
        <div className="p-3.5 sm:p-4">
          <p className="text-xs text-ink-2">Cheltuit în lună</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular text-ink">{formatRon(view.total)}</p>
        </div>
        <div className="p-3.5 sm:p-4">
          <p className="text-xs text-ink-2">Media unei ieșiri la cumpărături</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular text-ink">{view.avgTrip == null ? "—" : formatRon(view.avgTrip)}</p>
        </div>
      </Card>
      <SectionTitle>Tranzacții</SectionTitle>
      <TransactionFeed month={month} records={data.spend} transactions={data.transactions} expenses={data.expenses} retailers={data.retailers} />
      {view.sources.length > 0 && (
        <p className="mt-2 text-sm text-ink-2 tabular">
          {view.sources.map((s) => `${s.source === "producator" ? "Producători" : SOURCE_LABELS[s.source]}: ${formatRon(s.amount)}`).join(" · ")}
        </p>
      )}

      {data.hasHistory && <>
      <SectionTitle>Ultimele 6 luni</SectionTitle>
      <Card className="p-4">
        <ColumnChart bars={view.months} title="Cheltuieli pe lună" reference={mainStatus?.budget.period === "lunar" ? { value: mainStatus.budget.amount, label: "buget" } : undefined} />
      </Card>

      <SectionTitle>Ultimele 8 săptămâni</SectionTitle>
      <Card className="p-4">
        <ColumnChart bars={view.weeks} title="Cheltuieli pe săptămână" />
      </Card>

      </>}

      <SectionTitle>Categorii de cheltuieli</SectionTitle>
      {data.hasHistory && <div className="mb-3">
        <LabeledSelect label="Împarte după" value={split} onChange={(event) => setSplit(event.target.value as typeof split)}>
          <option value="familie">Cele 12 categorii ale familiei</option>
          <option value="categorii">Categorii de produse</option>
          <option value="magazine">Magazine</option>
        </LabeledSelect>
      </div>}
      <Card className="p-4">
        {!data.hasHistory ? <CompactCategories bars={view.split} /> : view.split.length === 0 ? <p className="text-sm text-ink-2">Nicio cheltuială în {formatMonth(month)}.</p> : <BarList bars={view.split} total={view.splitTotal} />}
        {view.noAmount > 0 && <p className="mt-3 text-xs text-ink-2">{view.noAmount === 1 ? "Un produs fără preț individual" : `${view.noAmount} produse fără preț individual`}. Diferențele față de totalul plătit sunt afișate separat.</p>}
      </Card>
      {data.diverse > 0 && (
        <Link href="/buget/diverse/" className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-medium transition duration-150 ease-out hover:bg-surface-2 active:scale-[0.99]">
          <Shapes size={18} /> Mută din Diverse ({data.diverse})
        </Link>
      )}

      {/* Fără flex-1 în coloană: butoanele își păstrează înălțimea de 44 px. */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/buget/preturi/" className="col-span-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface-2 font-medium transition duration-150 ease-out hover:border-ink-3 active:scale-[0.99]">
          <Tags size={18} /> Prețuri și comparații
        </Link>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(false)} disabled={view.monthSpend.length === 0}>
          Exportă luna
        </Button>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(true)} disabled={data.spend.length === 0}>
          Exportă tot
        </Button>
      </div>

      <BudgetEditorSheet
        editing={editing}
        onClose={() => setEditing(null)}
        categories={data.categories}
        retailers={data.retailers}
        isFirstBudget={data.budgets.length === 0}
        onOpenIncome={() => {
          setIncomeInitialAdd(false);
          setIncomeOpen(true);
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <BudgetScreen />
    </AppShell>
  );
}
