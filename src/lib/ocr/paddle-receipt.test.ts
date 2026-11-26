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
