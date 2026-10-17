import { describe, expect, it } from "vitest";
import { ENGLISH_INGREDIENTS } from "./import-en";
import { PRODUCT_SEEDS } from "./products";
import { CATEGORY_SEEDS } from "./categories";

describe("dicționarul englez–român (.tasks/011)", () => {
  const food = new Set<string>(CATEGORY_SEEDS.filter((c) => c.is_food).map((c) => c.id));
  const products = new Map(PRODUCT_SEEDS.map((p) => [p.id, p]));

  it("fiecare produs există în catalog și e aliment", () => {
    const wrong = ENGLISH_INGREDIENTS.filter(([, id]) => id !== null && !food.has(products.get(id)?.category ?? ""));
    expect(wrong).toEqual([]);
  });

  it("fiecare expresie apare o singură dată", () => {
    const phrases = ENGLISH_INGREDIENTS.map(([p]) => p);
    expect(phrases.filter((p, i) => phrases.indexOf(p) !== i)).toEqual([]);
  });
});
