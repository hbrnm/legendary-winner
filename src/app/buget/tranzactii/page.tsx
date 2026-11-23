"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useData } from "@/components/app/hooks";
import { IconButton } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { TransactionFeed } from "@/components/budget/transaction-feed";
import { householdSpendRecords, owned, visible } from "@/lib/services/queries";
import { addMonths, formatMonth, startOfMonth, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import { capitalizeFirst } from "@/lib/domain/text";

// Lista completă de tranzacții ale lunii, separată de pagina de buget ca
// aceasta să rămână scurtă (decizia proprietarului, 23 nov. 2026).

function TransactionsScreen() {
  const today = toISODate(now());
  const [month, setMonth] = useState(startOfMonth(today));
  const data = useData(async (ctx) => {
    const [spend, transactions, expenses, retailers] = await Promise.all([
      householdSpendRecords(ctx.db, ctx.householdId),
      owned(ctx.db, "shopping_transactions", ctx.householdId),
      owned(ctx.db, "manual_expenses", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
    ]);
    return { spend, transactions, expenses, retailers };
  });

  if (!data) return <Spinner />;
  const isCurrentMonth = month === startOfMonth(today);

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link href="/buget/" aria-label="Înapoi la buget" className="-ml-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="min-w-0 break-words text-[32px] font-bold leading-tight tracking-tight">Tranzacții</h1>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Luna anterioară" onClick={() => setMonth(addMonths(month, -1))} className="border border-line bg-surface-2 transition-transform active:scale-[0.94]">
          <ChevronLeft size={20} />
        </IconButton>
        <h2 className="font-sans text-xl font-bold tracking-tight text-ink">{capitalizeFirst(formatMonth(month))}</h2>
        <IconButton label="Luna următoare" disabled={isCurrentMonth} onClick={() => setMonth(addMonths(month, 1))} className="border border-line bg-surface-2 transition-transform active:scale-[0.94]">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <TransactionFeed month={month} records={data.spend} transactions={data.transactions} expenses={data.expenses} retailers={data.retailers} />
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <TransactionsScreen />
    </AppShell>
  );
}
