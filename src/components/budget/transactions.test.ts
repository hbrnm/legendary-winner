import { describe, expect, it } from "vitest";
import { txItem } from "@/test/factories";
import { projectTransactions, hasSpendHistory } from "./transactions";
import type { ShoppingTransaction, SpendRecord } from "@/lib/domain/types";

const tx: ShoppingTransaction = { id: "trip", household_id: "h1", created_at: "2026-11-01", updated_at: "2026-11-01", deleted_at: null, list_id: null, list_cycle: null, started_at: "2026-11-01", completed_at: "2026-11-01T12:00:00", note: null, declared_total: 12 };
const item = (overrides: Partial<SpendRecord> = {}) => txItem({ transaction_id: "trip", amount: 20, purchased_at: "2026-11-01T12:00:00", ...overrides });

describe("unified budget transaction projection", () => {
  it("groups receipt lines and the negative authoritative adjustment once, with stable ids", () => {
    const a = item({ id: "a" });
    const delta = item({ id: "delta", amount: -8, unallocated: true });
    const rows = projectTransactions([a, delta, a], [tx]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "trip:trip", kind: "receipt", amount: 12, itemCount: 1, pending: false, unallocated: -8 });
    expect(projectTransactions([delta, a], [tx])[0].id).toBe(rows[0].id);
  });

  it("includes a total-only receipt, separate manual identity and marked pending group", () => {
    const manual = item({ id: "manual:trip", transaction_id: "manual:trip", manual_expense_id: "trip", name: "Chirie", amount: 800 });
    const pending = item({ id: "p", transaction_id: "in-curs:list1", amount: null });
    const rows = projectTransactions([manual, pending], [tx]);
    expect(rows).toHaveLength(3);
    expect(rows.find(row => row.kind === "receipt" && !row.pending)).toMatchObject({ amount: 12, itemCount: 0 });
    expect(rows.find(row => row.kind === "manual")).toMatchObject({ id: "manual:trip", amount: 800 });
    expect(rows.find(row => row.pending)).toMatchObject({ id: "trip:in-curs:list1", amount: null, href: "/cumparaturi/lista/?id=list1" });
  });

  it("omits deleted records and retains unknown line counts without inventing a price", () => {
    const rows = projectTransactions([item({ id: "known", amount: 5 }), item({ id: "unknown", amount: null }), item({ id: "deleted", amount: 99, deleted_at: "2026-11-02" })]);
    expect(rows[0]).toMatchObject({ amount: 5, unknownCount: 1, itemCount: 2 });
    expect(projectTransactions([], [{ ...tx, deleted_at: "2026-11-02" }])).toEqual([]);
  });

  it("requires real nonzero spend in two months before showing historical charts", () => {
    const november = item();
    const octoberUnknown = item({ id: "oct", purchased_at: "2026-10-01T12:00:00", amount: null });
    expect(hasSpendHistory([november, octoberUnknown])).toBe(false);
    expect(hasSpendHistory([november, { ...octoberUnknown, amount: 0 }])).toBe(false);
    expect(hasSpendHistory([november, { ...octoberUnknown, amount: 10 }])).toBe(true);
    expect(hasSpendHistory([november, { ...octoberUnknown, amount: 10, deleted_at: "2026-11-02" }])).toBe(false);
  });
});

it("keeps the market source visible for historical receipts without a saved retailer", () => {
  const rows=projectTransactions([txItem({transaction_id:"market",name:"Roșii",source:"piata",retailer_id:null,amount:10})]);
  expect(rows[0].title).toBe("Piață");
});
