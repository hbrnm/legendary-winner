import type { ShoppingTransaction, SpendRecord } from "@/lib/domain/types";
import { localDateOf } from "@/lib/domain/dates";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import { sumMoney } from "@/lib/domain/money";

export interface BudgetTransaction {
  id: string;
  kind: "receipt" | "manual";
  pending: boolean;
  date: string;
  amount: number | null;
  itemCount: number;
  unknownCount: number;
  unallocated: number;
  title: string;
  retailerId: string | null;
  manualId?: string;
  href?: string;
}

/** Read-only grouping: totals already include any authoritative-total adjustment. */
export function projectTransactions(records: SpendRecord[], transactions: ShoppingTransaction[] = []): BudgetTransaction[] {
  const groups = new Map<string, SpendRecord[]>();
  const txMap = new Map(transactions.filter(tx => !tx.deleted_at).map(tx => [tx.id, tx]));
  const seen = new Set<string>();
  for (const record of records) {
    if (record.deleted_at || seen.has(record.id)) continue;
    seen.add(record.id);
    const key = record.manual_expense_id ? `manual:${record.manual_expense_id}` : `trip:${record.transaction_id}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  // A zero total needs no synthetic adjustment; keep the actual transaction visible.
  for (const tx of txMap.values()) {
    if (tx.completed_at && tx.declared_total != null && !groups.has(`trip:${tx.id}`)) groups.set(`trip:${tx.id}`, []);
  }
  return [...groups].map(([id, rows]): BudgetTransaction => {
    const first = rows[0];
    const manualId = first?.manual_expense_id;
    const transactionId = first?.transaction_id ?? id.slice(5);
    const tx = txMap.get(transactionId);
    const pending = transactionId.startsWith("in-curs:");
    const lines = rows.filter(row => !row.unallocated);
    const known = rows.filter(row => row.amount != null);
    return {
      id, kind: manualId ? "manual" : "receipt", pending,
      date: tx?.completed_at ?? rows.reduce((latest, row) => row.purchased_at > latest ? row.purchased_at : latest, ""),
      amount: tx?.declared_total ?? (known.length ? sumMoney(known.map(row => row.amount!)) : null),
      itemCount: lines.length, unknownCount: lines.filter(row => row.amount == null).length,
      unallocated: sumMoney(rows.filter(row => row.unallocated).map(row => row.amount ?? 0)),
      title: manualId ? first.name : pending ? "Cumpărături în curs" : tx?.note || [...new Set(lines.filter(row => row.source === "piata" || row.source === "producator").map(row => SOURCE_LABELS[row.source]))].join(", ") || "Cumpărături",
      retailerId: tx?.retailer_id ?? first?.retailer_id ?? null,
      ...(manualId ? { manualId } : { href: pending ? `/cumparaturi/lista/?id=${encodeURIComponent(transactionId.slice(8))}` : "/cumparaturi/istoric/" }),
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Calendar buckets without purchases do not qualify as historical data. */
export function hasSpendHistory(records: SpendRecord[]): boolean {
  const totals = new Map<string, number[]>();
  for (const row of records) {
    if (row.deleted_at || row.amount == null) continue;
    const key = localDateOf(row.purchased_at).slice(0, 7);
    totals.set(key, [...(totals.get(key) ?? []), row.amount]);
  }
  return [...totals.values()].filter(amounts => sumMoney(amounts) > 0).length >= 2;
}
