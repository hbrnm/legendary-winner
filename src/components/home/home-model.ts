import type { ISODate, Recipe } from "@/lib/domain/types";
import { recipesForMeal, totalMinutes, type SuggestedMeal } from "@/lib/domain/recipes";
export function quickMealSuggestions(recipes: Recipe[], today: ISODate, meal: SuggestedMeal): Recipe[] {
  const quick = recipesForMeal(recipes, meal).filter(r => !r.deleted_at && totalMinutes(r) > 0 && totalMinutes(r) <= 30).sort((a,b)=>a.id.localeCompare(b.id));
  const offset = quick.length ? Number(today.replaceAll("-", "")) % quick.length : 0;
  return [...quick.slice(offset), ...quick.slice(0,offset)].slice(0,3);
}

export function selectHomeMeal(meals: {meal:{slot:SuggestedMeal;servings:number};recipe:Recipe|undefined}[], suggestions:Recipe[], currentMeal:SuggestedMeal): {recipe:Recipe;servings:number;planned:boolean}|null {
  const planned=meals.find(entry=>entry.meal.slot===currentMeal&&entry.recipe&&!entry.recipe.deleted_at);
  if(planned?.recipe)return {recipe:planned.recipe,servings:planned.meal.servings,planned:true};
  const suggested=suggestions.find(r=>!r.deleted_at);
  return suggested?{recipe:suggested,servings:suggested.servings,planned:false}:null;
}
