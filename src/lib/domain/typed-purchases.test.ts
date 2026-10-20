import { describe, expect, it } from "vitest";
import { parseTypedPurchases } from "./typed-purchases";

const lines = (text: string) => parseTypedPurchases(text).lines.map(({ name, quantity, unit, amount, check }) => ({ name, quantity, unit, amount, check }));

describe("cumpărăturile scrise", () => {
  it("câte una pe rând: numele, cantitatea, suma", () => {
    expect(lines("lapte 2 buc 13,98\npâine 5,50\nroșii 1,2 kg 14,30")).toEqual([
      { name: "lapte", quantity: 2, unit: "buc", amount: 13.98, check: "sigur" },
      { name: "pâine", quantity: null, unit: null, amount: 5.5, check: "sigur" },
      { name: "roșii", quantity: 1.2, unit: "kg", amount: 14.3, check: "sigur" },
    ]);
  });

  it("dictate, despărțite prin virgulă, cu „lei” și virgula zecimală păstrată", () => {
    expect(lines("Lapte 13,98 lei, pâine 5.50 lei, ouă 10 lei")).toEqual([
      { name: "Lapte", quantity: null, unit: null, amount: 13.98, check: "sigur" },
      { name: "pâine", quantity: null, unit: null, amount: 5.5, check: "sigur" },
      { name: "ouă", quantity: null, unit: null, amount: 10, check: "sigur" },
    ]);
  });

  it("„13 lei și 98 de bani”, gramele, „bucăți” și „x3”", () => {
    expect(lines("brânză 500 grame 21 lei și 5 bani; iaurt 3 bucăți 7,47; suc x3 15")).toEqual([
      { name: "brânză", quantity: 0.5, unit: "kg", amount: 21.05, check: "sigur" },
      { name: "iaurt", quantity: 3, unit: "buc", amount: 7.47, check: "sigur" },
      { name: "suc", quantity: 3, unit: "buc", amount: 15, check: "sigur" },
    ]);
  });

  it("două numere fără unitate: primul e cantitatea, ultimul suma", () => {
    expect(lines("lapte 2 13,98")[0]).toEqual({ name: "lapte", quantity: 2, unit: "buc", amount: 13.98, check: "sigur" });
  });

  it("fără sumă: nu inventează, linia e „de verificat”; rândurile goale se sar", () => {
    expect(lines("\nmere\n\n")).toEqual([{ name: "mere", quantity: null, unit: null, amount: null, check: "de_verificat" }]);
    expect(parseTypedPurchases("  \n ").lines).toEqual([]);
  });

  it("virgula dictată înainte de sumă nu desparte produsul", () => {
    expect(lines("lapte 2 buc, 13,98, pâine, 5,50")).toEqual([
      { name: "lapte", quantity: 2, unit: "buc", amount: 13.98, check: "sigur" },
      { name: "pâine", quantity: null, unit: null, amount: 5.5, check: "sigur" },
    ]);
  });

  it("zecimalele din nume rămân în nume; unitatea e un cuvânt întreg", () => {
    expect(lines("cola 0,5 8\nlapte 1,5 6,99\n2 găini 40\niaurt 3 bucăţi 7,47")).toEqual([
      { name: "cola 0,5", quantity: null, unit: null, amount: 8, check: "sigur" },
      { name: "lapte 1,5", quantity: null, unit: null, amount: 6.99, check: "sigur" },
      { name: "2 găini", quantity: null, unit: null, amount: 40, check: "sigur" },
      { name: "iaurt", quantity: 3, unit: "buc", amount: 7.47, check: "sigur" },
    ]);
  });

  it("suma liniilor, fără total de bon", () => {
    expect(parseTypedPurchases("pâine 5,50\nlapte 13,98")).toMatchObject({ total: null, lines_total: 19.48, chain: null, date: null });
  });
});
