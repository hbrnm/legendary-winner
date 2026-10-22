// Greutățile unităților din rețete, doar pentru calculul nutrițional
// (.tasks/016, etapa 4): o bucată, densitatea (g/ml) pentru lingură, linguriță,
// cană și ml, un cățel. Din porțiile cântărite USDA SR Legacy (`portions` =
// food_portion.id). Nu schimbă lista de cumpărături: acolo rămân piece_grams și
// grams_per_ml ale produsului.
export interface NutritionUnitsSeed {
  piece_g?: number;
  g_per_ml?: number;
  catel_g?: number;
  /** food_portion.id din USDA, câte unul pentru fiecare greutate. */
  portions: number[];
}

export const NUTRITION_UNITS: Record<string, NutritionUnitsSeed> = {
  "amidon": { g_per_ml: 0.541, portions: [85370] }, // Cornstarch, 1 cup = 128 g
  "ardei-iute-uscat": { g_per_ml: 0.358, portions: [87565] }, // Spices, pepper, red or cayenne, 1 tbsp = 5.3 g (aproape)
  "avocado": { piece_g: 136, portions: [89229] }, // Avocados, raw, California, 1 fruit, without skin and seed = 136 g
  "bicarbonat": { g_per_ml: 0.933, portions: [95484] }, // Leavening agents, baking soda, 1 tsp = 4.6 g
  "boia-afumata": { g_per_ml: 0.46, portions: [88448] }, // Spices, paprika, 1 tbsp = 6.8 g (aproape)
  "boia-dulce": { g_per_ml: 0.46, portions: [88448] }, // Spices, paprika, 1 tbsp = 6.8 g
  "boia-iute": { g_per_ml: 0.358, portions: [87565] }, // Spices, pepper, red or cayenne, 1 tbsp = 5.3 g
  "bulion": { g_per_ml: 1.057, portions: [86700] }, // Tomato products, canned, puree, without salt added, 1 cup = 250 g
  "cacao": { g_per_ml: 0.365, portions: [85187] }, // Cocoa, dry powder, unsweetened, 1 tbsp = 5.4 g
  "capere": { g_per_ml: 0.582, portions: [90139] }, // Capers, canned, 1 tbsp, drained = 8.6 g
  "castraveti-murati": { piece_g: 65, portions: [84745] }, // Pickles, cucumber, sour, 1 medium (3-3/4″ long) = 65 g
  "ceapa-verde": { piece_g: 15, portions: [85881] }, // Onions, spring or scallions (includes tops and bulb), raw, 1 medium (4-1/8″ long) = 15 g
  "chifle": { piece_g: 43, portions: [91408] }, // Rolls, dinner, plain, commercially prepared (includes brown-and-serve), 1 roll (hamburger, frankfurter, onion roll, bun, large roll) = 43 g (aproape)
  "chimen": { g_per_ml: 0.406, portions: [87545] }, // Spices, cumin seed, 1 tbsp, whole = 6 g
  "cimbru-uscat": { g_per_ml: 0.183, portions: [87579] }, // Spices, thyme, dried, 1 tbsp, leaves = 2.7 g
  "conopida": { piece_g: 588, portions: [85821] }, // Cauliflower, raw, 1 head medium (5-6″ dia.) = 588 g
  "crema-branza": { g_per_ml: 0.981, portions: [92481] }, // Cheese, cream, 1 tbsp = 14.5 g
  "crenvursti": { piece_g: 50, portions: [89107] }, // Frankfurter, meat and poultry, cooked, boiled, 1 frankfurter = 50 g
  "cub-supa": { piece_g: 3.6, portions: [88991] }, // Soup, beef broth, cubed, dry, 1 cube = 3.6 g
  "curry": { g_per_ml: 0.426, portions: [87547] }, // Spices, curry powder, 1 tbsp = 6.3 g
  "dulceata": { g_per_ml: 1.353, portions: [85267] }, // Jams and preserves, 1 tbsp = 20 g
  "fulgi-ovaz": { g_per_ml: 0.659, portions: [85379] }, // Oats (Includes foods for USDA's Food Distribution Program), 1 cup = 156 g
  "hrean-borcan": { g_per_ml: 1.014, portions: [92607] }, // Horseradish, prepared, 1 tbsp = 15 g
  "iaurt-natural": { piece_g: 170, portions: [88362] }, // Yogurt, plain, whole milk, 1 container (6 oz) = 170 g (aproape)
  "ketchup": { g_per_ml: 1.15, portions: [83301] }, // Catsup, 1 tbsp = 17 g
  "lamai": { piece_g: 58, portions: [81883] }, // Lemons, raw, without peel, 1 fruit (2-1/8″ dia) = 58 g (aproape)
  "lapte-integral": { g_per_ml: 1.014, portions: [90102] }, // Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D, 1 tbsp = 15 g
  "lime": { piece_g: 67, portions: [82570] }, // Limes, raw, 1 fruit (2″ dia) = 67 g
  "lipie": { piece_g: 60, portions: [95146] }, // Bread, pita, white, enriched, 1 pita, large (6-1/2″ dia) = 60 g (aproape)
  "maioneza": { g_per_ml: 0.933, portions: [87758] }, // Salad dressing, mayonnaise, regular, 1 tbsp = 13.8 g
  "masline": { piece_g: 2.7, portions: [84226] }, // Olives, pickled, canned or bottled, green, 1 olive = 2.7 g
  "miere": { g_per_ml: 1.42, portions: [85265] }, // Honey, 1 tbsp = 21 g
  "mustar": { g_per_ml: 1.014, portions: [90130] }, // Mustard, prepared, yellow, 1 tsp or 1 packet = 5 g
  "oregano": { g_per_ml: 0.203, portions: [88445] }, // Spices, oregano, dried, 1 tsp, leaves = 1 g
  "otet": { g_per_ml: 1.008, portions: [90136] }, // Vinegar, distilled, 1 tbsp = 14.9 g
  "otet-mere": { g_per_ml: 1.008, portions: [92598] }, // Vinegar, cider, 1 tbsp = 14.9 g
  "oua": { piece_g: 50, portions: [88374] }, // Egg, whole, raw, fresh, 1 large = 50 g
  "oua-tara": { piece_g: 50, portions: [88374] }, // Egg, whole, raw, fresh, 1 large = 50 g
  "pasta-tomate": { g_per_ml: 1.082, portions: [86698] }, // Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program), 1 tbsp = 16 g
  "patrunjel-verde": { g_per_ml: 0.257, portions: [86608] }, // Parsley, fresh, 1 tbsp = 3.8 g
  "pesmet": { g_per_ml: 0.507, portions: [91444] }, // Bread, crumbs, dry, grated, seasoned, 1 cup = 120 g (aproape)
  "piper-boabe": { g_per_ml: 0.588, portions: [87562] }, // Spices, pepper, black, 1 tsp, whole = 2.9 g
  "praz": { piece_g: 89, portions: [84504] }, // Leeks, (bulb and lower leaf-portion), raw, 1 leek = 89 g
  "pui-intreg": { piece_g: 1046, portions: [87844] }, // Chicken, broilers or fryers, meat and skin and giblets and neck, raw, 1 chicken = 1046 g (aproape)
  "salata-verde": { piece_g: 163, portions: [83078] }, // Lettuce, butterhead (includes boston and bibb types), raw, 1 head (5″ dia) = 163 g
  "sare": { g_per_ml: 1.217, portions: [92595] }, // Salt, table, 1 tbsp = 18 g
  "scortisoara": { g_per_ml: 0.527, portions: [88430] }, // Spices, cinnamon, ground, 1 tbsp = 7.8 g
  "seminte-dovleac": { g_per_ml: 0.545, portions: [86847] }, // Seeds, pumpkin and squash seed kernels, dried, 1 cup = 129 g
  "smantana": { g_per_ml: 0.812, portions: [88296] }, // Cream, sour, cultured, 1 tbsp = 12 g
  "smantana-dulce": { g_per_ml: 1.014, portions: [87434] }, // Cream, fluid, heavy whipping, 1 tbsp = 15 g
  "smantana-gatit": { g_per_ml: 1.014, portions: [87426] }, // Cream, fluid, light (coffee cream or table cream), 1 tbsp = 15 g (aproape)
  "sos-soia": { g_per_ml: 1.082, portions: [94068] }, // Soy sauce made from soy and wheat (shoyu), 1 tbsp = 16 g
  "susan": { g_per_ml: 0.609, portions: [86136] }, // Seeds, sesame seeds, whole, dried, 1 tbsp = 9 g
  "ulei-floarea-soarelui": { g_per_ml: 0.92, portions: [87780] }, // Oil, sunflower, linoleic (less than 60%), 1 tbsp = 13.6 g
  "ulei-masline": { g_per_ml: 0.913, portions: [88667] }, // Oil, olive, salad or cooking, 1 tablespoon = 13.5 g
  "usturoi": { catel_g: 3, portions: [84480] }, // Garlic, raw, 1 clove = 3 g
  "varza-alba": { piece_g: 908, portions: [85795] }, // Cabbage, raw, 1 head, medium (about 5-3/4″ dia) = 908 g
  "vin-alb": { g_per_ml: 0.994, portions: [94976] }, // Alcoholic beverage, wine, table, white, 1 fl oz = 29.4 g
  "vin-rosu": { g_per_ml: 0.994, portions: [92066] }, // Alcoholic beverage, wine, table, red, 1 fl oz = 29.4 g
  "zahar-pudra": { g_per_ml: 0.541, portions: [85292] }, // Sugars, powdered, 1 tbsp unsifted = 8 g
};

// Fără porție potrivită în USDA (rămân la „Fără: …”):
// paine-alba (buc: USDA are doar felia), marar (volum: doar cana de crenguțe), broccoli (buc: doar tulpina),
// baghete (buc), dafin (buc), dorada (buc), dovleac (buc), esenta-vanilie (buc), iaurt-grecesc (volum), smantana (buc), telina-apio (buc), varza-murata-frunze (buc)
