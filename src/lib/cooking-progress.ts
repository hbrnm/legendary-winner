export const COOKING_STORAGE_PREFIX = "camara-cooking:";

export function cookingProgressKey(householdId: string, userId: string, recipeId: string) {
  return COOKING_STORAGE_PREFIX + JSON.stringify([householdId, userId, recipeId]);
}

export interface CookingProgress {
  servings: number;
  stepId: string | null;
  updatedAt?: number;
}

export function readCookingProgress(key: string): CookingProgress | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      Number.isInteger(saved?.servings) && saved.servings >= 1 && saved.servings <= 50 &&
      (saved.stepId === null || typeof saved.stepId === "string")
    ) return { servings: saved.servings, stepId: saved.stepId, updatedAt: Number.isFinite(saved.updatedAt) ? saved.updatedAt : 0 };
  } catch {
    // Storage can be unavailable. Cooking still works in the open page.
  }
  return null;
}

export function writeCookingProgress(key: string, progress: CookingProgress | null) {
  try {
    if (progress) localStorage.setItem(key, JSON.stringify({ ...progress, updatedAt: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    // Keep the current session usable when the browser blocks storage.
  }
}

export function listCookingProgress(householdId: string, userId: string) {
  const prefix = COOKING_STORAGE_PREFIX + JSON.stringify([householdId, userId]).slice(0, -1) + ",";
  const sessions: { recipeId: string; progress: CookingProgress }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      let recipeId: unknown;
      try { recipeId = JSON.parse(key.slice(prefix.length, -1)); } catch { continue; }
      const progress = readCookingProgress(key);
      if (typeof recipeId === "string" && progress) sessions.push({ recipeId, progress });
    }
  } catch {
    // The home screen still works when browser storage is unavailable.
  }
  return sessions.sort((a, b) => (b.progress.updatedAt ?? 0) - (a.progress.updatedAt ?? 0));
}
