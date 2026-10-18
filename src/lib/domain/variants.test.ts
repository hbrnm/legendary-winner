import { describe, expect, it } from "vitest";
import { buildPriceIndex, estimateCost, latestUnitPrice } from "./pricing";
import { basePrice, compareVariants, variantLabel, variantsOf } from "./variants";
import { convertWithVariant } from "./units";
import { lineEstimate } from "./shopping";
import { listItem, price, variant } from "@/test/factories";

const TODAY = "2026-10-18";
const sissi = variant({ id: "sissi", product_id: "sunca", brand_id: "b-sissi", name: "Șuncă de pui", net_quantity: 300, net_unit: "g" });
const pikok = variant({ id: "pikok", product_id: "sunca", name: "Șuncă presată", net_quantity: 0.5, net_unit: "kg" });
const fara = variant({ id: "fara", product_id: "sunca", name: "Șuncă feliată" });
const variants = new Map([sissi, pikok, fara].map((v) => [v.id, v]));

describe("conversia pe ambalaj", () => {
  it("pachet ↔ grame prin conținutul net", () => {
    expect(convertWithVariant(2, "pachet", "g", { from_variant: sissi })).toBe(600);
    expect(convertWithVariant(600, "g", "pachet", { to_variant: sissi })).toBe(2);
    expect(convertWithVariant(1, "buc", "kg", { from_variant: pikok })).toBe(0.5);
    // Un pachet de 500 g înseamnă 5/3 pachete de 300 g.
    expect(convertWithVariant(1, "pachet", "pachet", { from_variant: pikok, to_variant: sissi })).toBeCloseTo(5 / 3);
  });

  it("fără gramaj nu se ghicește; pachetul rămâne pachet", () => {
    expect(convertWithVariant(1, "pachet", "g", { from_variant: fara })).toBeNull();
    expect(convertWithVariant(1, "pachet", "g")).toBeNull();
    expect(convertWithVariant(3, "pachet", "pachet", { from_variant: sissi })).toBe(3);
    // Cu greutatea pe bucată a produsului, 1 buc de la o variantă rămâne 1 buc.
    expect(convertWithVariant(1, "buc", "buc", { from_variant: sissi, units: { piece_grams: 50 } })).toBe(1);
  });

  it("varianta ștearsă nu mai dă gramajul", () => {
    expect(convertWithVariant(1, "pachet", "g", { from_variant: { ...sissi, deleted_at: "2026-10-01T00:00:00Z" } })).toBeNull();
  });
});

describe("prețul pe kg", () => {
  it("21 lei pe un pachet Sissi de 300 g → 70 lei/kg", () => {
    const bp = basePrice(price({ product_id: "sunca", variant_id: "sissi", amount: 21, quantity: 1, unit: "pachet" }), sissi);
    expect(bp?.unit).toBe("kg");
    expect(bp?.per).toBeCloseTo(70);
  });

  it("prețul deja în grame se folosește direct; lichidele pe litru", () => {
    expect(basePrice(price({ product_id: "sunca", amount: 4, quantity: 100, unit: "g" }), null)?.per).toBeCloseTo(40);
    const lapte = variant({ id: "zuzu", product_id: "lapte", name: "Lapte 1,5%", net_quantity: 1, net_unit: "l" });
    expect(basePrice(price({ product_id: "lapte", amount: 9, quantity: 2, unit: "sticla" }), lapte)).toEqual({ per: 4.5, unit: "l" });
  });

  it("pachet fără gramaj: fără preț pe kg", () => {
    expect(basePrice(price({ product_id: "sunca", amount: 10, quantity: 1, unit: "pachet" }), fara)).toBeNull();
  });
});

