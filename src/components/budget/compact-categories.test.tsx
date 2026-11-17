// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { CompactCategories } from "./compact-categories";

afterEach(cleanup);
describe("compact initial category summary", () => {
  it("uses a calm empty state instead of zero-value categories", () => {
    const view = render(<CompactCategories bars={[{ key: "food", label: "Alimentație", value: 0 }]} />);
    expect(view.getByText("Încă nu ai cheltuieli")).toBeTruthy();
    expect(view.queryByText("Alimentație")).toBeNull();
  });
  it("limits the initial summary to five active categories, keeps Nealocat separate and expands the rest", () => {
    const bars = Array.from({ length: 6 }, (_, index) => ({ key: `c${index}`, label: `Categorie ${index}`, value: 60 - index }));
    const view = render(<CompactCategories bars={[...bars, { key: "nealocat", label: "Nealocat", value: -10 }, { key: "zero", label: "Fără cheltuieli", value: 0 }]} />);
    expect(view.container.querySelectorAll("dt")).toHaveLength(5);
    expect(view.getByText("Nealocat")).toBeTruthy();
    expect(view.queryByText("Fără cheltuieli")).toBeNull();
    expect(view.queryByText("Categorie 5")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Vezi toate categoriile" }));
    expect(view.container.querySelectorAll("dt")).toHaveLength(7);
    expect(view.getByText("Categorie 5")).toBeTruthy();
    expect(view.container.textContent).toContain("-10");
  });
});
