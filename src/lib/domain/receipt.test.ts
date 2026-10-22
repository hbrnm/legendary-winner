import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseReceipt } from "./receipt";
import { roundMoney } from "./money";

// Textele OCR (tesseract.js 7, „ron”) ale bonurilor reale din proba de la
// .tasks/005, etapa 1, anonimizate: fără ID unic, card, casier, serie.
const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/bon-${name}.txt`, import.meta.url), "utf8");

describe("bon Kaufland (OCR real)", () => {
  const r = parseReceipt(fixture("3-kaufland"));

  it("magazinul, data și totalul", () => {
    expect(r).toMatchObject({ chain: "kaufland", date: "2026-10-12", total: 110.67 });
  });

  it("sumele vin din cantitate × preț: 16 din 18 linii exact ca pe bon", () => {
    // Sumele adevărate de pe bon, în ordine.
    const truth = [3.49, 3.49, 3.49, 3.49, 5.67, 6.79, 3.55, 3.55, 2.79, 7.09, 12.36, 8.64, 8.64, 19.84, 2.32, 5.29, 15.27, 1.89];
    expect(r.lines).toHaveLength(18);
    expect(r.lines.filter((l, i) => l.amount === truth[i])).toHaveLength(16);
    expect(r.lines[10]).toMatchObject({ name: "MOGYI POPC SARE 80%", quantity: 4, unit: "buc", unit_price: 3.09, amount: 12.36 });
    expect(r.lines[13]).toMatchObject({ name: "Dovleac Hokkaido", quantity: 1.986, unit: "kg", amount: 19.84, check: "sigur" });
    expect(r.lines.filter((l) => l.check === "sigur").length).toBe(4);
  });

  it("nu inventează: ce nu s-a citit rămâne null și „de verificat”", () => {
    const ceapa = r.lines[14];
    expect(ceapa).toMatchObject({ quantity: 1.014, unit: "kg", unit_price: null, amount: null, check: "de_verificat" });
    // Suma din dreapta nu se potrivește cu 3 × 5,08: linia nu e sigură.
    expect(r.lines[16]).toMatchObject({ amount: 15.24, printed_amount: 15.27, check: "de_verificat" });
    // O reducere necitită face linia „de verificat” și totalul neconfirmat.
    expect(r.lines[0]).toMatchObject({ discount: null, check: "de_verificat" });
    expect(r.total_matches).toBe(false);
  });
});

describe("bon cu cântar, totul pe un rând (OCR real)", () => {
  const r = parseReceipt(fixture("2-east-trading"));

  it("cele 3 produse la kg, cu suma de după „=” și reducerea citită fără virgulă", () => {
    expect(r).toMatchObject({ chain: null, store_name: "EAST TRADING HOUSE S.R.L", date: "2026-10-12", total: null });
    expect(r.lines.map((l) => [l.quantity, l.unit, l.amount, l.discount])).toEqual([
      [0.185, "kg", 12.77, 2.55],
      [0.133, "kg", 9.92, 0],
      [0.115, "kg", 9.09, 0],
    ]);
    expect(r.lines_total).toBe(29.23);
    // „255” fără virgulă e o presupunere, iar la primele două cantitate × preț nu dă suma
    // (0,133 × 64 ≠ 9,92: OCR-ul a greșit cântărirea). Doar 0,115 × 79 = 9,09 e sigur.
    expect(r.lines.map((l) => l.check)).toEqual(["de_verificat", "de_verificat", "sigur"]);
  });
});

describe("bon Lidl pe hârtie ștearsă (OCR real)", () => {
  const r = parseReceipt(fixture("1-lidl"));

  it("recunoaște magazinul, dar liniile rămân de verificat", () => {
    expect(r.chain).toBe("lidl");
    expect(r.lines.length).toBeGreaterThanOrEqual(10);
    expect(r.lines.every((l) => l.check === "de_verificat")).toBe(true);
    expect(r.lines[0]).toMatchObject({ name: "laurt In StII grecesc", amount: 11.19 });
    // Cantitate necitită („LO0O BUC”): fără sumă, nu presupunem 1 bucată.
    expect(r.lines[1]).toMatchObject({ quantity: null, unit_price: 14.99, amount: null });
  });
});

describe("același bon Lidl, citit de Gemini (text transcris de mână după fotografie, 20 oct. 2026)", () => {
  const r = parseReceipt(fixture("4-lidl-gemini"));

  it("magazinul, data, totalul; toate liniile sigure și egale cu totalul", () => {
    expect(r).toMatchObject({ chain: "lidl", date: "2026-10-13", total: 112.22, lines_total: 112.22, total_matches: true });
    expect(r.lines.every((l) => l.check === "sigur")).toBe(true);
  });

  it("cele 11 produse, cu suma plătită după reducerile Lidl Plus", () => {
    expect(r.lines.map((l) => [l.name, roundMoney((l.amount ?? 0) - (l.discount ?? 0))])).toEqual([
      ["Iaurt in stil grecesc", 11.19],
      ["Bomboane cu lapte", 14.99],
      ["Inghetata vanilie", 14.99],
      ["Sacosa maiou", 0.81],
      ["Ecotaxa/Cost DEEE", 0.18],
      ["Unt de arahide", 24.99],
      ["Seminte de dovleac natur", 0],
      ["Ciocolata neagra 85%", 12.49],
      ["Cuvertura de cacao", 12.99],
      ["Cheescake caramel sarat", 12.99],
      ["Bautura portocale", 6.6],
    ]);
  });
});

describe("formate, pe text curat", () => {
  it("totul pe un rând, cu cântărirea care se potrivește: sigur", () => {
    const r = parseReceipt(`MIEZ DE NUCA 0.155 KG X 64.00= 9.92 B
