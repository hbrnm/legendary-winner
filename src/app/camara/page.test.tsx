// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import Page from "./page";
const actions = vi.hoisted(() => ({ finish: vi.fn(), add: vi.fn() }));
vi.mock("@/components/app/shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/app/hooks", () => ({ useData: () => ({ items: [{ id: "stock", name: "Mere", quantity: 2, unit: "buc", location_id: "camara", product_id: null }], locations: [{ id: "camara", name: "Cămară", sort_order: 1 }], soon: [], useSoon: [], lists: [{ id: "list", name: "Săptămână" }] }), useAction: () => ({ run: async (fn: (ctx: object) => unknown) => fn({}), busy: false }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/components/ui/sheet", () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? <section aria-label={title}>{children}{footer}</section> : null }));
vi.mock("@/components/shopping/product-search", () => ({ ProductSearch: () => <input aria-label="Alege produs pentru cămară" /> }));
vi.mock("@/lib/services/pantry-exceptions", () => ({ finishPantryToList: (...args: unknown[]) => actions.finish(...args) }));
vi.mock("@/lib/services/shopping", () => ({ addItem: (...args: unknown[]) => actions.add(...args), createList: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("keeps pantry search separate from the add-product control", () => {
  render(<Page />);
  expect(screen.getByRole("textbox", { name: "Caută în cămară" })).toBeTruthy();
  expect(screen.queryByLabelText("Alege produs pentru cămară")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Adaugă în cămară" }));
  expect(screen.getByLabelText("Alege produs pentru cămară")).toBeTruthy();
});
it("offers the finish-to-list operation through an accessible row action", async () => {
  actions.finish.mockResolvedValue("list"); render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Acțiuni pentru Mere" }));
  fireEvent.click(screen.getByRole("button", { name: "S-a terminat → Pe listă" }));
  await waitFor(() => expect(actions.finish).toHaveBeenCalledWith({}, "stock"));
  expect(actions.add).not.toHaveBeenCalled();
});
it("adding an existing pantry product to shopping uses the separate stock-preserving action", async () => {
  render(<Page />); fireEvent.click(screen.getByRole("button", { name: "Acțiuni pentru Mere" }));
  fireEvent.click(screen.getByRole("button", { name: "Pune pe listă" }));
  await waitFor(() => expect(actions.add).toHaveBeenCalledWith({}, "list", { name: "Mere", category_id: "diverse" }));
  expect(actions.finish).not.toHaveBeenCalled();
});
