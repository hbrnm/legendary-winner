import { describe, expect, it } from "vitest";
import { formatRon } from "@/lib/domain/money";
import { costAmount, costCoverage, partialCostLabel } from "./recipe-cost";

describe("costul cu prețuri lipsă", () => {
  it("suma apare doar peste 80% din ingrediente cu preț", () => {
    expect(costCoverage(0, 5)).toBe("none");
    expect(costCoverage(4, 5)).toBe("partial"); // exact 80%: nu e „peste”
    expect(costCoverage(5, 6)).toBe("approx");
    expect(costCoverage(6, 6)).toBe("complete");
  });

  it("cu câteva prețuri lipsă, suma are „~” în față", () => {
    expect(costAmount(8.5, 6, 6)).toBe(formatRon(8.5));
    expect(costAmount(8.5, 9, 10)).toBe(`~${formatRon(8.5)}`);
    expect(costAmount(8.5, 3, 7)).toBeNull();
  });

  it("altfel spune câte ingrediente au preț", () => {
    expect(partialCostLabel(3, 7)).toBe("preț pentru 3 din 7 ingrediente");
    expect(partialCostLabel(18, 30)).toBe("preț pentru 18 din 30 de ingrediente");
  });
});

