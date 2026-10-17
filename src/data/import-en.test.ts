import { describe, expect, it } from "vitest";
import { ENGLISH_INGREDIENTS } from "./import-en";
import { PRODUCT_SEEDS } from "./products";
import { CATEGORY_SEEDS } from "./categories";
import { englishKey, phraseDictionary } from "@/lib/domain/recipe-import";

describe("dicționarul englez–român (.tasks/011)", () => {
  const food = new Set<string>(CATEGORY_SEEDS.filter((c) => c.is_food).map((c) => c.id));
  const products = new Map(PRODUCT_SEEDS.map((p) => [p.id, p]));

  it("fiecare produs există în catalog și e aliment", () => {
    const wrong = ENGLISH_INGREDIENTS.filter(([, id]) => id !== null && !food.has(products.get(id)?.category ?? ""));
    expect(wrong).toEqual([]);
  });

  it("fiecare expresie apare o singură dată (și după trecerea la singular)", () => {
    const keys = ENGLISH_INGREDIENTS.map(([p]) => englishKey(p));
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  const known = phraseDictionary(ENGLISH_INGREDIENTS);

  it.each([
    ["all-purpose flour", "faina-alba"],
    ["confectioners' sugar", "zahar-pudra"],
    ["large eggs", "oua"],
    ["ripe tomatoes", "rosii"],
    ["bay leaves", "dafin"],
    ["fresh cherries", "cirese"],
    ["peaches", "piersici"],
    ["radishes", "ridichi"],
    ["Brussels sprouts", "varza-de-bruxelles"],
    ["asparagus", "sparanghel"],
    ["jalapeño", "ardei-iute"],
    ["dill pickles", "castraveti-murati"],
    ["white wine vinegar", "otet"],
    ["green pepper", "ardei-gras"],
    ["chicken bouillon cube", "cub-supa"],
    ["honey mustard", "mustar"],
    ["sparkling water", "apa-minerala"],
    ["soy milk", "lapte-vegetal"],
  ])("%s → %s", (name, id) => {
    expect(known(name)).toBe(id);
  });

  it.each([
    "peanut butter", "almond butter", "butter beans", "coconut milk", "evaporated milk", "milk chocolate",
    "toasted sesame oil", "walnut oil", "coconut oil", "almond extract", "vanilla bean", "coconut water", "rose water",
    "orange blossom water", "garlic salt", "garlic bread", "chicken broth", "chicken noodle soup", "cream of mushroom soup",
    "oil-packed sun-dried tomatoes", "rice vinegar", "rice noodles", "corn syrup", "pepper jack", "chili sauce", "brown sugar",
  ])("%s: fără potrivire automată", (name) => {
    expect(known(name)).toBeNull();
  });
});