describe("comparația pe mărci", () => {
  const idx = buildPriceIndex(
    [
      price({ id: "s-vechi", product_id: "sunca", variant_id: "sissi", amount: 24, quantity: 1, unit: "pachet", observed_on: "2026-05-01" }),
      price({ id: "s-nou", product_id: "sunca", variant_id: "sissi", amount: 21, quantity: 1, unit: "pachet", observed_on: "2026-10-10" }),
      price({ id: "s-promo", product_id: "sunca", variant_id: "sissi", amount: 15, quantity: 1, unit: "pachet", price_type: "promotie", observed_on: "2026-10-15" }),
      price({ id: "p", product_id: "sunca", variant_id: "pikok", amount: 30, quantity: 1, unit: "pachet", observed_on: "2026-10-01" }),
      price({ id: "f", product_id: "sunca", variant_id: "fara", amount: 10, quantity: 1, unit: "pachet", observed_on: "2026-10-01" }),
      price({ id: "g", product_id: "sunca", amount: 55, quantity: 1, unit: "kg", observed_on: "2026-06-01" }),
    ],
    undefined,
    variants,
  );

  it("cel mai ieftin pe kg primul, cu prețul obișnuit cel mai recent", () => {
    const rows = compareVariants(idx, "sunca", TODAY);
    expect(rows.map((r) => [r.variant_id, r.price_id])).toEqual([
      [null, "g"],
      ["pikok", "p"],
      ["sissi", "s-nou"],
    ]);
    expect(rows[1].per).toBeCloseTo(60);
    expect(rows[2]).toMatchObject({ promo: false, stale: false });
    expect(rows[0].stale).toBe(true);
  });

  it("varianta ștearsă nu apare", () => {
    const sterse = new Map([["sissi", { ...sissi, deleted_at: "2026-10-01T00:00:00Z" }]]);
    const i2 = buildPriceIndex([price({ product_id: "sunca", variant_id: "sissi", amount: 21, quantity: 1, unit: "pachet" })], undefined, sterse);
    expect(compareVariants(i2, "sunca")).toEqual([]);
  });

  it("promoția doar când varianta nu are alt preț", () => {
    const only = buildPriceIndex([price({ id: "x", product_id: "sunca", variant_id: "sissi", amount: 15, quantity: 1, unit: "pachet", price_type: "promotie" })], undefined, variants);
    expect(compareVariants(only, "sunca")).toMatchObject([{ variant_id: "sissi", promo: true, per: 50 }]);
  });
});

describe("estimarea cu variantă", () => {
  const idx = buildPriceIndex(
    [
      price({ id: "sissi", product_id: "sunca", variant_id: "sissi", amount: 21, quantity: 1, unit: "pachet", observed_on: "2026-09-01" }),
      price({ id: "generic", product_id: "sunca", amount: 50, quantity: 1, unit: "kg", observed_on: "2026-10-10" }),
    ],
    undefined,
    variants,
  );

  it("linia cu varianta ia prețul variantei, chiar dacă e mai vechi", () => {
    expect(estimateCost(idx, "sunca", 1, "pachet", { variant_id: "sissi" })).toMatchObject({ cost: 21, price: { price_id: "sissi", variant_id: "sissi" } });
    // 600 g de Sissi: 2 pachete.
    expect(estimateCost(idx, "sunca", 600, "g", { variant_id: "sissi" })?.cost).toBe(42);
  });

  it("variantă fără preț: prețul produsului, convertit prin ambalaj", () => {
    expect(estimateCost(idx, "sunca", 1, "pachet", { variant_id: "pikok" })).toMatchObject({ cost: 25, price: { price_id: "generic" } });
  });

  it("linia fără variantă folosește toate prețurile, ca înainte", () => {
    expect(latestUnitPrice(idx, "sunca", "kg")?.price_id).toBe("generic");
    expect(estimateCost(idx, "sunca", 1, "pachet")).toMatchObject({ cost: 21, price: { price_id: "sissi" } });
  });

  it("linia din listă trimite varianta la estimare", () => {
    const item = listItem({ product_id: "sunca", quantity: 1, unit: "pachet", variant_id: "sissi" });
    expect(lineEstimate(item, idx)).toMatchObject({ amount: 21, kind: "calculat" });
  });
});

describe("afișarea", () => {
  it("eticheta și lista variantelor", () => {
    expect(variantLabel(sissi, "Sissi")).toBe("Sissi, Șuncă de pui, 300 g");
    expect(variantLabel(fara)).toBe("Șuncă feliată");
    const sters = variant({ id: "x", product_id: "sunca", name: "Ștearsă", deleted_at: "2026-10-01T00:00:00Z" });
    expect(variantsOf([sissi, pikok, sters, variant({ id: "y", product_id: "alt", name: "Alt" })], "sunca").map((v) => v.id)).toEqual(["sissi", "pikok"]);
  });
});
