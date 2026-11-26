import { describe, expect, it } from "vitest";
import { parsePaddleReceipt } from "./paddle-receipt";

describe("bonuri PaddleOCR cu nume și preț pe același rând", () => {
  it("propune produsele care însumează totalul și le marchează pentru verificare", () => {
    const receipt = parsePaddleReceipt("KAUFLAND\nPâine 2,50\nLapte 5,20 C\nTOTAL 7,70");
    expect(receipt.total).toBe(7.7);
    expect(receipt.lines_total).toBe(7.7);
    expect(receipt.lines.map(({ name, amount, check }) => ({ name, amount, check }))).toEqual([
      { name: "Pâine", amount: 2.5, check: "de_verificat" },
      { name: "Lapte", amount: 5.2, check: "de_verificat" },
    ]);
  });

  it("nu propune rândurile fără un total care le confirmă", () => {
    expect(parsePaddleReceipt("KAUFLAND\nPâine 2,50\nTOTAL 3,50").lines).toEqual([]);
    expect(parsePaddleReceipt("KAUFLAND\nPâine 2,50").lines).toEqual([]);
  });
});

describe("rânduri fiscale fragmentate de PaddleOCR", () => {
  it("reconciliază 12 poziții, cantitățile și reducerea din fotografia Lidl", () => {
    const receipt = parsePaddleReceipt(`LIOL DISCOUNT
1.000BUC x.1,81 Lel
Sacosa cu plastic recic 1,81A
1,000 BUC x 0.18
Ecotaxa/Cost DEEE 0.18A
2.000 BUC x6,99
Mix salata Prestigto 13.98 B
1.000 BUC× 11,99
Tai tei instant ramen pul 11.99B
1000 BUC × 12.19
Bacon, fasil 12,19 B
1.000 BUC × 15:99
Crema de fistic 15.99A
1.000 BUC X 13,99
Parmiglano Reggiano DOP 13.99 B
4,000 BUCx 5.29
Lapte consum 3,5% 21.16 B
1.000 BUC x 11,99
Paste din filiera Puglia 11,99 B
1.000 BUC× 14,79
10 Oua L Sol 14,79B
1.000 BUC X 49 99 49.99 A
Pre-workout mango-maract
1.000BUC × 13.99 13,99 A
Ecler cu caramel sarat
REDUCERE 25% 3,50-A
DISCOUNT
178,55
SUBTOTAL
178,55
TOTAL
23.54
TOTAL TVA 13.62`);
    expect(receipt).toMatchObject({ chain: "lidl", total: 178.55, lines_total: 178.55, total_matches: true });
    expect(receipt.lines.map(line => line.amount)).toEqual([1.81, 0.18, 13.98, 11.99, 12.19, 15.99, 13.99, 21.16, 11.99, 14.79, 49.99, 13.99]);
    expect(receipt.lines[2]).toMatchObject({ quantity: 2, unit_price: 6.99 });
    expect(receipt.lines[7]).toMatchObject({ quantity: 4, unit_price: 5.29 });
    expect(receipt.lines[11]).toMatchObject({ name: "Ecler cu caramel sarat", discount: 3.5 });
  });

  it("nu transformă subtotalul, totalul și TVA-ul în articole când etichetele sunt ciuntite", () => {
    const receipt = parsePaddleReceipt("LIDL\n1,000BUC 13,99\nEcler 13,99 A\nISCOUNT 3.50-A\nJBTOTAL 10,49\nOTAL 10,49\nTOTAL TVA 1,04");
    expect(receipt).toMatchObject({ total: 10.49, lines_total: 10.49, total_matches: true });
    expect(receipt.lines).toMatchObject([{ name: "Ecler", quantity: 1, amount: 13.99, discount: 3.5 }]);
  });
});
