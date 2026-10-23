import type { Product } from "@/lib/domain/types";
import type { ProductNutrition } from "@/lib/domain/recipes";
import { NUTRITION_SEEDS } from "./nutrition";
import { NUTRITION_UNITS } from "./nutrition-units";

/**
 * Valorile la 100 g și greutățile unităților unui produs, din catalog. Factorii
 * produsului (piece_grams, grams_per_ml) au întâietate; produsele gospodăriei
 * nu au valori (DE COMPLETAT).
 */
export function catalogNutrition(products: ReadonlyMap<string, Pick<Product, "piece_grams" | "grams_per_ml">>): (productId: string) => ProductNutrition {
  return (id) => {
    const n = NUTRITION_SEEDS[id];
    const p = products.get(id);
    const u = NUTRITION_UNITS[id];
    return {
      per_100g: n ? { kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g } : null,
      units: { piece_grams: p?.piece_grams ?? u?.piece_g ?? null, grams_per_ml: p?.grams_per_ml ?? u?.g_per_ml ?? null, catel_g: u?.catel_g ?? null },
    };
  };
}
