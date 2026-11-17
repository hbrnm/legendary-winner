"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Segmented } from "@/components/ui/fields";
import { Card } from "@/components/ui/misc";
import { formatShortDate, inPeriod, localDateOf, monthPeriod } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import { expenseCategoryName } from "@/lib/domain/expense-categories";
import type { ManualExpense, Retailer, ShoppingTransaction, SpendRecord } from "@/lib/domain/types";
import { ManualExpenseActions } from "./expenses";
import { projectTransactions } from "./transactions";

export function TransactionFeed({ records, transactions, expenses, retailers, month }: {
  records: SpendRecord[]; transactions: ShoppingTransaction[]; expenses: ManualExpense[]; retailers: Retailer[]; month: string;
}) {
  const [filter, setFilter] = useState<"all" | "receipts" | "manual">("all");
  const rows = useMemo(() => projectTransactions(records, transactions).filter(row => inPeriod(localDateOf(row.date), monthPeriod(month)))
    .filter(row => filter === "all" || (filter === "manual" ? row.kind === "manual" : row.kind === "receipt")), [records, transactions, month, filter]);
  const expenseMap = new Map(expenses.map(expense => [expense.id, expense]));
  const retailerMap = new Map(retailers.map(retailer => [retailer.id, retailer.name]));
  return <div>
    <Segmented label="Tipul tranzacțiilor" value={filter} onChange={setFilter} options={[{ value: "all", label: "Toate" }, { value: "receipts", label: "Bonuri" }, { value: "manual", label: "Manuale" }]} />
    <Card className="mt-3 overflow-hidden">
      {rows.length === 0 ? <p className="p-4 text-sm text-ink-2">Nicio tranzacție în această lună.</p> : <ul className="divide-y divide-line">{rows.map(row => {
        const expense = row.manualId ? expenseMap.get(row.manualId) : undefined;
        const title = expense?.description ?? (row.retailerId ? retailerMap.get(row.retailerId) : null) ?? row.title;
        const content = <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{title}</p>
          <p className="mt-1 text-xs text-ink-2">{formatShortDate(localDateOf(row.date))} · {expense ? expenseCategoryName(expense.category_id) : row.pending ? "În curs · produse bifate" : "Bon / cumpărături"}{expense?.place_name ? ` · ${expense.place_name}` : ""}</p>
          <p className="mt-1 font-medium tabular">{row.amount == null ? "Sumă necunoscută" : formatRon(row.amount)}</p>
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
