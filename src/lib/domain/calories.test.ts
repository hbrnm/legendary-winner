import { describe, expect, it } from "vitest";
import { energySummary, entryEnergy, entryIncomplete, type CalorieEntry } from "./calories";

const baseRecipe = {
  name: "Omletă cu spanac",
  per_serving: { kcal: 365, protein_g: 22, carbs_g: 4, fat_g: 28 },
  source: "declared" as const,
  incomplete: false,
};

function entry(patch: Partial<CalorieEntry> = {}): CalorieEntry {
  return {
    id: "e1",
    user_id: "u1",
    date: "2026-03-08",
    recipe: baseRecipe,
    servings: 1,
    manual_kcal: null,
    ...patch,
  };
}

describe("calorii și rezumatul zilnic", () => {
  it("calculează energia pentru porții fracționare, valori manuale și rețete fără date", () => {
    expect(entryEnergy(entry({ servings: 0.5 }))).toBe(182.5);
    expect(entryEnergy(entry({ manual_kcal: 240, servings: 3 }))).toBe(240);
    expect(entryEnergy(entry({ recipe: { ...baseRecipe, per_serving: null } }))).toBeNull();
  });

  it("identifică intrările incomplete sau necunoscute", () => {
    expect(entryIncomplete(entry())).toBe(false);
    expect(entryIncomplete(entry({ recipe: { ...baseRecipe, incomplete: true } }))).toBe(true);
    expect(entryIncomplete(entry({ recipe: { ...baseRecipe, per_serving: null }, manual_kcal: 150 }))).toBe(false);
    expect(entryIncomplete(entry({ recipe: { ...baseRecipe, per_serving: null } }))).toBe(true);
  });

  it("formatează rezumatul zilnic pentru gol, necunoscut, complet și parțial", () => {
    expect(energySummary([])).toBe("0 kcal");
    expect(energySummary([entry({ recipe: { ...baseRecipe, per_serving: null } })])).toBe("Calorii necunoscute");
    expect(energySummary([entry({ servings: 0.5 }), entry({ id: "e2", recipe: null, manual_kcal: 100 })])).toBe("282,5 kcal");
    expect(energySummary([
      entry({ servings: 0.5 }),
      entry({ id: "e2", recipe: { ...baseRecipe, per_serving: null, incomplete: true } }),
    ])).toBe("182,5 kcal · Total incomplet");
  });
});
