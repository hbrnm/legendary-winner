import { describe, expect, it } from "vitest";
import { canConvert, convert, convertForProduct, formatQuantity, humanize } from "./units";

describe("unități", () => {
  it("convertește în aceeași dimensiune", () => {
    expect(convert(1.5, "kg", "g")).toBe(1500);
    expect(convert(250, "ml", "l")).toBe(0.25);
    expect(convert(2, "lingura", "ml")).toBe(30);
  });

  it("refuză conversia între dimensiuni diferite", () => {
    expect(convert(1, "kg", "l")).toBeNull();
    expect(canConvert("borcan", "kg")).toBe(false);
    expect(canConvert("legatura", "legatura")).toBe(true);
  });

  it("alege unitatea lizibilă", () => {
    expect(humanize(1500, "g")).toEqual({ quantity: 1.5, unit: "kg" });
    expect(humanize(0.25, "kg")).toEqual({ quantity: 250, unit: "g" });
    expect(humanize(2, "legatura")).toEqual({ quantity: 2, unit: "legatura" });
  });

  it("formatează în română", () => {
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(2, "legatura")).toBe("2 legături");
    expect(formatQuantity(1, "borcan")).toBe("1 borcan");
    expect(formatQuantity(null, null)).toBe("");
  });
});

describe("bucată ↔ masă cu greutatea pe bucată", () => {
  it("convertește doar când produsul are greutatea", () => {
    expect(convertForProduct(10, "buc", "kg", 150)).toBe(1.5);
    expect(convertForProduct(300, "g", "buc", 150)).toBe(2);
    expect(convertForProduct(10, "buc", "kg", null)).toBeNull();
    expect(convertForProduct(1, "buc", "l", 150)).toBeNull();
    expect(convertForProduct(500, "g", "kg", null)).toBe(0.5);
  });
});

describe("volum ↔ masă cu densitatea produsului", () => {
  it("convertește lingurile doar când produsul are densitatea", () => {
    expect(convertForProduct(2, "lingura", "g", { grams_per_ml: 0.85 })).toBeCloseTo(25.5);
    expect(convertForProduct(100, "g", "lingurita", { grams_per_ml: 0.5 })).toBeCloseTo(40);
    expect(convertForProduct(2, "lingura", "kg", { piece_grams: 150 })).toBeNull();
    expect(convertForProduct(2, "lingura", "kg", null)).toBeNull();
    expect(convertForProduct(2, "lingura", "ml", { grams_per_ml: 0.85 })).toBe(30);
  });
});
