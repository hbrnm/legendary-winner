// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import Page from "./page";
import ListsPage from "../page";
const state = vi.hoisted(() => ({ data: {} as Record<string, unknown>, finalize: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("id=list"), useRouter: () => ({ push: state.push }) }));
vi.mock("@/components/app/shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/app/app-provider", () => ({ useApp: () => ({ variantsEnabled: false }) }));
vi.mock("@/components/app/hooks", () => ({ useData: () => state.data, useAction: () => ({ run: async (fn: (ctx: object) => unknown) => fn({}), busy: false }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/components/ui/sheet", () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? <section aria-label={title}>{children}{footer}</section> : null, ConfirmSheet: () => null }));
vi.mock("@/components/shopping/product-search", () => ({ ProductSearch: () => <input aria-label="Adaugă produs" /> }));
vi.mock("@/components/shopping/item-sheet", () => ({ ItemSheet: () => null }));
vi.mock("@/lib/services/shopping", () => ({ finalizeShopping: (...args: unknown[]) => state.finalize(...args) }));
const line = (id: string, name: string, retailer_id: string | null, checked = false) => ({ id, name, retailer_id, checked, category_id: "legume", source: "supermarket", quantity: null, unit: null, priority: "normala", actual_price: null, estimated_price: null, variant_id: null, product_id: null });
beforeEach(() => {
  state.push.mockReset(); state.finalize.mockReset();
  state.finalize.mockResolvedValue({ total: 25, added_to_pantry: 0, pending_pantry: 1 });
  state.data = { list: { id: "list", name: "Săptămână", is_recurring: false, default_retailer_id: "lidl" }, items: [line("a", "Mere", "lidl", true), line("b", "Pere", "piata")], categories: [{ id: "legume", name: "Legume", sort_order: 0 }], retailers: [{ id: "lidl", name: "Lidl" }, { id: "piata", name: "Piață" }], prices: { get: () => null }, otherLists: [], budget: null, pantrySetting: "intreaba", variants: [], variantById: new Map(), brands: new Map(), suggestions: [] };
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });
it("filters shopping by saved place without hiding checkout", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Lidl" }));
  expect(screen.queryByText("Pere")).toBeNull();
  expect(screen.getByRole("button", { name: "Am plătit" }).hasAttribute("disabled")).toBe(false);
});
it("finalizes a partial list with authoritative total and place, leaving it accessible", async () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Am plătit" }));
  fireEvent.change(screen.getByLabelText("Total plătit (lei)"), { target: { value: "25,00" } });
  fireEvent.change(screen.getByLabelText("Locul cumpărăturilor"), { target: { value: "lidl" } });
  fireEvent.click(screen.getByRole("button", { name: "Finalizează cumpărăturile" }));
  await waitFor(() => expect(state.finalize).toHaveBeenCalledWith({}, "list", { addToPantry: true, totalPaid: 25, retailerId: "lidl" }));
  expect(state.push).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toMatch(/cantitate/);
});
it("opens shared receipt capture with the current list context", () => {
  const capture = vi.fn(); window.addEventListener("camara:capture", capture);
  render(<Page />); fireEvent.click(screen.getByRole("button", { name: "Am plătit" }));
  fireEvent.click(screen.getByRole("button", { name: "Scanează bonul" }));
  expect(capture.mock.calls[0][0].detail).toEqual({ mode: "scan", listId: "list" });
  window.removeEventListener("camara:capture", capture);
});

it("has one add-list action in the empty shopping landing page and no finance shortcuts", () => {
  state.data = { lists: [], retailers: [] }; render(<ListsPage />);
  expect(screen.getAllByRole("button", { name: "Începe o listă" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Listă nouă" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Pune un bon" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Ce-ai cumpărat până acum" })).toBeNull();
});
it("opens a new shopping list from the Home query action", () => {
  window.history.replaceState({}, "", "/cumparaturi/?nou=1");
  state.data = { lists: [], retailers: [] }; render(<ListsPage />);
  expect(screen.getByRole("textbox", { name: "Numele listei" })).toBeTruthy();
});
it("imports checked food on payment regardless of the old pantry preference, with no extra toggle", async () => {
  state.data = { ...state.data, pantrySetting: "niciodata" };
  render(<Page />); fireEvent.click(screen.getByRole("button", { name: "Am plătit" }));
  expect(screen.queryByRole("switch", { name: "Pune alimentele în cămară" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Finalizează cumpărăturile" }));
  await waitFor(() => expect(state.finalize).toHaveBeenCalledWith({}, "list", { addToPantry: true, retailerId: "lidl" }));
});
it("returns from list capture to checkout with its draft total and ignores other lists", () => {
  render(<Page />);
  fireEvent(window, new CustomEvent("camara:checkout", { detail: { listId: "other" } }));
  expect(screen.queryByLabelText("Total plătit (lei)")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Am plătit" }));
  fireEvent.change(screen.getByLabelText("Total plătit (lei)"), { target: { value: "32,50" } });
  fireEvent.click(screen.getByRole("button", { name: "Scanează bonul" }));
  expect(screen.queryByLabelText("Total plătit (lei)")).toBeNull();
  fireEvent(window, new CustomEvent("camara:checkout", { detail: { listId: "list" } }));
  expect((screen.getByLabelText("Total plătit (lei)") as HTMLInputElement).value).toBe("32,50");
});
it("always offers the supermarket source and limits place chips to saved or assigned places", () => {
  state.data = { ...state.data, items: [{ ...line("b", "Pere", null), source: null }], retailers: [{ id: "global", name: "Unrelated global store", household_id: null }, { id: "obor", name: "Piața Obor", household_id: "h1", kind: "piata" }] };
  render(<Page />);
  expect(screen.queryByRole("button", { name: "Unrelated global store" })).toBeNull();
  expect(screen.getByRole("button", { name: "Piața Obor" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Supermarket" }));
  expect(screen.getByText("Pere")).toBeTruthy();
});
