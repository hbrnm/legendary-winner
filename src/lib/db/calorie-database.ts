import Dexie, { type Table } from "dexie";
import type { CalorieEntry, CaloriePreferences, ProductNutritionLabel } from "../domain/calories";

class CalorieDatabase extends Dexie {
  entries!: Table<CalorieEntry, string>;
  preferences!: Table<CaloriePreferences, string>;
  labels!: Table<ProductNutritionLabel, [string, string]>;

  constructor() {
    super("camara-calorie-journal");
    this.version(1).stores({
      entries: "&id, [user_id+date]",
      preferences: "&user_id",
      labels: "[user_id+product_id], user_id",
    });
  }
}

let local: CalorieDatabase | undefined;

export function calorieDatabase(): CalorieDatabase {
  return local ??= new CalorieDatabase();
}

export async function clearCalorieData(userId: string) {
  const db = calorieDatabase();
  await db.transaction("rw", [db.entries, db.preferences, db.labels], async () => {
    await db.entries.where("[user_id+date]").between([userId, Dexie.minKey], [userId, Dexie.maxKey]).delete();
    await db.preferences.delete(userId);
    await db.labels.where("user_id").equals(userId).delete();
  });
}
