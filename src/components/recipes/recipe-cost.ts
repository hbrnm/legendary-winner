import { formatRon } from "@/lib/domain/money";
import { count } from "@/lib/domain/text";

/**
 * Cum se arată un cost cu prețuri lipsă (decizia proprietarului, 18 oct. 2026):
 * suma apare doar peste 80% din ingrediente cu preț, cu „~” dacă lipsesc câteva;
 * altfel doar „preț pentru X din Y ingrediente”, fără sumă.
 */
export type CostCoverage = "none" | "complete" | "approx" | "partial";

export function costCoverage(priced: number, costable: number): CostCoverage {
  if (priced === 0) return "none";
  if (priced >= costable) return "complete";
  return priced * 100 > costable * 80 ? "approx" : "partial";
}

/** Suma, cu „~” în față când lipsesc câteva prețuri; null când suma nu se arată. */
export function costAmount(amount: number, priced: number, costable: number): string | null {
  const c = costCoverage(priced, costable);
  if (c === "complete") return formatRon(amount);
  if (c === "approx") return `~${formatRon(amount)}`;
  return null;
}

/** „preț pentru 3 din 7 ingrediente” (cu acordul: „din 20 de ingrediente”). */
export function partialCostLabel(priced: number, costable: number): string {
  return `preț pentru ${priced} din ${count(costable, "ingredient", "ingrediente")}`;
}
