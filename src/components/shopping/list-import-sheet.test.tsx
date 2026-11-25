// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseImportedListLines } from "./list-import-sheet";

describe("parseImportedListLines", () => {
  it("extrage produse pe rânduri și elimină marcajele de listă", () => {
    expect(parseImportedListLines("- 2 kg cartofi\n• lapte 2 l\n1. 10 ouă\n[ ] pâine")).toEqual([
      { text: "cartofi", quantity: 2, unit: "kg" },
      { text: "lapte", quantity: 2, unit: "l" },
      { text: "ouă", quantity: 10, unit: null },
      { text: "pâine", quantity: null, unit: null },
    ]);
  });

  it("păstrează virgula zecimală și separă produsele despărțite prin virgulă", () => {
    expect(parseImportedListLines("1,5 kg roșii, telemea 300 g; mărar")).toEqual([
      { text: "roșii", quantity: 1.5, unit: "kg" },
      { text: "telemea", quantity: 300, unit: "g" },
      { text: "mărar", quantity: null, unit: null },
    ]);
  });

  it("ignoră liniile goale și marcajele fără text", () => {
    expect(parseImportedListLines("\n  -  \n•\n   ")).toEqual([]);
  });
});
