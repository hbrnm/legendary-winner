import { describe, expect, it } from "vitest";
import { isGtin } from "./barcode";

describe("validarea codurilor de bare GTIN", () => {
  it("acceptă coduri GTIN-8, GTIN-12, GTIN-13 și GTIN-14 valide", () => {
    expect(isGtin("01234565")).toBe(true);
    expect(isGtin("036000291452")).toBe(true);
    expect(isGtin("5949084024838")).toBe(true);
    expect(isGtin("10012345678902")).toBe(true);
  });

  it("respinge cifre de control greșite, lungimi invalide și caractere ne-numerice", () => {
    expect(isGtin("5949084024839")).toBe(false);
    expect(isGtin("01234564")).toBe(false);
    expect(isGtin("1234567")).toBe(false);
    expect(isGtin("123456789")).toBe(false);
    expect(isGtin("123456789012345")).toBe(false);
    expect(isGtin("594908402483a")).toBe(false);
    expect(isGtin("")).toBe(false);
  });
});
