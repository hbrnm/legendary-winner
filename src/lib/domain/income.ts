import type { BudgetIncomeSource } from "./types";
import { roundMoney, sumMoney } from "./money";

export function incomeSummary(sources: BudgetIncomeSource[] | undefined, allocated: number) {
  const total = sumMoney((sources ?? []).map(source => source.amount));
  return { total, unallocated: roundMoney(total - allocated) };
}
