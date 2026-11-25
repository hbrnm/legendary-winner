// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import Page from "./page";

const actions = vi.hoisted(() => ({
  removeMany: vi.fn((_ctx: object, _ids: string[]) => Promise.resolve()),
  restoreMany: vi.fn((_ctx: object, _ids: string[]) => Promise.resolve()),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/components/app/shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/app/hooks", () => ({
  useData: () => ({
    items: [
      { id: "item-1", name: "Lapte", quantity: 1, unit: "l", location_id: "frigider", product_id: null },
      { id: "item-2", name: "Oua", quantity: 6, unit: "buc", location_id: "frigider", product_id: null },
      { id: "item-empty-1", name: "Făină", quantity: 0, unit: "kg", location_id: "camara", product_id: null },
      { id: "item-empty-2", name: "Zahăr", quantity: 0, unit: "kg", location_id: "camara", product_id: null },
    ],
    locations: [
      { id: "frigider", name: "Frigider", sort_order: 1 },
      { id: "camara", name: "Cămară", sort_order: 2 },
    ],
    soon: [],
    useSoon: [],
    lists: [{ id: "list-1", name: "Săptămână" }],
  }),
  useAction: () => ({ run: async (fn: (ctx: object) => unknown) => fn({}), busy: false }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) =>
    open ? <section aria-label={title}>{children}{footer}</section> : null,
  ConfirmSheet: ({ open, onConfirm, confirmLabel }: { open: boolean; onConfirm: () => void; confirmLabel: string }) =>
    open ? <button type="button" onClick={onConfirm}>{confirmLabel}</button> : null,
}));
vi.mock("@/components/shopping/product-search", () => ({ ProductSearch: () => null }));
vi.mock("@/lib/services/pantry-exceptions", () => ({ finishPantryToList: vi.fn() }));
vi.mock("@/lib/services/kitchen", () => ({
  removePantryItem: vi.fn(),
  removePantryItems: (ctx: object, ids: string[]) => actions.removeMany(ctx, ids),
  restorePantryItem: vi.fn(),
  restorePantryItems: (ctx: object, ids: string[]) => actions.restoreMany(ctx, ids),
  adjustPantry: vi.fn(),
  addPantryItem: vi.fn(),
  updatePantryItem: vi.fn(),
}));
vi.mock("@/lib/services/shopping", () => ({ addItem: vi.fn(), createList: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("enables selection mode, selects items and executes bulk deletion with undo toast", async () => {
  render(<Page />);

  // Enter selection mode
  fireEvent.click(screen.getByRole("button", { name: "Selectează" }));
  expect(screen.getByText("Alege produsele de șters")).toBeTruthy();

  // Select Lapte and Oua
  fireEvent.click(screen.getByRole("checkbox", { name: "Selectează Lapte" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Selectează Oua" }));
  expect(screen.getByText("2 produse selectate")).toBeTruthy();

  // Click delete
  fireEvent.click(screen.getByRole("button", { name: "Șterge (2)" }));

  // Confirm in ConfirmSheet
  fireEvent.click(screen.getByRole("button", { name: "Șterge" }));

  await waitFor(() => {
    expect(actions.removeMany).toHaveBeenCalledWith({}, expect.arrayContaining(["item-1", "item-2"]));
  });

  expect(toast).toHaveBeenCalledWith("Am scos 2 produse din cămară.", expect.objectContaining({
    action: expect.objectContaining({ label: "Anulează" }),
  }));
});

it("cleans up all empty products in bulk via dedicated button", async () => {
  render(<Page />);

  // Click quick cleanup of 0-quantity items
  fireEvent.click(screen.getByRole("button", { name: "Arată produsele terminate (2)" }));
  const cleanButton = screen.getByRole("button", { name: "Curăță produsele terminate (2)" });
  fireEvent.click(cleanButton);

  // Confirm in ConfirmSheet
  fireEvent.click(screen.getByRole("button", { name: "Șterge" }));

  await waitFor(() => {
    expect(actions.removeMany).toHaveBeenCalledWith({}, ["item-empty-1", "item-empty-2"]);
  });

  expect(toast).toHaveBeenCalledWith("Am scos 2 produse din cămară.", expect.any(Object));
});
