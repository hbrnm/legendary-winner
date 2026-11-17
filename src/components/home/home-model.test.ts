import { describe, expect, it } from "vitest";
import { recipe } from "@/test/factories";
import { quickMealSuggestions } from "./home-model";
describe("sugestii compacte pentru azi", () => {
  it("propune cel mult trei rețete rapide, fără rețete șterse sau fără timp cunoscut", () => {
    const recipes = [recipe({id:"a",prep_minutes:10,cook_minutes:0}),recipe({id:"b",prep_minutes:40,cook_minutes:0}),recipe({id:"c",prep_minutes:0,cook_minutes:0}),recipe({id:"d",prep_minutes:10,cook_minutes:0,deleted_at:"2026-11-16"})];
    expect(quickMealSuggestions(recipes,"2026-11-16").map(r=>r.id)).toEqual(["a"]);
  });
  it("rotește determinist sugestiile fără a modifica lista originală", () => {
    const recipes = ["c","b","d","a"].map(id=>recipe({id,prep_minutes:20,cook_minutes:10}));
    const first=quickMealSuggestions(recipes,"2026-11-16");
    expect(first).toHaveLength(3);
    expect(quickMealSuggestions(recipes,"2026-11-16")).toEqual(first);
    expect(recipes[0].id).toBe("c");
  });
});
