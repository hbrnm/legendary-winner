// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { CompactCategories } from "./compact-categories";
import { formatRon } from "@/lib/domain/money";

afterEach(cleanup);

describe("CompactCategories", () => {
  it("fără cheltuieli arată o stare calmă, nu categorii cu zero", () => {
    const view = render(<CompactCategories bars={[{ key: "food", label: "Alimentație", value: 0 }]} />);
    expect(view.getByText("Încă nu ai cheltuieli")).toBeTruthy();
    expect(view.queryByText("Alimentație")).toBeNull();
  });

  it("arată toate categoriile active, fără limită și fără buton de extindere; zero și Nealocat separat", () => {
    const bars = Array.from({ length: 6 }, (_, index) => ({ key: `c${index}`, label: `Categorie ${index}`, value: 60 - index }));
    const view = render(<CompactCategories bars={[...bars, { key: "nealocat", label: "Nealocat", value: -10 }, { key: "zero", label: "Fără cheltuieli", value: 0 }]} />);
    // Toate cele 6 categorii + Nealocat, fără „Vezi toate categoriile".
    expect(view.container.querySelectorAll("li")).toHaveLength(7);
    expect(view.getByText("Categorie 5")).toBeTruthy();
    expect(view.getByText("Nealocat")).toBeTruthy();
    expect(view.queryByText("Fără cheltuieli")).toBeNull();
    expect(view.queryByRole("button", { name: /Vezi toate categoriile/ })).toBeNull();
    expect(view.container.textContent).toContain(formatRon(-10));
  });

  it("cu onSelect, fiecare categorie e un buton care deschide detaliile", () => {
    const onSelect = vi.fn();
    const view = render(<CompactCategories bars={[{ key: "alimentatie", label: "Alimentație", value: 100 }, { key: "transport", label: "Transport", value: 50 }]} onSelect={onSelect} />);
    fireEvent.click(view.getByRole("button", { name: "Vezi cheltuielile din Transport" }));
    expect(onSelect).toHaveBeenCalledWith("transport");
    expect(view.getAllByRole("button")).toHaveLength(2);
  });

  it("fără onSelect, categoriile rămân text simplu", () => {
    const view = render(<CompactCategories bars={[{ key: "alimentatie", label: "Alimentație", value: 100 }]} />);
    expect(view.queryByRole("button")).toBeNull();
  });
});
