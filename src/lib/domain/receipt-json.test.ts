import { describe, expect, it } from "vitest";
import { readReceiptJson, receiptFromJson, type ReceiptJson, type ReceiptJsonLine } from "./receipt-json";
import { roundMoney } from "./money";

// Bonul citit de Gemini ca JSON (.tasks/015). Bonul Lidl din 13 oct. 2026, în forma
// pe care o cere schema (aceleași linii ca __fixtures__/bon-4-lidl-gemini.txt).

const line = (label: string, amount: string, discount: string | null = null): ReceiptJsonLine => ({ label, amount, quantity: 1, unit: "buc", unitAmount: amount, discount });
const LIDL: ReceiptJson = {
  error: null,
  store: "Lidl",
  date: "2026-10-13",
  total: "112.22",
  lines: [
    line("Iaurt in stil grecesc", "11.19"),
    line("Bomboane cu lapte", "14.99"),
    line("Inghetata vanilie", "14.99"),
    line("Sacosa maiou", "0.81"),
    line("Ecotaxa/Cost DEEE", "0.18"),
    line("Unt de arahide", "24.99"),
    line("Seminte de dovleac natur", "8.49", "8.49"),
    line("Ciocolata neagra 85%", "12.49"),
    line("Cuvertura de cacao", "12.99"),
    line("Cheescake caramel sarat", "16.99", "4.00"),
    line("Bautura portocale", "6.60"),
  ],
  discounts: [],
};

const paid = (r: ReturnType<typeof receiptFromJson>) => r.lines.map((l) => roundMoney((l.amount ?? 0) - (l.discount ?? 0)));

describe("receiptFromJson", () => {
  it("bonul Lidl: magazinul, data, cele 11 linii plătite după reduceri, totalul confirmat", () => {
    const r = receiptFromJson(LIDL);
    expect(r).toMatchObject({ chain: "lidl", date: "2026-10-13", total: 112.22, lines_total: 112.22, total_matches: true });
    expect(r.lines.every((l) => l.check === "sigur")).toBe(true);
    expect(paid(r)).toEqual([11.19, 14.99, 14.99, 0.81, 0.18, 24.99, 0, 12.49, 12.99, 12.99, 6.6]);
    expect(r.lines[0]).toMatchObject({ name: "Iaurt in stil grecesc", quantity: 1, unit: "buc", unit_price: 11.19 });
  });

  it("cântărit: cantitatea în kg și prețul pe kg, ca pe bon", () => {
    const r = receiptFromJson({ ...LIDL, total: "4.81", lines: [{ label: "Banane", amount: "4.81", quantity: 0.482, unit: "kg", unitAmount: "9.99", discount: null }] });
    expect(r.lines[0]).toMatchObject({ quantity: 0.482, unit: "kg", unit_price: 9.99, amount: 4.81, check: "sigur" });
  });

  it("suma nu dă totalul: nimic schimbat; sigure doar liniile confirmate de cantitate × preț", () => {
    const r = receiptFromJson({ ...LIDL, total: "20.00", lines: [line("Lapte", "5.29"), { label: "Paine", amount: "4.96", quantity: 2, unit: "buc", unitAmount: "2.49", discount: null }] });
    expect(r).toMatchObject({ total: 20, lines_total: 10.25, total_matches: false });
    expect(r.lines.map((l) => [l.amount, l.check])).toEqual([
      [5.29, "sigur"],
      [4.96, "de_verificat"],
    ]);
  });

  it("lipsește suma liniei: cantitate × preț, de verificat; fără ele, rămâne fără sumă", () => {
    const r = receiptFromJson({ ...LIDL, total: null, lines: [{ label: "Oua", amount: null, quantity: 2, unit: "buc", unitAmount: "1.50", discount: null }, { label: "Mere", amount: null, quantity: null, unit: null, unitAmount: null, discount: null }] });
    expect(r.lines.map((l) => [l.amount, l.check])).toEqual([
      [3, "de_verificat"],
      [null, "de_verificat"],
    ]);
    expect(r.total_matches).toBe(false);
  });

  it("o reducere pe tot bonul se împarte pe linii după sumă, la ban, și dă totalul", () => {
    const r = receiptFromJson({ ...LIDL, total: "9.00", lines: [line("A", "6.00"), line("B", "4.00")], discounts: [{ label: "Voucher", amount: "1.00" }] });
    expect(paid(r)).toEqual([5.4, 3.6]);
    expect(r).toMatchObject({ lines_total: 9, total_matches: true });
    const odd = receiptFromJson({ ...LIDL, total: "9.99", lines: [line("A", "3.33"), line("B", "3.33"), line("C", "3.34")], discounts: [{ label: "Card", amount: "0.01" }] });
    expect(odd).toMatchObject({ lines_total: 9.99, total_matches: true });
  });
});

