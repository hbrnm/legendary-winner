import { describe, expect, it } from "vitest";
import { capturePlaces, sourceOfRetailer, shortcutCategory } from "./model";
import type { ManualExpense, Retailer } from "@/lib/domain/types";
const row = { household_id: "h", created_at: "2026-11-16", updated_at: "2026-11-16", deleted_at: null };
describe("locuri pentru captura rapidă", () => {
  it("aduce locurile recente înaintea celor salvate, fără dubluri și fără locuri șterse", () => {
    const retailers: Retailer[] = [{ ...row, id: "piata", name: "Piața Moghioroș", kind: "piata", details: "taraba 12" }, { ...row, id: "shop", name: "Auchan", kind: "hipermarket", details: null }];
    const expenses: ManualExpense[] = [{ ...row, id: "e", amount: 5, description: "Legume", category_id: "alimentatie", spent_on: "2026-11-16", retailer_id: "shop", place_name: "Auchan" }];
    expect(capturePlaces(retailers, expenses).map(p => p.name)).toEqual(["Auchan", "Piața Moghioroș"]);
    expect(capturePlaces(retailers, expenses)[1].source).toBe("piata");
    expect(capturePlaces([{ ...retailers[0], deleted_at: "2026-11-16" }], [])).toEqual([]);
  });
  it("păstrează locurile libere și separă sursa de categoria cheltuielii", () => {
    const expense = { ...row, id:"e", amount:9, description:"Taxi", category_id:"transport", spent_on:"2026-11-16", place_name:"Taxi local", source:"alta" } as ManualExpense;
    expect(capturePlaces([], [expense])[0]).toMatchObject({ name:"Taxi local", retailerId:null, source:"alta" });
    expect(sourceOfRetailer("producator")).toBe("producator");
    expect(shortcutCategory("supermarket")).toBe("alimentatie");
    expect(shortcutCategory("locuinta")).toBe("locuinta");
  });
});