TOTAL LEI 9.92`);
    expect(r.lines).toMatchObject([{ name: "MIEZ DE NUCA", quantity: 0.155, unit_price: 64, amount: 9.92, check: "sigur" }]);
  });

  it("totalul confirmă liniile; reducerile scad", () => {
    const r = parseReceipt(`S.C. LIDL DISCOUNT S.R.L.
1,000 BUC x 4,20
Paine alba 4,20 B
2,000 BUC x 7,49
Lapte 1,5% 1L 14,98 B
Reducere Lidl Plus
DISCOUNT 2,00 B
TOTAL 17,18
DATA:13/10/2026`);
    expect(r).toMatchObject({ chain: "lidl", date: "2026-10-13", total: 17.18, lines_total: 17.18, total_matches: true });
    expect(r.lines.map((l) => [l.name, l.amount, l.discount, l.check])).toEqual([
      ["Paine alba", 4.2, 0, "sigur"],
      ["Lapte 1,5% 1L", 14.98, 2, "sigur"],
    ]);
  });

  it("o singură sumă citită greșit se corectează din total", () => {
    // 1 × 3,49 citit „3,19”, dar suma din dreapta (3,49) închide totalul.
    const r = parseReceipt(`MEGA IMAGE SRL
1,000 BUC x 3,19
Fasole 3,49 C
1,000 BUC x 2,00
Sare 2,00 C
TOTAL 5,49`);
    expect(r.lines.map((l) => l.amount)).toEqual([3.49, 2]);
    expect(r).toMatchObject({ chain: "mega-image", total_matches: true });
  });

  it("rânduri doar cu denumire și sumă; numele necitit rămâne gol și de verificat", () => {
    const r = parseReceipt(`PROFI ROM FOOD SRL
1,000 BUC x 5,00
1,000 BUC x 2,50
Ceapa verde 2,50 A
Rosii cherry 9,99 A
TOTAL 17,49`);
    expect(r.lines.map((l) => [l.name, l.amount, l.check])).toEqual([
      ["", 5, "de_verificat"],
      ["Ceapa verde", 2.5, "sigur"],
      ["Rosii cherry", 9.99, "sigur"],
    ]);
    expect(r.total_matches).toBe(true);
  });

  it("„Total 0%” din nume nu oprește citirea; după SUBTOTAL se ia TOTAL", () => {
    const r = parseReceipt(`PENNY MARKET SRL