describe("receiptFromJson, citiri greșite", () => {
  it("o reducere mai mare decât linia ei: totalul nu mai confirmă nimic", () => {
    const r = receiptFromJson({ ...LIDL, total: "1.00", lines: [line("A", "5.00", "9.00"), line("B", "5.00")] });
    expect(r.total_matches).toBe(false);
  });

  it("o reducere pe bon mai mare decât toate liniile nu se împarte; suma nu dă totalul", () => {
    const r = receiptFromJson({ ...LIDL, total: "1.00", lines: [line("A", "2.00")], discounts: [{ label: "Voucher", amount: "5.00" }] });
    expect(r).toMatchObject({ lines_total: 2, total_matches: false });
  });
});

describe("readReceiptJson", () => {
  it("păstrează forma cerută și ignoră câmpurile în plus", () => {
    expect(readReceiptJson({ ...LIDL, extra: 1 })).toEqual(LIDL);
  });

  it("minusul: iertat la reduceri, dar o sumă negativă (retur) nu e cumpărătură; zecimal fără punct sau data greșită, null", () => {
    const r = readReceiptJson({ ...LIDL, date: "13/10/2026", total: "112,22", lines: [{ label: "  Iaurt   grecesc ", amount: "-8.49", quantity: 0, unit: "litri", unitAmount: "abc", discount: "-8.49" }], discounts: [{ label: "Card", amount: "-1.00" }] })!;
    expect(r).toMatchObject({ date: null, total: null, discounts: [{ label: "Card", amount: "1.00" }] });
    expect(r.lines[0]).toEqual({ label: "Iaurt grecesc", amount: null, quantity: null, unit: null, unitAmount: null, discount: "8.49" });
    expect(readReceiptJson({ ...LIDL, date: "2026-02-30" })!.date).toBeNull();
    expect(readReceiptJson({ ...LIDL, date: "2026-13-01" })!.date).toBeNull();
    expect(readReceiptJson({ ...LIDL, date: "2028-02-29" })!.date).toBe("2028-02-29");
  });

  it("o linie cu sumă, dar fără nume, rămâne (de verificat); una fără nume și fără sumă se sare", () => {
    const r = readReceiptJson({ ...LIDL, total: "3.00", lines: [{ label: " ", amount: "3.00" }, { label: "", amount: null }] })!;
    expect(r.lines).toEqual([{ label: "", amount: "3.00", quantity: null, unit: null, unitAmount: null, discount: null }]);
    expect(receiptFromJson(r)).toMatchObject({ total_matches: false, lines: [{ name: "", amount: 3, check: "de_verificat" }] });
  });

  it("sare liniile goale, reducerile fără sumă; taie la limite; refuză ce nu are linii", () => {
    const r = readReceiptJson({ ...LIDL, lines: [{ label: "" }, ...Array.from({ length: 5 }, () => line("x".repeat(500), "1.00"))], discounts: [{ label: "Card", amount: null }, { label: "Zero", amount: "0.00" }] }, { maxLines: 3, maxLabel: 10 })!;
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].label).toHaveLength(10);
    expect(r.discounts).toEqual([]);
    expect(readReceiptJson({ error: null })).toBeNull();
    expect(readReceiptJson("text")).toBeNull();
  });
});
