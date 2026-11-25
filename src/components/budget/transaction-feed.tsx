"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/fields";
import { Card } from "@/components/ui/misc";
import { formatShortDate, inPeriod, localDateOf, monthPeriod } from "@/lib/domain/dates";
import { spendInPeriod } from "@/lib/domain/budget";
import { formatRon, sumMoney } from "@/lib/domain/money";
import { normalize } from "@/lib/domain/search";
import { expenseCategoryName } from "@/lib/domain/expense-categories";
import type { ManualExpense, Retailer, ShoppingTransaction, SpendRecord } from "@/lib/domain/types";
import { ManualExpenseActions } from "./expenses";
import { projectTransactions } from "./transactions";

export function TransactionFeed({ records, transactions, expenses, retailers, month, scoped = false }: {
  records: SpendRecord[]; transactions: ShoppingTransaction[]; expenses: ManualExpense[]; retailers: Retailer[]; month: string; scoped?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "receipts" | "manual" | "unknown">("all");
  const [query, setQuery] = useState("");
  const expenseMap = useMemo(() => new Map(expenses.map(expense => [expense.id, expense])), [expenses]);
  const retailerMap = useMemo(() => new Map(retailers.map(retailer => [retailer.id, retailer.name])), [retailers]);
  const rows = useMemo(() => {
    const period = monthPeriod(month);
    const q = normalize(query.trim());
    return projectTransactions(spendInPeriod(records, period), transactions, scoped)
      .filter(row => inPeriod(localDateOf(row.date), period))
      .filter(row => {
        if (filter === "manual") return row.kind === "manual";
        if (filter === "receipts") return row.kind === "receipt";
        if (filter === "unknown") return row.amount == null || row.unknownCount > 0;
        return true;
      })
      .filter(row => {
        if (!q) return true;
        const expense = row.manualId ? expenseMap.get(row.manualId) : undefined;
        const place = row.retailerId ? retailerMap.get(row.retailerId) : undefined;
        const haystack = normalize([row.title, place, expense?.description, expense?.note, expense?.place_name, expense ? expenseCategoryName(expense.category_id) : ""].filter(Boolean).join(" "));
        return haystack.includes(q);
      });
  }, [records, transactions, month, filter, scoped, query, expenseMap, retailerMap]);
  const filteredTotal = useMemo(() => sumMoney(rows.map(row => row.amount ?? 0)), [rows]);
  return <div>
    <div className="mb-3 flex items-center gap-2 rounded-full bg-surface-container-high px-4 transition-colors duration-150 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/25">
      <Search size={18} className="text-ink-3" aria-hidden />
      <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Caută magazin, categorie sau notă" aria-label="Caută tranzacții" className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none" />
    </div>
    <Segmented label="Tipul tranzacțiilor" value={filter} onChange={setFilter} options={[
      { value: "all", label: "Toate" },
      { value: "receipts", label: "Bonuri" },
      { value: "manual", label: "Manuale" },
      { value: "unknown", label: "Fără sumă" },
    ]} />
    {rows.length > 0 && (
      <p className="mt-2.5 flex items-center justify-between px-1 text-xs text-ink-2 tabular-nums">
        <span>{rows.length} {rows.length === 1 ? "tranzacție" : "tranzacții"}</span>
        <span className="font-semibold text-ink">{formatRon(filteredTotal)}</span>
      </p>
    )}
    <Card className="mt-2 overflow-hidden">
      {rows.length === 0 ? <p className="p-4 text-sm text-ink-2">{query.trim() ? "Nicio tranzacție găsită pentru căutarea ta." : "Nicio tranzacție în această lună."}</p> : <ul className="divide-y divide-line">{rows.map(row => {
        const expense = row.manualId ? expenseMap.get(row.manualId) : undefined;
        const title = expense?.description ?? (row.retailerId ? retailerMap.get(row.retailerId) : null) ?? row.title;
        const content = <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-medium">{title}</p>
          <p className="mt-1 text-xs text-ink-2">{formatShortDate(localDateOf(row.date))} · {expense ? expenseCategoryName(expense.category_id) : row.pending ? "În curs · produse bifate" : "Bon / cumpărături"}{expense?.place_name ? ` · ${expense.place_name}` : ""}</p>
          <p className="mt-1 font-medium tabular">{scoped && row.kind === "receipt" && <span className="text-xs font-normal text-ink-2">În filtrul ales · </span>}{row.amount == null ? "Sumă necunoscută" : formatRon(row.amount)}</p>
          {row.unallocated !== 0 && <p className="mt-1 text-xs text-ink-2">Diferență nealocată: {formatRon(row.unallocated)}</p>}
          {row.unknownCount > 0 && <p className="mt-1 text-xs text-ink-2">{row.unknownCount} produse fără preț individual</p>}
          {expense?.note && expense.note.trim() !== expense.description.trim() && <p className="mt-1 break-words text-xs text-ink-2">{expense.note}</p>}
        </div>;
        return <li key={row.id} className="p-3">{expense ? <div className="flex items-start gap-1">{content}<ManualExpenseActions expense={expense} retailers={retailers} /></div> : <Link className="flex min-h-12 items-center gap-2" href={row.href ?? "/cumparaturi/istoric/"}>{content}<ChevronRight size={18} className="shrink-0 text-ink-3" /></Link>}</li>;
      })}</ul>}
    </Card>
    <Link className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand" href="/cumparaturi/istoric/">Istoricul cumpărăturilor <ChevronRight size={16} /></Link>
  </div>;
}
