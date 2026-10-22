// Greutățile unităților din rețete, doar pentru calculul nutrițional
// (.tasks/016, etapa 4): o bucată, densitatea (g/ml) pentru lingură, linguriță,
// cană și ml, un cățel. Din porțiile cântărite USDA SR Legacy (`portion` =
// food_portion.id). Nu schimbă lista de cumpărături: acolo rămân piece_grams și
// grams_per_ml ale produsului.
export interface NutritionUnitsSeed {
  piece_g?: number;
  g_per_ml?: number;
  catel_g?: number;
  portion: number;
}

export const NUTRITION_UNITS: Record<string, NutritionUnitsSeed> = {};
