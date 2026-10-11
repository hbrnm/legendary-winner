import { describe, expect, it } from "vitest";
import { parseMoney, sumMoney } from "./money";

describe("bani", () => {
  it("adună fără erori de virgulă mobilă", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([12.99, 7.01, 0.5])).toBe(20.5);
  });

  it("citește sume scrise de om", () => {
    expect(parseMoney("12,50")).toBe(12.5);
    expect(parseMoney("8.9 lei")).toBe(8.9);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-3")).toBeNull();
    expect(parseMoney("1,234")).toBeNull();
  });
});
