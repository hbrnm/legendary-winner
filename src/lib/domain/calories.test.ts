import { describe, expect, it } from "vitest";
import {
  energySummary,
  entryEnergy,
  entryIncomplete,
  entryNutrition,
  foodUnitsFor,
  macrosSummary,
  type CalorieEntry,
  type FoodCalorieSnapshot,
} from "./calories";

const baseRecipe = {
  name: "Omletă cu spanac",
  per_serving: { kcal: 365, protein_g: 22, carbs_g: 4, fat_g: 28 },
  source: "declared" as const,
  incomplete: false,
};

const baseFood: FoodCalorieSnapshot = {
  name: "Ouă",
  per_100: { kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
  basis: "g",
  piece_grams: 55,
  grams_per_ml: null,
  quantity: 2,
  unit: "buc",
  source: "CIQUAL",
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

  it("calculează energia și macronutrienții pentru alimente în g, ml și bucăți", () => {
    expect(foodUnitsFor(baseFood)).toEqual(["g", "buc"]);
    expect(foodUnitsFor({ basis: "ml", piece_grams: null, grams_per_ml: 1.03 })).toEqual(["ml", "g"]);

    const eggEntry = entry({ recipe: null, food: baseFood });
    expect(entryEnergy(eggEntry)).toBeCloseTo(157.3);
    expect(entryNutrition(eggEntry)?.protein_g).toBeCloseTo(13.86);
    expect(entryIncomplete(eggEntry)).toBe(false);

    const unknownFood = entry({ recipe: null, food: { ...baseFood, per_100: null } });
    expect(entryEnergy(unknownFood)).toBeNull();
    expect(entryIncomplete(unknownFood)).toBe(true);
  });

  it("calculează rezumatul zilnic de macronutrienți fără a inventa valori pentru intrările manuale", () => {
    expect(macrosSummary([])).toBeNull();
    expect(macrosSummary([entry({ recipe: null, manual_kcal: 200 })])).toBeNull();
    expect(macrosSummary([
      entry({ servings: 0.5 }),
      entry({ id: "e2", recipe: null, food: baseFood }),
      entry({ id: "e3", recipe: null, manual_kcal: 100 }),
    ])).toBe("P 24,9 g · G 2,8 g · L 24,5 g");
  });
});
