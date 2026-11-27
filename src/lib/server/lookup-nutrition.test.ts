import { describe, expect, it, vi } from "vitest";
import { createNutritionLookup, extractNutrition } from "./lookup-nutrition";

const code = "5949084024838";
const set = {
  per: "100g",
  preparation: "as_sold",
  nutrients: {
    "energy-kcal": { value: 324, unit: "kcal" },
    proteins: { value: 10, unit: "g" },
    carbohydrates: { value: 65.2, unit: "g" },
    fat: { value: 1.3, unit: "g" },
  },
};
const product = { code, product_name: "Fulgi de ovăz", brands: "Auchan", nutrition: { input_sets: [set] } };
const request = (code: string, token = "sample") => new Request("https://example.test/lookup-nutrition", {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: JSON.stringify({ code }),
});

describe("căutare nutrițională după cod", () => {
  it("menține baza declarată și zero explicit", () => {
    const liquid = { ...set, per: "100ml", nutrients: { ...set.nutrients, fat: { value: 0, unit: "g" } } };
    expect(extractNutrition({ ...product, nutrition: { input_sets: [liquid] } }, code)?.nutrition).toEqual({
      basis: "ml", values: { kcal: 324, protein_g: 10, carbs_g: 65.2, fat_g: 0 },
    });
  });

  it("respinge produsele cu alt cod și nu transformă porțiile, limitele sau lipsurile în valori certe", () => {
    expect(extractNutrition(product, "3017620422003")).toBeNull();
    for (const changed of [
      { ...set, per: "serving" },
      { ...set, preparation: "prepared" },
      { ...set, nutrients: { ...set.nutrients, fat: { ...set.nutrients.fat, modifier: "<" } } },
      { ...set, nutrients: { proteins: set.nutrients.proteins } },
    ]) {
      expect(extractNutrition({ ...product, nutrition: { input_sets: [changed] } }, code)?.nutrition).toBeNull();
    }
  });

  it("verifică checksumul și utilizatorul înainte de a contacta furnizorul", async () => {
    const upstream = vi.fn();
    const handler = createNutritionLookup(upstream, "test@example.test", async () => null);
    expect((await handler(request("5949084024839"))).status).toBe(400);
    expect((await handler(request(code))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("respectă cota comună înainte de a solicita produsul", async () => {
    const upstream = vi.fn().mockImplementation(async () => Response.json({ product }));
    const takeQuota = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const handler = createNutritionLookup(upstream, "test@example.test", takeQuota);
    const response = await handler(request(code, "user-a"));
    expect((await response.json()).product.nutrition.values.kcal).toBe(324);
    expect(String(upstream.mock.calls[0][0])).toContain(`/api/v3.6/product/${code}.json`);
    expect(upstream.mock.calls[0][1].headers["User-Agent"]).toContain("test@example.test");
    expect((await handler(request(code, "user-a"))).status).toBe(429);
    expect((await handler(request(code, "user-b"))).status).toBe(200);
    expect(takeQuota).toHaveBeenNthCalledWith(3, "Bearer user-b");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("deosebește produsul absent de o întrerupere a furnizorului", async () => {
    const handler = (status: number) => createNutritionLookup(async () => new Response(null, { status }), "test@example.test", async () => true);
    expect(await (await handler(404)(request(code))).json()).toEqual({ product: null });
    expect((await handler(503)(request(code))).status).toBe(502);
  });
});
