// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductSearch } from "./product-search";
vi.mock("@/components/app/hooks", () => ({ useData: () => ({ index: { docs: [] }, products: new Map([["lapte", { id: "lapte", name: "Lapte", default_unit: "l" }]]), frequent: [{ id: "lapte", name: "Lapte", default_unit: "l" }] }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("reveals frequent products only while the quick-add field has focus", () => {
  const pick = vi.fn(); render(<ProductSearch onPick={pick} />);
  expect(screen.queryByRole("button", { name: "Adaugă Lapte" })).toBeNull();
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("button", { name: "Adaugă Lapte" }));
  expect(pick).toHaveBeenCalledWith({ product: { id: "lapte", name: "Lapte", default_unit: "l" }, parsed: { text: "Lapte", quantity: null, unit: null } });
});
it("quantity presets update the draft without adding, and carry into a frequent product", () => {
  const pick = vi.fn(); render(<ProductSearch onPick={pick} />);
  const input = screen.getByRole("combobox"); fireEvent.focus(input);
  fireEvent.click(screen.getByRole("button", { name: "1 kg" }));
  expect((input as HTMLInputElement).value).toBe("1 kg ");
  fireEvent.click(screen.getByRole("button", { name: "500 g" }));
  expect((input as HTMLInputElement).value).toBe("500 g ");
  expect(pick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Adaugă Lapte" }));
  expect(pick).toHaveBeenCalledWith(expect.objectContaining({ parsed: { text: "Lapte", quantity: 500, unit: "g" } }));
});
it("keeps quantity presets above the keyboard outside document flow", () => {
  vi.stubGlobal("visualViewport", { height: 300, offsetTop: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  render(<ProductSearch onPick={vi.fn()} />); fireEvent.focus(screen.getByRole("combobox"));
  const toolbar = screen.getByRole("group", { name: "Cantități rapide" }).parentElement!;
  expect(toolbar.style.position).toBe("fixed");
  expect(toolbar.style.bottom).toContain(`${window.innerHeight - 300 + 8}px`);
  expect(screen.getByRole("button", { name: "1 buc" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "1 l" })).toBeTruthy();
});
it("keeps numeric product searches available until a unit is explicitly chosen", () => {
  render(<ProductSearch onPick={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "1234567890123" } });
  expect(screen.getByRole("option").textContent).toContain("1234567890123");
});