1,000 BUC x 4,50
Iaurt Total 0% 4,50 A
SUBTOTAL 4,50
TOTAL 4,50
DATA: 31/02/2026 14/10/2026`);
    expect(r).toMatchObject({ chain: "penny", total: 4.5, total_matches: true, date: "2026-10-14" });
    expect(r.lines.map((l) => l.name)).toEqual(["Iaurt Total 0%"]);
  });

  it("fără confirmare nu e sigur: rând fără cantitate, bucăți fracționare, sumă aleasă după total", () => {
    const fara = parseReceipt(`PROFI SRL
1,000 BUC x 1,00
Paine 1,00 A
Rosii cherry 9,99 A`);
    expect(fara.lines.map((l) => l.check)).toEqual(["sigur", "de_verificat"]);
    const frac = parseReceipt(`PROFI SRL
1,500 BUC x 2,00
Ceapa 3,00 A`);
    expect(frac.lines[0]).toMatchObject({ quantity: null, amount: 3, check: "de_verificat" });
    const ales = parseReceipt(`MEGA IMAGE SRL
1,000 BUC x 3,19
Fasole 3,49 C
TOTAL 3,49`);
    expect(ales.lines[0]).toMatchObject({ amount: 3.49, check: "de_verificat" });
  });

  it("text gol sau fără bon", () => {
    expect(parseReceipt("")).toMatchObject({ chain: null, store_name: null, date: null, lines: [], total: null, total_matches: false });
    expect(parseReceipt("o poză cu o pisică").lines).toEqual([]);
  });
});

describe("lanțurile", () => {
  it("sunt id-urile magazinelor din catalog", async () => {
    const { RETAILER_SEEDS } = await import("@/data/retailers");
    const ids = new Set(RETAILER_SEEDS.map((r) => r.id));
    for (const head of ["S.C. LIDL DISCOUNT", "KAUFLAND ROMANIA", "MEGA IMAGE SRL", "PROFI ROM FOOD", "PENNY MARKET", "CARREFOUR ROMANIA", "AUCHAN ROMANIA", "SELGROS CASH", "METRO CASH", "LA DOI PASI", "ANNABELLA SRL", "DIANA SRL"]) {
      const chain = parseReceipt(head).chain;
      expect(chain && ids.has(chain), head).toBe(true);
    }
  });
});

describe("sfârșitul produselor fără TOTAL citit", () => {
  it("plata, restul și data nu devin produse; „100 BUC” fără virgulă rămâne necitit", () => {
    const r = parseReceipt(`EAST TRADING HOUSE S.R.L.
MIEZ DE NUCA 0.155 KG X 64.00= 9.92 B
100 BUC x 8,49
Seminte de dovleac 8,49 B
TOTAL LE 9.3
NUMERAR LEI 29.23
DATA: 12-10-2026 ORA: 19:57:42`);
    expect(r.lines.map((l) => l.name)).toEqual(["MIEZ DE NUCA", "Seminte de dovleac"]);
    expect(r.lines[1]).toMatchObject({ quantity: null, amount: 8.49, check: "de_verificat" });
    expect(r.total).toBeNull();
  });
});

describe("OCR din browser, pe bonul cu cântar", () => {
  it("o sumă stricată după „=” nu pierde rândul; „N NUMERAR” și „REDULERE” se recunosc", () => {
    const r = parseReceipt(`EAST TRADING HOUSE S.R.L
, MIEZ DOVLEAC CRUD 0.185 KG X 69.00= 12.7? B
7 REDULERE 20% -2.55 B
n MEL UE SPART 1/4 0.155 KG X 64.00= 9.92 B
CHINBIR CU SCORTISOARA 0.115 KG X 79.00= 9.09 A
N NUMERAR LEI 29.23
TOTAL TURA = cl |.58`);
    expect(r.lines.map((l) => [l.amount, l.discount, l.check])).toEqual([
      [12.77, 2.55, "de_verificat"],
      [9.92, 0, "sigur"],
      [9.09, 0, "sigur"],
    ]);
    expect(r.lines_total).toBe(29.23);
  });
});
