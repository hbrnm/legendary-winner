// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ManualExpense, Retailer } from "@/lib/domain/types";
import { ManualExpenseActions } from "./expenses";

const mocks = vi.hoisted(() => ({ update: vi.fn(), ctx: { householdId: "h1" } }));
vi.mock("@/lib/services/expenses", () => ({ updateExpense: mocks.update, deleteExpense: vi.fn() }));
vi.mock("@/components/app/hooks", () => ({ useAction: () => ({ run: async (action: (ctx: unknown) => Promise<unknown>) => action(mocks.ctx), busy: false }) }));
vi.mock("@/components/ui/sheet", () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer: ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const expense: ManualExpense = { id: "e1", household_id: "h1", created_at: "2026-03-01", updated_at: "2026-03-01", deleted_at: null, description: "Legume", amount: 20, category_id: "alimentatie", spent_on: "2026-03-01", place_name: "Piața veche", retailer_id: "old", source: "piata", note: "Taraba 3" };
const retailer: Retailer = { id: "new", household_id: "h1", created_at: "2026-03-01", updated_at: "2026-03-01", deleted_at: null, name: "Magazin nou", kind: "supermarket", details: null };

describe("manual expense metadata editing", () => {
  it("preserves all existing metadata when only the amount changes, including an unavailable saved retailer", async () => {
    const view = render(<ManualExpenseActions expense={expense} retailers={[retailer]} />);
    fireEvent.click(view.getByRole("button", { name: "Modifică cheltuiala Legume" }));
    expect(view.getByLabelText("Magazin / Loc").getAttribute("value")).toBe("Piața veche");
    expect((view.getByLabelText("Magazin salvat") as HTMLSelectElement).value).toBe("old");
    fireEvent.change(view.getByLabelText("Suma (lei)"), { target: { value: "25,50" } });
    fireEvent.click(view.getByRole("button", { name: "Salvează" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(mocks.ctx, "e1", { description: "Legume", amount: 25.5, category_id: "alimentatie", spent_on: "2026-03-01" }));
    // Optional metadata is untouched in the partial patch, preserving legacy null/absence and old retailer references.
  });

  it("writes edited place, retailer, source and note through the expense service", async () => {
    const view = render(<ManualExpenseActions expense={expense} retailers={[retailer]} />);
    fireEvent.click(view.getByRole("button", { name: "Modifică cheltuiala Legume" }));
    fireEvent.change(view.getByLabelText("Magazin salvat"), { target: { value: "new" } });
    fireEvent.change(view.getByLabelText("Sursa"), { target: { value: "supermarket" } });
    fireEvent.change(view.getByLabelText("Notă (opțional)"), { target: { value: "Cumpărături pentru weekend" } });
    fireEvent.click(view.getByRole("button", { name: "Salvează" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(mocks.ctx, "e1", expect.objectContaining({ place_name: "Magazin nou", retailer_id: "new", source: "supermarket", note: "Cumpărături pentru weekend" })));
  });
  it("clears the saved retailer relation when entering a different free-text place", async () => {
    const view = render(<ManualExpenseActions expense={expense} retailers={[retailer]} />);
    fireEvent.click(view.getByRole("button", { name: "Modifică cheltuiala Legume" }));
    fireEvent.change(view.getByLabelText("Magazin / Loc"), { target: { value: "Taraba din cartier" } });
    fireEvent.click(view.getByRole("button", { name: "Salvează" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(mocks.ctx, "e1", expect.objectContaining({ place_name: "Taraba din cartier", retailer_id: null })));
  });
});
