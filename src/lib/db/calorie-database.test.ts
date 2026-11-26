import { expect, it } from "vitest";
import { calorieDatabase, clearCalorieData } from "./calorie-database";
import { CamaraDB } from "./database";

it("păstrează jurnalul după ștergerea cache-ului gospodăriei și curăță doar contul cerut", async () => {
  const db = calorieDatabase();
  const household = new CamaraDB("test-calorii-gospodarie");
  await household.open();
  try {
    for (const userId of ["journal-a", "journal-b"]) {
      await db.preferences.add({ user_id: userId });
      await db.entries.add({ id: userId, user_id: userId, date: "2026-11-26", recipe: null, servings: 1, manual_kcal: 100 });
      await db.labels.add({ user_id: userId, product_id: "produs", basis: "ml", preparation: "as_sold", values: { kcal: 100, protein_g: 2, carbs_g: 3, fat_g: 4 } });
    }

    await household.delete();
    expect(await db.entries.get("journal-a")).toMatchObject({ manual_kcal: 100 });

    await clearCalorieData("journal-a");
    expect(await db.entries.get("journal-a")).toBeUndefined();
    expect(await db.preferences.get("journal-a")).toBeUndefined();
    expect(await db.labels.get(["journal-a", "produs"])).toBeUndefined();
    expect(await db.entries.get("journal-b")).toBeDefined();
    expect(await db.preferences.get("journal-b")).toBeDefined();
    expect(await db.labels.get(["journal-b", "produs"])).toBeDefined();
  } finally {
    await db.delete();
  }
});
