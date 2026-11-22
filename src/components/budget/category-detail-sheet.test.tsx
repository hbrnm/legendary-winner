// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

afterEach(cleanup);
import { CategoryDetailSheet } from "./category-detail-sheet";
import { formatRon } from "@/lib/domain/money";
import { category, txItem } from "@/test/factories";
import type { ProductCategory, Retailer, SpendRecord } from "@/lib/domain/types";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};

const cats = new Map<string, ProductCategory>([
  ["legume", category({ id: "legume", name: "Legume", is_food: true })],
  ["curatenie", category({ id: "curatenie", name: "Produse de curățenie", is_food: false })],
]);
const retailers = new Map<string, Retailer>([
  ["lidl", { id: "lidl", household_id: null, name: "Lidl", kind: "discount", details: null, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null }],
]);

const spend: SpendRecord[] = [
  txItem({ transaction_id: "t1", name: "Cartofi", category_id: "legume", amount: 100, quantity: 2, unit: "kg", source: "piata", purchased_at: "2026-03-02T08:00:00Z" }),
  txItem({ transaction_id: "t2", name: "Roșii", category_id: "legume", amount: 30.5, retailer_id: "lidl", purchased_at: "2026-03-20T08:00:00Z" }),
  txItem({ transaction_id: "t3", name: "Ceapă", category_id: "legume", amount: null, purchased_at: "2026-03-20T09:00:00Z" }),
  txItem({ transaction_id: "t4", name: "Morcovi", category_id: "legume", amount: 999, purchased_at: "2026-02-27T08:00:00Z" }), // luna anterioară
  txItem({ transaction_id: "t5", name: "Detergent", category_id: "curatenie", amount: 50, purchased_at: "2026-03-05T08:00:00Z" }),
];

describe("CategoryDetailSheet", () => {
  it("arată totalul lunii, liniile categoriei și evoluția pe 6 luni", () => {
    const { container, getByText, queryByText } = render(
      <CategoryDetailSheet open onClose={() => {}} categoryKey="alimentatie" label="Alimentație" split="familie" month="2026-03-01" spend={spend} categories={cats} retailers={retailers} />,
    );
    // Suma conține spațiu inseparabil, deci o căutăm în textul brut, nu cu getByText.
    expect(container.textContent).toContain(formatRon(130.5));
    expect(getByText("Cartofi")).toBeTruthy();
    expect(getByText("Roșii")).toBeTruthy();
    expect(getByText("Ceapă")).toBeTruthy();
    expect(getByText("Sumă necunoscută")).toBeTruthy();
    expect(queryByText("Morcovi")).toBeNull(); // altă lună
    expect(queryByText("Detergent")).toBeNull(); // altă categorie
    // Evoluția include și luna anterioară, cu eticheta categoriei.
    const chart = container.querySelector('svg[role="img"]')?.getAttribute("aria-label") ?? "";
    expect(chart).toContain("Cheltuieli pe lună: Alimentație");
    expect(chart).toContain(formatRon(999));
    // Piața și magazinul apar la linii, cu cantitatea lizibilă.
    expect(container.textContent).toContain("2 kg");
    expect(container.textContent).toContain("Lidl");
  });

  it("pe o lună fără cheltuieli spune clar că nu e nimic", () => {
    const { getByText } = render(
      <CategoryDetailSheet open onClose={() => {}} categoryKey="alimentatie" label="Alimentație" split="familie" month="2026-04-01" spend={spend} categories={cats} retailers={retailers} />,
    );
    expect(getByText(/Nicio cheltuială în/)).toBeTruthy();
  });

  it("pe magazine, filtrează după magazin", () => {
    const { getByText, queryByText } = render(
      <CategoryDetailSheet open onClose={() => {}} categoryKey="lidl" label="Lidl" split="magazine" month="2026-03-01" spend={spend} categories={cats} retailers={retailers} />,
    );
    expect(getByText("Roșii")).toBeTruthy();
    expect(queryByText("Cartofi")).toBeNull();
  });
});