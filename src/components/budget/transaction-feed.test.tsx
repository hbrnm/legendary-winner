// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { manualExpenseRecord } from "@/lib/domain/budget";
import { txItem } from "@/test/factories";
import type { ManualExpense } from "@/lib/domain/types";
import { TransactionFeed } from "./transaction-feed";

vi.mock("@/components/app/hooks", () => ({ useAction: () => ({ run: vi.fn(), busy: false }) }));
afterEach(cleanup);
const expense: ManualExpense = { id: "rent", household_id: "h1", created_at: "2026-11-01", updated_at: "2026-11-01", deleted_at: null, description: "Chirie", amount: 800, category_id: "locuinta", spent_on: "2026-11-01", place_name: "Acasă" };
const records = [manualExpenseRecord(expense), txItem({ id: "r1", transaction_id: "receipt1", name: "Mere", amount: 9, purchased_at: "2026-11-02T12:00:00" }), txItem({ id: "pending", transaction_id: "in-curs:list1", amount: null, purchased_at: "2026-11-03T12:00:00" })];

describe("budget transaction feed", () => {
  it("filters grouped receipts and manual payments while retaining pending list links", () => {
    const view = render(<TransactionFeed month="2026-11-01" records={records} transactions={[]} expenses={[expense]} retailers={[]} />);
    expect(view.getByText("Chirie")).toBeTruthy();
    expect(view.getByRole("link", { name: /Cumpărături în curs/ }).getAttribute("href")).toMatch(/^\/cumparaturi\/lista\/?\?id=list1$/);
    fireEvent.click(view.getByRole("radio", { name: "Bonuri" }));
    expect(view.queryByText("Chirie")).toBeNull();
    expect(view.getByText("Cumpărături în curs")).toBeTruthy();
    fireEvent.click(view.getByRole("radio", { name: "Manuale" }));
    expect(view.queryByText("Cumpărături în curs")).toBeNull();
    expect(view.getByRole("button", { name: "Modifică cheltuiala Chirie" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Șterge cheltuiala Chirie" })).toBeTruthy();
    expect(view.getByRole("link", { name: /Istoricul cumpărăturilor/ }).getAttribute("href")).toMatch(/^\/cumparaturi\/istoric\/?$/);
  });
});
