import { describe, expect, it } from "vitest";
import { expiringSoon, expiryState, frequentProducts, planConsumption } from "./pantry";
import { pantryItem, txItem } from "@/test/factories";

describe("expirare", () => {
  const today = "2026-03-10";
  it("clasifică produsele după data expirării", () => {
    expect(expiryState({ expires_on: "2026-03-09" }, today)).toBe("expirat");
    expect(expiryState({ expires_on: "2026-03-10" }, today)).toBe("expira_curand");
    expect(expiryState({ expires_on: "2026-03-13" }, today)).toBe("expira_curand");
    expect(expiryState({ expires_on: "2026-03-14" }, today)).toBe("ok");
    expect(expiryState({ expires_on: null }, today)).toBe("fara_data");
  });

  it("listează urgențele, cele mai apropiate primele", () => {
    const list = expiringSoon(
      [
        pantryItem({ id: "a", product_id: "lapte", expires_on: "2026-03-12" }),
        pantryItem({ id: "b", product_id: "iaurt", expires_on: "2026-03-08" }),
        pantryItem({ id: "c", product_id: "orez", expires_on: "2027-01-01" }),
        pantryItem({ id: "d", product_id: "smantana", expires_on: "2026-03-11", quantity: 0 }),
      ],
      today,
    );
    expect(list.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("consumul din cămară", () => {
  it("scade întâi din ce expiră primul și raportează lipsa", () => {
    const items = [
      pantryItem({ id: "nou", product_id: "lapte", quantity: 1, unit: "l", expires_on: "2026-03-20" }),
      pantryItem({ id: "vechi", product_id: "lapte", quantity: 500, unit: "ml", expires_on: "2026-03-12" }),
    ];
    const r = planConsumption(items, [
      { product_id: "lapte", quantity: 800, unit: "ml" },
      { product_id: "oua", quantity: 2, unit: "buc" },
    ]);
    expect(r.ops).toEqual([
      { item_id: "vechi", new_quantity: 0 },
      { item_id: "nou", new_quantity: 0.7 },
    ]);
    expect(r.shortfall).toEqual([{ product_id: "oua", quantity: 2, unit: "buc" }]);
  });

  it("nu coboară niciodată sub zero", () => {
    const r = planConsumption([pantryItem({ id: "x", product_id: "unt", quantity: 100, unit: "g" })], [{ product_id: "unt", quantity: 250, unit: "g" }]);
    expect(r.ops).toEqual([{ item_id: "x", new_quantity: 0 }]);
    expect(r.shortfall).toEqual([{ product_id: "unt", quantity: 150, unit: "g" }]);
  });
});

describe("produse frecvente", () => {
  it("numără cumpărările din ultimele 90 de zile", () => {
    const items = [
      txItem({ product_id: "lapte", name: "Lapte", purchased_at: "2026-03-01T10:00:00Z" }),
      txItem({ product_id: "lapte", name: "Lapte", purchased_at: "2026-03-08T10:00:00Z" }),
      txItem({ product_id: "paine", name: "Pâine", purchased_at: "2026-03-08T10:00:00Z" }),
      txItem({ product_id: "lapte", name: "Lapte", purchased_at: "2025-10-01T10:00:00Z" }),
    ];
    expect(frequentProducts(items, "2026-03-10")).toEqual([{ product_id: "lapte", name: "Lapte", count: 2, last_bought: "2026-03-08" }]);
  });
});
