import { describe, expect, it } from "vitest";
import { recipe } from "@/test/factories";
import { quickMealSuggestions } from "./home-model";
describe("sugestii compacte pentru azi", () => {
  it("propune cel mult trei rețete rapide, fără rețete șterse sau fără timp cunoscut", () => {
    const recipes = [recipe({id:"a",prep_minutes:10,cook_minutes:0}),recipe({id:"b",prep_minutes:40,cook_minutes:0}),recipe({id:"c",prep_minutes:0,cook_minutes:0}),recipe({id:"d",prep_minutes:10,cook_minutes:0,deleted_at:"2026-11-16"})];
    expect(quickMealSuggestions(recipes,"2026-11-16","cina").map(r=>r.id)).toEqual(["a"]);
  });
  it("rotește determinist sugestiile fără a modifica lista originală", () => {
    const recipes = ["c","b","d","a"].map(id=>recipe({id,prep_minutes:20,cook_minutes:10}));
    const first=quickMealSuggestions(recipes,"2026-11-16","cina");
    expect(first).toHaveLength(3);
    expect(quickMealSuggestions(recipes,"2026-11-16","cina")).toEqual(first);
    expect(recipes[0].id).toBe("c");
  });
  it("selectează gustări rapide după-amiaza, fără a completa cu cină sau deserturi neetichetate", () => {
    const recipes = [
      recipe({id:"cina", categories:["cina"], prep_minutes:10, cook_minutes:0}),
      recipe({id:"gustare", categories:["gustari"], prep_minutes:10, cook_minutes:0}),
      recipe({id:"desert", categories:["deserturi"], prep_minutes:10, cook_minutes:0}),
      recipe({id:"lenta", categories:["gustari"], prep_minutes:40, cook_minutes:0}),
    ];
    expect(quickMealSuggestions(recipes,"2026-11-16","gustare").map(r=>r.id)).toEqual(["gustare"]);
    expect(quickMealSuggestions(recipes,"2026-11-16","mic_dejun")).toEqual([]);
  });
});

it('selects one current planned meal before suggestions, ignoring unavailable recipes', async () => {
 const {selectHomeMeal}=await import('./home-model');
 const breakfast=recipe({id:'breakfast'}), lunch=recipe({id:'lunch'}), suggested=recipe({id:'suggested'});
 const entries=[{meal:{id:'one',slot:'mic_dejun' as const,servings:2},recipe:breakfast},{meal:{id:'two',slot:'pranz' as const,servings:4},recipe:lunch}];
 expect(selectHomeMeal(entries,[suggested],'pranz')).toMatchObject({recipe:lunch,servings:4,planned:true});
 expect(selectHomeMeal(entries.slice(1),[suggested],'mic_dejun')).toMatchObject({recipe:lunch,slot:'pranz',planned:true});
 expect(selectHomeMeal(entries,[suggested],'cina')).toMatchObject({recipe:suggested,planned:false});
 expect(selectHomeMeal([],[],'cina')).toBeNull();
});
