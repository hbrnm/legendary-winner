import type { ISODate, Recipe } from "@/lib/domain/types";
import { totalMinutes } from "@/lib/domain/recipes";
export function quickMealSuggestions(recipes: Recipe[], today: ISODate): Recipe[] {
  const quick = recipes.filter(r => !r.deleted_at && totalMinutes(r) > 0 && totalMinutes(r) <= 30).sort((a,b)=>a.id.localeCompare(b.id));
  const offset = quick.length ? Number(today.replaceAll("-", "")) % quick.length : 0;
  return [...quick.slice(offset), ...quick.slice(0,offset)].slice(0,3);
}
