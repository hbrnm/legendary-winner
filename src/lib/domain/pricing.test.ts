import { describe, expect, it } from "vitest";
import { buildPriceIndex, estimateCost, latestUnitPrice } from "./pricing";
import { price } from "@/test/factories";

describe("prețuri", () => {
  it("folosește cel mai recent preț și convertește unitatea", () => {
    const idx = buildPriceIndex([
      price({ product_id: "rosii", amount: 10, quantity: 1, unit: "kg", observed_on: "2026-02-01" }),
      price({ product_id: "rosii", amount: 12, quantity: 1, unit: "kg", observed_on: "2026-03-01" }),
    ]);
    expect(latestUnitPrice(idx, "rosii", "g")?.per_unit).toBeCloseTo(0.012);
    expect(estimateCost(idx, "rosii", 500, "g")).toEqual({ cost: 6, observed_on: "2026-03-01" });
  });

  it("nu inventează un preț pentru unități incompatibile", () => {
    const idx = buildPriceIndex([price({ product_id: "miere", amount: 35, quantity: 1, unit: "borcan" })]);
    expect(estimateCost(idx, "miere", 200, "g")).toBeNull();
    expect(estimateCost(idx, "miere", 2, "borcan")?.cost).toBe(70);
  });

  it("ignoră prețurile șterse și produsele fără preț", () => {
    const idx = buildPriceIndex([price({ product_id: "lapte", amount: 8, quantity: 1, unit: "l", deleted_at: "2026-03-02T00:00:00Z" })]);
    expect(latestUnitPrice(idx, "lapte")).toBeNull();
    expect(latestUnitPrice(idx, "branza")).toBeNull();
  });
});
