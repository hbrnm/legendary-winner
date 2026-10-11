import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

describe("adăugare rapidă", () => {
  it.each([
    ["2 kg roșii", { text: "roșii", quantity: 2, unit: "kg" }],
    ["roșii 2kg", { text: "roșii", quantity: 2, unit: "kg" }],
    ["1,5 kg cartofi albi", { text: "cartofi albi", quantity: 1.5, unit: "kg" }],
    ["6 ouă", { text: "ouă", quantity: 6, unit: null }],
    ["lapte 2 l", { text: "lapte", quantity: 2, unit: "l" }],
    ["500g telemea", { text: "telemea", quantity: 500, unit: "g" }],
    ["2 legături mărar", { text: "mărar", quantity: 2, unit: "legatura" }],
    ["pâine", { text: "pâine", quantity: null, unit: null }],
    ["  ", { text: "", quantity: null, unit: null }],
  ])("%s", (input, expected) => {
    expect(parseQuickAdd(input)).toEqual(expected);
  });

  it("nu transformă un număr singur în produs", () => {
    expect(parseQuickAdd("2")).toEqual({ text: "2", quantity: null, unit: null });
  });
});
