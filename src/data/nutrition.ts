import type { NutritionSeed } from "./seed-types";

// Valorile nutriționale la 100 g ale produselor din catalog, așa cum se cumpără
// (crude, uscate, la borcan). Sursa: CIQUAL 2025 (ANSES, Franța, Licence Ouverte,
// „Table Ciqual 2025_ENG_2025_11_03.xlsx”), iar unde CIQUAL nu are un aliment
// apropiat sau îi lipsesc valori, USDA FoodData Central SR Legacy (2018-04, domeniu
// public). `code` e alim_code (CIQUAL) sau fdc_id (USDA). Glucidele sunt cele
// asimilabile, ca pe etichetele din UE (la USDA: glucide minus fibre); „urme” și
// „< x” din CIQUAL sunt 0. „aproape:” = cel mai apropiat aliment din sursă;
// `medie` = media altor rânduri din tabel, fără cod propriu.
// Produsele fără rând nu au corespondent: DE COMPLETAT (rămân null).
export const NUTRITION_SEEDS: Record<string, NutritionSeed> = {
  "rosii": { src: "ciqual", code: 20385, kcal: 19.2, protein_g: 0.6, carbs_g: 3.69, fat_g: 0 }, // Tomato, raw (average)
  "rosii-cherry": { src: "ciqual", code: 20172, kcal: 31.8, protein_g: 1.31, carbs_g: 5.62, fat_g: 0 }, // Tomato, cherry, raw
  "castraveti": { src: "ciqual", code: 20019, kcal: 16.8, protein_g: 0.65, carbs_g: 2.87, fat_g: 0.11 }, // Cucumber, flesh and skin, raw
  "ardei-kapia": { src: "ciqual", code: 20087, kcal: 33.6, protein_g: 1.06, carbs_g: 5.98, fat_g: 0 }, // Sweet pepper, red, raw
  "cartofi-albi": { src: "ciqual", code: 4008, kcal: 80, protein_g: 2.02, carbs_g: 16.2, fat_g: 0.09 }, // Potato, peeled, raw
  "ceapa-galbena": { src: "ciqual", code: 20239, kcal: 35.9, protein_g: 1.19, carbs_g: 6.39, fat_g: 0 }, // Yellow onion, raw
  "usturoi": { src: "ciqual", code: 11000, kcal: 109, protein_g: 5.31, carbs_g: 18.6, fat_g: 0 }, // Garlic, raw
  "patrunjel-verde": { src: "ciqual", code: 11014, kcal: 42.5, protein_g: 2.97, carbs_g: 4.1, fat_g: 0.63 }, // Parsley, fresh
  "mere": { src: "ciqual", code: 13039, kcal: 54, protein_g: 0.25, carbs_g: 11.6, fat_g: 0.25 }, // Apple, flesh and skin, raw
  "banane": { src: "ciqual", code: 13005, kcal: 87.6, protein_g: 1.06, carbs_g: 19.7, fat_g: 0 }, // Banana, flesh without skin, raw
  "ardei-gras": { src: "ciqual", code: 20041, kcal: 22.6, protein_g: 0.8, carbs_g: 3.5, fat_g: 0.27 }, // Sweet pepper, green, yellow or red, raw
  "ardei-iute": { src: "ciqual", code: 20151, kcal: 37.4, protein_g: 1.87, carbs_g: 5.75, fat_g: 0.44 }, // Chili pepper, raw
  "vinete": { src: "ciqual", code: 20053, kcal: 22.9, protein_g: 0.98, carbs_g: 2.7, fat_g: 0.18 }, // Eggplant, raw
  "dovlecei": { src: "ciqual", code: 20020, kcal: 16.7, protein_g: 1.21, carbs_g: 1.75, fat_g: 0.32 }, // Courgette or zucchini, flesh and skin, raw
  "fasole-verde": { src: "ciqual", code: 20061, kcal: 31.9, protein_g: 1.83, carbs_g: 4.14, fat_g: 0.22 }, // French bean, raw
  "mazare-verde": { src: "ciqual", code: 20072, kcal: 81.2, protein_g: 5.42, carbs_g: 11.4, fat_g: 0.4 }, // Garden peas, raw
  "cartofi-rosii": { src: "ciqual", code: 4008, kcal: 80, protein_g: 2.02, carbs_g: 16.2, fat_g: 0.09 }, // Potato, peeled, raw
  "cartofi-noi": { src: "ciqual", code: 4023, kcal: 76.4, protein_g: 1.94, carbs_g: 15.8, fat_g: 0.3 }, // Potato, new, raw
  "ceapa-rosie": { src: "ciqual", code: 20238, kcal: 35, protein_g: 1.31, carbs_g: 5.63, fat_g: 0.4 }, // Red onion, raw
  "ceapa-verde": { src: "ciqual", code: 11003, kcal: 30.8, protein_g: 2.55, carbs_g: 2.85, fat_g: 0.46 }, // aproape: Chive or spring onion, fresh
  "morcovi": { src: "ciqual", code: 20009, kcal: 30.2, protein_g: 0.78, carbs_g: 5.16, fat_g: 0 }, // Carrot, raw
  "telina-radacina": { src: "ciqual", code: 20055, kcal: 26.3, protein_g: 1.38, carbs_g: 3.98, fat_g: 0 }, // Celeriac, raw
  "telina-apio": { src: "ciqual", code: 20023, kcal: 15.4, protein_g: 0.63, carbs_g: 2.41, fat_g: 0 }, // Celery stalk, raw
  "pastarnac": { src: "ciqual", code: 20181, kcal: 67.9, protein_g: 1.2, carbs_g: 12.6, fat_g: 0.3 }, // Parsnip, raw
  "varza-alba": { src: "ciqual", code: 20116, kcal: 35.2, protein_g: 1.38, carbs_g: 4.63, fat_g: 0.6 }, // White cabbage, raw
  "varza-rosie": { src: "ciqual", code: 20014, kcal: 26.4, protein_g: 1.13, carbs_g: 4.33, fat_g: 0 }, // Red cabbage, raw
  "conopida": { src: "ciqual", code: 20016, kcal: 24.9, protein_g: 1.81, carbs_g: 2.13, fat_g: 0.7 }, // Cauliflower, raw
  "broccoli": { src: "ciqual", code: 20057, kcal: 31.9, protein_g: 2.9, carbs_g: 2.15, fat_g: 0.36 }, // Broccoli, raw
  "salata-verde": { src: "ciqual", code: 20031, kcal: 14.7, protein_g: 1.35, carbs_g: 1.22, fat_g: 0.2 }, // Lettuce, raw
  "spanac": { src: "ciqual", code: 20059, kcal: 33.3, protein_g: 2.68, carbs_g: 3.06, fat_g: 0.39 }, // Spinach, raw
  "stevie": { src: "ciqual", code: 20111, kcal: 23.4, protein_g: 1.89, carbs_g: 1.6, fat_g: 0.65 }, // aproape: Sorrel, raw
  "urzici": { src: "usda", code: 169819, kcal: 42, protein_g: 2.71, carbs_g: 0.59, fat_g: 0.11 }, // aproape: Stinging Nettles, blanched (Northern Plains Indians)
  "marar": { src: "ciqual", code: 11093, kcal: 48.2, protein_g: 3.93, carbs_g: 3.9, fat_g: 1.1 }, // Dill, fresh
  "cimbru-proaspat": { src: "ciqual", code: 11070, kcal: 107, protein_g: 5.56, carbs_g: 10.5, fat_g: 1.68 }, // Thyme, fresh
  "busuioc-proaspat": { src: "ciqual", code: 11033, kcal: 35.2, protein_g: 3.15, carbs_g: 3.4, fat_g: 0.64 }, // Basil, fresh
  "menta-proaspata": { src: "ciqual", code: 11027, kcal: 57.6, protein_g: 3.52, carbs_g: 5.3, fat_g: 0.84 }, // Mint, fresh
  "rozmarin-proaspat": { src: "ciqual", code: 11068, kcal: 121, protein_g: 3.31, carbs_g: 6.6, fat_g: 5.86 }, // Rosemary, fresh
  "salvie-proaspata": { src: "ciqual", code: 11069, kcal: 34.9, protein_g: 4, carbs_g: 0.97, fat_g: 0 }, // Sage, fresh
  "tarhon-proaspat": { src: "ciqual", code: 11080, kcal: 51.2, protein_g: 3.26, carbs_g: 4.69, fat_g: 0.93 }, // aproape: Herbs, fresh (average)
  "praz": { src: "ciqual", code: 20039, kcal: 30.4, protein_g: 1.5, carbs_g: 4.55, fat_g: 0.3 }, // Leek, raw
  "sfecla-rosie": { src: "ciqual", code: 20091, kcal: 40.2, protein_g: 1.61, carbs_g: 6.34, fat_g: 0.17 }, // Beetroot, raw
  "ridichi": { src: "ciqual", code: 20045, kcal: 11, protein_g: 0.94, carbs_g: 1.53, fat_g: 0 }, // Radish, raw
  "ridiche-neagra": { src: "ciqual", code: 20089, kcal: 28.2, protein_g: 0.94, carbs_g: 5.52, fat_g: 0 }, // Radish, black, raw
  "gulie": { src: "ciqual", code: 20065, kcal: 25.1, protein_g: 1.7, carbs_g: 2.44, fat_g: 0.1 }, // Kohlrabi, raw
  "napi": { src: "ciqual", code: 20064, kcal: 25.6, protein_g: 0.9, carbs_g: 4.39, fat_g: 0.1 }, // Turnip, peeled, raw
  "dovleac": { src: "ciqual", code: 20044, kcal: 20.1, protein_g: 1.05, carbs_g: 3.5, fat_g: 0.1 }, // Pumpkin, raw
  "dovleac-hokkaido": { src: "ciqual", code: 20134, kcal: 56.1, protein_g: 1.4, carbs_g: 9.98, fat_g: 0.6 }, // Sweet green hokkaido squash, flesh without skin, raw
  "porumb-stiuleti": { src: "ciqual", code: 20108, kcal: 97.4, protein_g: 3.36, carbs_g: 17, fat_g: 1.19 }, // aproape: Corn, on the cob, frozen, raw
  "ciuperci-champignon": { src: "ciqual", code: 20056, kcal: 21, protein_g: 2.11, carbs_g: 1.83, fat_g: 0.36 }, // Button mushroom or cultivated mushroom, raw
  "pleurotus": { src: "ciqual", code: 20114, kcal: 26.8, protein_g: 3.31, carbs_g: 1.5, fat_g: 0.41 }, // Oyster mushroom, raw
  "hribi": { src: "ciqual", code: 20160, kcal: 28.8, protein_g: 3.23, carbs_g: 2, fat_g: 0.49 }, // Cep or boletus mushroom, raw
  "galbiori": { src: "ciqual", code: 20103, kcal: 24.7, protein_g: 1.49, carbs_g: 1.77, fat_g: 0.53 }, // Chanterelle or girolle mushroom, raw
  "ciuperci-shiitake": { src: "usda", code: 169242, kcal: 34, protein_g: 2.24, carbs_g: 4.29, fat_g: 0.49 }, // Mushrooms, shiitake, raw
  "ghimbir": { src: "ciqual", code: 11074, kcal: 33.3, protein_g: 1.1, carbs_g: 3.4, fat_g: 1.1 }, // Ginger, raw
  "hrean": { src: "ciqual", code: 11016, kcal: 73.2, protein_g: 5.25, carbs_g: 7.79, fat_g: 0.45 }, // Horseradish, raw
  "cartofi-dulci": { src: "ciqual", code: 4101, kcal: 81.2, protein_g: 1.57, carbs_g: 17.1, fat_g: 0.05 }, // Sweet potato, raw
  "andive": { src: "ciqual", code: 20026, kcal: 16.6, protein_g: 1.19, carbs_g: 2.83, fat_g: 0 }, // Chicory, raw
  "rucola": { src: "ciqual", code: 20217, kcal: 27.9, protein_g: 2.58, carbs_g: 2.1, fat_g: 0.66 }, // Roman rocket, raw
  "sparanghel": { src: "ciqual", code: 20279, kcal: 24.7, protein_g: 2.46, carbs_g: 2.03, fat_g: 0.27 }, // Asparagus, green, raw
  "varza-de-bruxelles": { src: "ciqual", code: 20058, kcal: 43.9, protein_g: 3.38, carbs_g: 4.59, fat_g: 0.3 }, // Brussels sprout, raw
  "kale": { src: "ciqual", code: 20346, kcal: 34.6, protein_g: 2.92, carbs_g: 0.32, fat_g: 1.49 }, // Kale, raw
  "ceapa-saloata": { src: "ciqual", code: 20097, kcal: 61.7, protein_g: 1.81, carbs_g: 12.2, fat_g: 0 }, // Shallot, raw
  "rosii-cuore-di-bue": { src: "ciqual", code: 20192, kcal: 17.4, protein_g: 0.5, carbs_g: 3.4, fat_g: 0 }, // Tomato, beef heart, raw
  "avocado": { src: "ciqual", code: 13004, kcal: 203, protein_g: 1.56, carbs_g: 0, fat_g: 20.6 }, // Avocado, flesh without skin, pitted, raw
  "lamai": { src: "ciqual", code: 13009, kcal: 24.3, protein_g: 0.25, carbs_g: 1.56, fat_g: 0 }, // Lemon, flesh without skin, without seeds, raw
  "lime": { src: "ciqual", code: 13067, kcal: 39.3, protein_g: 1.13, carbs_g: 3.14, fat_g: 0 }, // Lime, flesh without skin, without seeds, raw
  "portocale": { src: "ciqual", code: 13034, kcal: 42, protein_g: 0.75, carbs_g: 8.03, fat_g: 0 }, // Orange, flesh without skin, without seeds, raw
  "mandarine": { src: "ciqual", code: 13024, kcal: 45.5, protein_g: 0.81, carbs_g: 9.17, fat_g: 0 }, // Clementine or Mandarin orange, flesh without skin, without seeds, raw
  "grepfrut": { src: "ciqual", code: 13040, kcal: 33.5, protein_g: 0.84, carbs_g: 5.92, fat_g: 0 }, // Grapefruit, flesh without skin, without seeds, raw
  "pere": { src: "ciqual", code: 13037, kcal: 56.6, protein_g: 0.36, carbs_g: 12.3, fat_g: 0.27 }, // Pear, flesh and skin, raw
  "prune": { src: "ciqual", code: 13100, kcal: 51.6, protein_g: 0.7, carbs_g: 9.92, fat_g: 0.28 }, // Plum, flesh and skin, pitted, raw
  "struguri": { src: "ciqual", code: 13395, kcal: 71, protein_g: 0.7, carbs_g: 16.3, fat_g: 0.25 }, // Grape, raw (average)
  "cirese": { src: "ciqual", code: 13008, kcal: 53.7, protein_g: 0.81, carbs_g: 13, fat_g: 0 }, // Cherry, flesh and skin, pitted, raw
  "visine": { src: "usda", code: 173954, kcal: 50, protein_g: 1, carbs_g: 10.58, fat_g: 0.3 }, // Cherries, sour, red, raw
  "capsuni": { src: "ciqual", code: 13014, kcal: 35.1, protein_g: 0.63, carbs_g: 6.03, fat_g: 0 }, // Strawberry, raw
  "afine": { src: "ciqual", code: 13028, kcal: 57.7, protein_g: 0.87, carbs_g: 10.6, fat_g: 0.33 }, // Blueberry, raw
  "zmeura": { src: "ciqual", code: 13015, kcal: 47.9, protein_g: 1.19, carbs_g: 5.83, fat_g: 0.8 }, // Raspberry, raw
  "mure": { src: "ciqual", code: 13029, kcal: 46, protein_g: 1.13, carbs_g: 6.53, fat_g: 0.7 }, // Blackberry, raw
  "coacaze": { src: "ciqual", code: 13019, kcal: 67.2, protein_g: 1.56, carbs_g: 7.06, fat_g: 0.7 }, // aproape: Red currant, raw
  "agrise": { src: "ciqual", code: 13020, kcal: 39.4, protein_g: 0.88, carbs_g: 4.45, fat_g: 0.58 }, // Gooseberry, raw
  "caise": { src: "ciqual", code: 13000, kcal: 44.1, protein_g: 0.81, carbs_g: 9.01, fat_g: 0 }, // Apricot, pitted, raw
  "piersici": { src: "ciqual", code: 13398, kcal: 44.4, protein_g: 0.67, carbs_g: 9.74, fat_g: 0 }, // Peach, flesh without skin, pitted, raw (average)
  "nectarine": { src: "usda", code: 169914, kcal: 44, protein_g: 1.06, carbs_g: 8.85, fat_g: 0.32 }, // Nectarines, raw
  "pepene-rosu": { src: "ciqual", code: 13036, kcal: 35.4, protein_g: 0.69, carbs_g: 8.33, fat_g: 0 }, // Watermelon, flesh without skin, without seeds, raw
  "pepene-galben": { src: "ciqual", code: 13026, kcal: 59.8, protein_g: 1.13, carbs_g: 14.8, fat_g: 0 }, // Melon, cantaloupe (ex Charentais melon), flesh without skin, without seeds, raw
  "gutui": { src: "ciqual", code: 13010, kcal: 59, protein_g: 0.4, carbs_g: 12.5, fat_g: 0.1 }, // Quince, raw
  "smochine": { src: "ciqual", code: 13012, kcal: 67.6, protein_g: 1.19, carbs_g: 13.5, fat_g: 0 }, // Fig, raw
  "kiwi": { src: "ciqual", code: 13021, kcal: 60.9, protein_g: 0.88, carbs_g: 11, fat_g: 0.6 }, // Kiwi fruit, flesh without skin, with seeds, raw
  "ananas": { src: "ciqual", code: 13002, kcal: 51.6, protein_g: 0.25, carbs_g: 11.7, fat_g: 0 }, // Pineapple, flesh without skin, raw
  "rodii": { src: "ciqual", code: 13018, kcal: 81, protein_g: 1.44, carbs_g: 14.3, fat_g: 1.2 }, // Pomegranate, flesh without skin, with seeds, raw
  "macese": { src: "usda", code: 168998, kcal: 162, protein_g: 1.6, carbs_g: 14.12, fat_g: 0.34 }, // aproape: Rose Hips, wild (Northern Plains Indians)
  "corcodusi": { src: "ciqual", code: 13100, kcal: 51.6, protein_g: 0.7, carbs_g: 9.92, fat_g: 0.28 }, // aproape: Plum, flesh and skin, pitted, raw
  "mango": { src: "ciqual", code: 13025, kcal: 71.1, protein_g: 0.63, carbs_g: 14.3, fat_g: 0 }, // Mango, flesh without skin, pitted, raw
  "papaya": { src: "ciqual", code: 13035, kcal: 39.6, protein_g: 0.75, carbs_g: 8.53, fat_g: 0 }, // Papaya, flesh without skin, raw
  "pere-asiatice": { src: "usda", code: 168177, kcal: 42, protein_g: 0.5, carbs_g: 7.05, fat_g: 0.23 }, // Pears, asian, raw
  "curmale-proaspete": { src: "usda", code: 168191, kcal: 277, protein_g: 1.81, carbs_g: 68.27, fat_g: 0.15 }, // aproape: Dates, medjool
  "mere-verzi": { src: "ciqual", code: 13122, kcal: 48.6, protein_g: 0.25, carbs_g: 10.7, fat_g: 0 }, // Apple, var. Granny Smith, flesh and skin,, raw
  "rubarba": { src: "ciqual", code: 13047, kcal: 18.1, protein_g: 0.73, carbs_g: 1.12, fat_g: 0.16 }, // Rhubarb, stalk, raw
  "dude": { src: "usda", code: 169913, kcal: 43, protein_g: 1.44, carbs_g: 8.1, fat_g: 0.39 }, // Mulberries, raw
  "pomelo": { src: "usda", code: 167754, kcal: 38, protein_g: 0.76, carbs_g: 8.62, fat_g: 0.04 }, // Pummelo, raw
  "papadie": { src: "ciqual", code: 20038, kcal: 48.5, protein_g: 2.7, carbs_g: 6.1, fat_g: 0.7 }, // Dandelion, raw
  "piept-pui": { src: "ciqual", code: 36017, kcal: 110, protein_g: 23.4, carbs_g: 0, fat_g: 1.5 }, // Chicken, breast, without skin, raw
  "pulpe-pui": { src: "ciqual", code: 36002, kcal: 192, protein_g: 17.3, carbs_g: 0, fat_g: 13.5 }, // Chicken, leg, meat and skin, raw
  "pulpe-pui-dezosate": { src: "ciqual", code: 36024, kcal: 114, protein_g: 19.3, carbs_g: 0, fat_g: 4.05 }, // Chicken, leg, meat, raw
  "aripi-pui": { src: "ciqual", code: 36023, kcal: 181, protein_g: 20.4, carbs_g: 0, fat_g: 11 }, // Chicken, wing, meat and skin, raw
  "pui-intreg": { src: "ciqual", code: 36016, kcal: 173, protein_g: 21.5, carbs_g: 0.3, fat_g: 9.54 }, // Chicken, meat and skin, raw
  "ficat-pui": { src: "ciqual", code: 40111, kcal: 114, protein_g: 16.9, carbs_g: 0.73, fat_g: 4.83 }, // Liver, chicken, raw
  "pipote-pui": { src: "ciqual", code: 40700, kcal: 99.1, protein_g: 16.8, carbs_g: 0, fat_g: 3.53 }, // Gizzard, chicken, raw
  "carne-tocata-porc": { src: "usda", code: 168372, kcal: 218, protein_g: 17.99, carbs_g: 0.44, fat_g: 16 }, // aproape: Pork, ground, 84% lean / 16% fat, raw
  "carne-tocata-vita": { src: "ciqual", code: 6254, kcal: 215, protein_g: 20.2, carbs_g: 0.47, fat_g: 14.8 }, // aproape: Beef, minced steak, 15% fat, raw
  "carne-tocata-porc-vita": { src: "medie", kcal: 216.5, protein_g: 19.095, carbs_g: 0.455, fat_g: 15.4 }, // aproape: media 1:1 a rândurilor carne-tocata-porc și carne-tocata-vita (decizia proprietarului, 22 oct. 2026)
  "carne-tocata-pui": { src: "usda", code: 171116, kcal: 143, protein_g: 17.44, carbs_g: 0.04, fat_g: 8.1 }, // Chicken, ground, raw
  "cotlet-porc": { src: "ciqual", code: 28100, kcal: 164, protein_g: 19.8, carbs_g: 0.38, fat_g: 9.3 }, // Pork, chop, raw
  "ceafa-porc": { src: "ciqual", code: 28001, kcal: 178, protein_g: 18.9, carbs_g: 0.38, fat_g: 11.2 }, // aproape: Pork, shoulder, raw
  "muschi-porc": { src: "ciqual", code: 28204, kcal: 123, protein_g: 21.2, carbs_g: 0.4, fat_g: 4.09 }, // Pork, filet mignon, raw
  "pulpa-porc": { src: "ciqual", code: 28473, kcal: 141, protein_g: 20.9, carbs_g: 0.28, fat_g: 6.3 }, // Pork, way leg, without rind, fat and bone, raw
  "costita-porc": { src: "ciqual", code: 28002, kcal: 253, protein_g: 17, carbs_g: 0, fat_g: 20.5 }, // Pork, belly, raw
  "coaste-porc": { src: "ciqual", code: 28400, kcal: 237, protein_g: 18, carbs_g: 0.6, fat_g: 18 }, // Pork, spare-ribs, raw
  "carne-vita-supa": { src: "ciqual", code: 6231, kcal: 164, protein_g: 24, carbs_g: 0, fat_g: 7.5 }, // aproape: Beef, stewing meat, raw
  "pulpa-vita": { src: "ciqual", code: 6102, kcal: 187, protein_g: 20.7, carbs_g: 0, fat_g: 11.5 }, // Beef, round, raw
  "muschi-vita": { src: "ciqual", code: 6116, kcal: 132, protein_g: 21.6, carbs_g: 0.22, fat_g: 4.95 }, // Beef, tenderloin, raw
  "carne-oaie": { src: "ciqual", code: 21001, kcal: 137, protein_g: 20.6, carbs_g: 0, fat_g: 6.11 }, // Mutton, meat, raw
  "carne-miel": { src: "ciqual", code: 21504, kcal: 170, protein_g: 18.3, carbs_g: 0.45, fat_g: 10.6 }, // aproape: Lamb, shoulder, raw
  "piept-curcan": { src: "ciqual", code: 36304, kcal: 108, protein_g: 23.7, carbs_g: 0, fat_g: 1.48 }, // Turkey, escalope, raw
  "pulpe-curcan": { src: "ciqual", code: 36305, kcal: 149, protein_g: 19.7, carbs_g: 0, fat_g: 7.85 }, // Turkey, leg, meat and skin, raw
  "carnati-proaspeti": { src: "ciqual", code: 30110, kcal: 321, protein_g: 13.3, carbs_g: 0.64, fat_g: 29.5 }, // aproape: Toulouse sausage, raw
  "mici": { src: "ciqual", code: 30156, kcal: 315, protein_g: 14, carbs_g: 2.8, fat_g: 27.6 }, // aproape: Merguez sausage, beef and mutton, raw
  "ficat-porc": { src: "ciqual", code: 40119, kcal: 124, protein_g: 20.6, carbs_g: 1.06, fat_g: 4.2 }, // Liver, pork, raw
  "ficat-vita": { src: "ciqual", code: 40104, kcal: 136, protein_g: 21, carbs_g: 3.33, fat_g: 4.3 }, // Liver, heifer, raw
  "limba-vita": { src: "ciqual", code: 40202, kcal: 195, protein_g: 16.8, carbs_g: 0.82, fat_g: 13.8 }, // Tongue, beef, raw
  "rata": { src: "ciqual", code: 36204, kcal: 273, protein_g: 17.4, carbs_g: 0, fat_g: 22.6 }, // Duck, meat and skin, raw
  "gasca": { src: "ciqual", code: 36501, kcal: 366, protein_g: 15.9, carbs_g: 0, fat_g: 33.6 }, // Goose, meat and skin, raw
  "iepure": { src: "ciqual", code: 34001, kcal: 188, protein_g: 20.4, carbs_g: 0.58, fat_g: 11.6 }, // Rabbit, meat, raw
  "spata-porc": { src: "ciqual", code: 28001, kcal: 178, protein_g: 18.9, carbs_g: 0.38, fat_g: 11.2 }, // Pork, shoulder, raw
  "piept-porc": { src: "ciqual", code: 28002, kcal: 253, protein_g: 17, carbs_g: 0, fat_g: 20.5 }, // aproape: Pork, belly, raw
  "ciolan-porc": { src: "ciqual", code: 28474, kcal: 148, protein_g: 20.2, carbs_g: 0.28, fat_g: 7.31 }, // aproape: Pork, knuckle oh ham, without rind, fat and bone, raw
  "pulpa-miel": { src: "ciqual", code: 21502, kcal: 128, protein_g: 20, carbs_g: 0.48, fat_g: 5.13 }, // Lamb, leg, raw
  "drob-miel": { src: "ciqual", code: 40102, kcal: 137, protein_g: 21.8, carbs_g: 0.16, fat_g: 5.45 }, // aproape: Liver, lamb, raw
  "file-salau": { src: "ciqual", code: 27024, kcal: 87.2, protein_g: 18.3, carbs_g: 1.06, fat_g: 1.08 }, // Pike-perch, raw
  "crap": { src: "ciqual", code: 27003, kcal: 114, protein_g: 17.7, carbs_g: 0, fat_g: 4.76 }, // Carp, raw, farmed
  "pastrav": { src: "ciqual", code: 27008, kcal: 133, protein_g: 19.3, carbs_g: 0, fat_g: 6.22 }, // Trout, raw, farmed
  "macrou": { src: "ciqual", code: 26051, kcal: 198, protein_g: 18.1, carbs_g: 0.93, fat_g: 13.5 }, // Mackerel, raw
  "hering": { src: "ciqual", code: 26011, kcal: 176, protein_g: 17.7, carbs_g: 0, fat_g: 11.7 }, // Atlantic herring, raw
  "file-cod": { src: "ciqual", code: 26043, kcal: 77.4, protein_g: 18.1, carbs_g: 0, fat_g: 0.57 }, // Cod, raw
  "somon-file": { src: "ciqual", code: 26036, kcal: 193, protein_g: 20.5, carbs_g: 0, fat_g: 12.4 }, // Salmon, raw, farmed
  "file-merluciu": { src: "ciqual", code: 26044, kcal: 82.6, protein_g: 17.6, carbs_g: 0, fat_g: 1.35 }, // European hake, raw
  "ton-proaspat": { src: "ciqual", code: 26053, kcal: 155, protein_g: 24, carbs_g: 2.72, fat_g: 5.38 }, // Tuna, raw
  "creveti": { src: "ciqual", code: 10021, kcal: 99, protein_g: 19.7, carbs_g: 3.21, fat_g: 0.84 }, // Shrimp or prawn, raw
  "midii": { src: "ciqual", code: 10014, kcal: 71.8, protein_g: 11.2, carbs_g: 2.69, fat_g: 1.82 }, // Mussel, common, raw
  "calamar": { src: "ciqual", code: 10001, kcal: 77, protein_g: 14.4, carbs_g: 2.17, fat_g: 1.19 }, // Squid, raw
  "scrumbie-afumata": { src: "ciqual", code: 25998, kcal: 163, protein_g: 18.1, carbs_g: 0.44, fat_g: 9.9 }, // aproape: Atlantic herring, smoked
  "icre-stiuca": { src: "ciqual", code: 26004, kcal: 77.8, protein_g: 10.4, carbs_g: 1.01, fat_g: 3.48 }, // aproape: Lump roe, semi-preserved
  "stiuca": { src: "ciqual", code: 27011, kcal: 87.7, protein_g: 18.8, carbs_g: 1, fat_g: 0.94 }, // Northern pike, raw
  "carasi": { src: "ciqual", code: 27003, kcal: 114, protein_g: 17.7, carbs_g: 0, fat_g: 4.76 }, // aproape: Carp, raw, farmed
  "bibani": { src: "ciqual", code: 27010, kcal: 84.6, protein_g: 17.9, carbs_g: 0.6, fat_g: 1.19 }, // European perch, raw
  "pangasius": { src: "usda", code: 175165, kcal: 119, protein_g: 15.23, carbs_g: 0, fat_g: 5.94 }, // aproape: Fish, catfish, channel, farmed, raw
  "dorada": { src: "ciqual", code: 26088, kcal: 129, protein_g: 20.9, carbs_g: 0, fat_g: 5.1 }, // Gilthead seabream, raw, farmed
  "levrek": { src: "ciqual", code: 26206, kcal: 124, protein_g: 21.4, carbs_g: 0, fat_g: 4.25 }, // Mediterranean bass, raw, farmed
  "pastrama-peste": { src: "ciqual", code: 26087, kcal: 289, protein_g: 19.8, carbs_g: 0.92, fat_g: 22.9 }, // aproape: Mackerel, smoked
  "lapte-integral": { src: "ciqual", code: 19016, kcal: 63.9, protein_g: 3.42, carbs_g: 4.78, fat_g: 3.49 }, // Milk, whole (average)
  "lapte-semidegresat": { src: "ciqual", code: 19033, kcal: 47.5, protein_g: 3.46, carbs_g: 4.97, fat_g: 1.55 }, // Milk, semi-skimmed (average)
  "lapte-batut": { src: "ciqual", code: 19805, kcal: 52.7, protein_g: 3.38, carbs_g: 1.99, fat_g: 3.2 }, // aproape: Fermented milk drink, plain, whole milk
  "lapte-de-la-producator": { src: "ciqual", code: 19016, kcal: 63.9, protein_g: 3.42, carbs_g: 4.78, fat_g: 3.49 }, // aproape: Milk, whole (average)
  "sana": { src: "ciqual", code: 19805, kcal: 52.7, protein_g: 3.38, carbs_g: 1.99, fat_g: 3.2 }, // aproape: Fermented milk drink, plain, whole milk
  "kefir": { src: "ciqual", code: 19865, kcal: 61.1, protein_g: 3.19, carbs_g: 4.5, fat_g: 3.4 }, // Milk kefir
  "iaurt-natural": { src: "ciqual", code: 19593, kcal: 50.1, protein_g: 3.83, carbs_g: 4.26, fat_g: 1.68 }, // Yogurt or fermented milk, plain
  "iaurt-grecesc": { src: "ciqual", code: 19860, kcal: 103, protein_g: 3.02, carbs_g: 3.73, fat_g: 8.16 }, // Yogurt, Greek-style, plain
  "iaurt-fructe": { src: "ciqual", code: 19587, kcal: 88.9, protein_g: 3.23, carbs_g: 12.6, fat_g: 2.41 }, // Yogurt or fermented milk, with fruits, with sugar(s)
  "smantana": { src: "ciqual", code: 19431, kcal: 162, protein_g: 2.65, carbs_g: 4.55, fat_g: 14.4 }, // Cream, 12-25% fat, light, thick, refrigerated
  "smantana-gatit": { src: "ciqual", code: 19430, kcal: 189, protein_g: 2.78, carbs_g: 4.34, fat_g: 17.6 }, // aproape: Cream, 12-25% fat, light, semi-thick, UHT
  "smantana-dulce": { src: "ciqual", code: 19417, kcal: 293, protein_g: 2.2, carbs_g: 3.69, fat_g: 30 }, // Cream 30% fat, liquid, UHT
  "unt": { src: "ciqual", code: 16400, kcal: 753, protein_g: 0.64, carbs_g: 0.71, fat_g: 83 }, // Butter, 80% fat minimum, unsalted
  "unt-de-la-producator": { src: "ciqual", code: 16400, kcal: 753, protein_g: 0.64, carbs_g: 0.71, fat_g: 83 }, // aproape: Butter, 80% fat minimum, unsalted
  "branza-vaci": { src: "ciqual", code: 19641, kcal: 83.6, protein_g: 4.47, carbs_g: 3.36, fat_g: 5.5 }, // aproape: Drained soft fresh cheese, around 6% fat
  "mascarpone": { src: "ciqual", code: 19584, kcal: 369, protein_g: 6, carbs_g: 3.1, fat_g: 37 }, // Mascarpone cheese, from cow's milk
  "crema-branza": { src: "ciqual", code: 12068, kcal: 225, protein_g: 6.25, carbs_g: 3.31, fat_g: 20.7 }, // aproape: Uncured soft cheese, spreadable, plain, in tray, from cow's milk
  "budinca-vanilie": { src: "ciqual", code: 39229, kcal: 103, protein_g: 2.98, carbs_g: 16.2, fat_g: 2.88 }, // aproape: Custard dessert, vanilla, refrigerated
  "lapte-vegetal": { src: "ciqual", code: 18112, kcal: 43.6, protein_g: 2.68, carbs_g: 2.38, fat_g: 2.33 }, // aproape: Plant-based drink, prepacked (average)
  "telemea-vaca": { src: "ciqual", code: 12060, kcal: 273, protein_g: 15.4, carbs_g: 1.22, fat_g: 22.6 }, // aproape: Feta-type cheese, 100% from cow's milk
  "telemea-oaie": { src: "ciqual", code: 12066, kcal: 284, protein_g: 15.1, carbs_g: 0.45, fat_g: 24.3 }, // aproape: Feta cheese, 70% min. from ewe's milk, 30% min. from goat's milk
  "branza-burduf": { src: "ciqual", code: 12066, kcal: 284, protein_g: 15.1, carbs_g: 0.45, fat_g: 24.3 }, // aproape: Feta cheese, 70% min. from ewe's milk, 30% min. from goat's milk
  "urda": { src: "ciqual", code: 12828, kcal: 190, protein_g: 10.1, carbs_g: 4.3, fat_g: 14.8 }, // aproape: Cheese, from ewe's whey
  "cas": { src: "ciqual", code: 12071, kcal: 142, protein_g: 9.38, carbs_g: 4.81, fat_g: 9.36 }, // aproape: Brousse (uncured cheese from ewes' milk)
  "cascaval": { src: "ciqual", code: 12736, kcal: 369, protein_g: 24.7, carbs_g: 0, fat_g: 30.2 }, // aproape: Gouda cheese, from cow's milk
  "cascaval-afumat": { src: "ciqual", code: 12736, kcal: 369, protein_g: 24.7, carbs_g: 0, fat_g: 30.2 }, // aproape: Gouda cheese, from cow's milk
  "branza-topita": { src: "ciqual", code: 12303, kcal: 238, protein_g: 11.2, carbs_g: 8.52, fat_g: 17.6 }, // Processed cheese, from cow's milk, triangle, not fortified
  "mozzarella": { src: "ciqual", code: 19590, kcal: 227, protein_g: 16.5, carbs_g: 0.7, fat_g: 17.7 }, // Mozzarella cheese, from cow's milk
  "parmezan": { src: "ciqual", code: 12120, kcal: 411, protein_g: 31.1, carbs_g: 1.14, fat_g: 31 }, // Parmesan cheese, from cow's milk
  "feta": { src: "ciqual", code: 12066, kcal: 284, protein_g: 15.1, carbs_g: 0.45, fat_g: 24.3 }, // Feta cheese, 70% min. from ewe's milk, 30% min. from goat's milk
  "branza-dulce": { src: "ciqual", code: 19641, kcal: 83.6, protein_g: 4.47, carbs_g: 3.36, fat_g: 5.5 }, // aproape: Drained soft fresh cheese, around 6% fat
  "branza-afumata": { src: "ciqual", code: 12060, kcal: 273, protein_g: 15.4, carbs_g: 1.22, fat_g: 22.6 }, // aproape: Feta-type cheese, 100% from cow's milk
  "branza-cottage": { src: "usda", code: 172179, kcal: 98, protein_g: 11.12, carbs_g: 3.38, fat_g: 4.3 }, // Cheese, cottage, creamed, large or small curd
  "ricotta": { src: "usda", code: 170851, kcal: 150, protein_g: 7.54, carbs_g: 7.27, fat_g: 10.18 }, // Cheese, ricotta, whole milk
  "gouda": { src: "ciqual", code: 12736, kcal: 369, protein_g: 24.7, carbs_g: 0, fat_g: 30.2 }, // Gouda cheese, from cow's milk
  "edam": { src: "ciqual", code: 12729, kcal: 320, protein_g: 25.7, carbs_g: 0, fat_g: 24.4 }, // Edam cheese, from cow's milk
  "emmentaler": { src: "ciqual", code: 12115, kcal: 373, protein_g: 27.9, carbs_g: 0, fat_g: 28.8 }, // Emmental cheese, from cow's milk
  "gorgonzola": { src: "ciqual", code: 12524, kcal: 318, protein_g: 19.5, carbs_g: 0, fat_g: 26.9 }, // Gorgonzola cheese, from cow's milk
  "branza-capra": { src: "ciqual", code: 12805, kcal: 194, protein_g: 12, carbs_g: 2.5, fat_g: 15.2 }, // Cheese, fresh, from goat's milk,
  "branza-in-saramura": { src: "ciqual", code: 12060, kcal: 273, protein_g: 15.4, carbs_g: 1.22, fat_g: 22.6 }, // aproape: Feta-type cheese, 100% from cow's milk
  "oua": { src: "ciqual", code: 22000, kcal: 140, protein_g: 12.8, carbs_g: 0.06, fat_g: 9.83 }, // Egg, raw
  "oua-tara": { src: "ciqual", code: 22000, kcal: 140, protein_g: 12.8, carbs_g: 0.06, fat_g: 9.83 }, // Egg, raw
  "oua-prepelita": { src: "ciqual", code: 22050, kcal: 154, protein_g: 13.1, carbs_g: 0.41, fat_g: 11.1 }, // Quail egg, raw
  "oua-rata": { src: "ciqual", code: 22060, kcal: 181, protein_g: 12.8, carbs_g: 1.45, fat_g: 13.8 }, // Duck egg, raw
  "oua-bio": { src: "ciqual", code: 22000, kcal: 140, protein_g: 12.8, carbs_g: 0.06, fat_g: 9.83 }, // Egg, raw
  "slanina": { src: "ciqual", code: 28470, kcal: 744, protein_g: 4.51, carbs_g: 0.1, fat_g: 80.6 }, // Pork, back fat, rind less, raw
  "slanina-afumata": { src: "ciqual", code: 28502, kcal: 303, protein_g: 15.6, carbs_g: 0.79, fat_g: 26.1 }, // aproape: Pork belly, cured, smoked, raw
  "costita-afumata": { src: "ciqual", code: 28502, kcal: 303, protein_g: 15.6, carbs_g: 0.79, fat_g: 26.1 }, // aproape: Pork belly, cured, smoked, raw
  "carnati-afumati": { src: "usda", code: 174585, kcal: 320, protein_g: 12, carbs_g: 2.42, fat_g: 28.73 }, // aproape: Sausage, smoked link sausage, pork and beef
  "carnati-pleascoi": { src: "ciqual", code: 30301, kcal: 417, protein_g: 28.7, carbs_g: 1.79, fat_g: 32.3 }, // aproape: Dry sausage, pure pork
  "cabanos": { src: "ciqual", code: 30309, kcal: 460, protein_g: 27.3, carbs_g: 4.04, fat_g: 37.1 }, // aproape: Dry sausage, thin size
  "salam": { src: "ciqual", code: 30350, kcal: 457, protein_g: 17.7, carbs_g: 2.59, fat_g: 41.8 }, // Salami
  "salam-sibiu": { src: "ciqual", code: 30351, kcal: 446, protein_g: 17, carbs_g: 0.75, fat_g: 41.5 }, // aproape: Salami, pure pork
  "sunca-presata": { src: "ciqual", code: 28910, kcal: 125, protein_g: 19.5, carbs_g: 1.7, fat_g: 4.5 }, // aproape: Cooked ham, choice
  "sunca-praga": { src: "ciqual", code: 28803, kcal: 135, protein_g: 20, carbs_g: 0.79, fat_g: 5.8 }, // aproape: Cooked ham, smoked
  "parizer": { src: "ciqual", code: 30764, kcal: 236, protein_g: 15.7, carbs_g: 3.96, fat_g: 17.5 }, // aproape: Ham sausage, pure pork
  "crenvursti": { src: "ciqual", code: 30134, kcal: 279, protein_g: 13.7, carbs_g: 3.37, fat_g: 23.4 }, // Frankfurter sausage
  "toba": { src: "ciqual", code: 8400, kcal: 184, protein_g: 13.8, carbs_g: 3.15, fat_g: 12.9 }, // aproape: Head-cheese pâté or brawn
  "caltabos": { src: "ciqual", code: 8703, kcal: 297, protein_g: 12.2, carbs_g: 0.29, fat_g: 27.1 }, // aproape: Black pudding, to cook
  "piept-pui-afumat": { src: "ciqual", code: 28963, kcal: 105, protein_g: 20.7, carbs_g: 1.39, fat_g: 1.79 }, // aproape: Cooked ham, from chicken, in slices
  "jambon": { src: "ciqual", code: 28900, kcal: 113, protein_g: 21, carbs_g: 0.76, fat_g: 2.83 }, // Cooked ham, superior quality
  "muschi-file": { src: "usda", code: 167869, kcal: 110, protein_g: 20.31, carbs_g: 1.34, fat_g: 2.62 }, // aproape: Canadian bacon, unprepared
  "bacon": { src: "ciqual", code: 28858, kcal: 349, protein_g: 20.2, carbs_g: 2.49, fat_g: 28.8 }, // aproape: Pancetta
  "carnati-picanti": { src: "usda", code: 173859, kcal: 296, protein_g: 13.63, carbs_g: 3.78, fat_g: 25.1 }, // aproape: Sausage, pork, chorizo, link or ground, raw
  "lebar": { src: "ciqual", code: 30176, kcal: 374, protein_g: 11.7, carbs_g: 0.9, fat_g: 35.9 }, // aproape: Liver sausage
  "paine-alba": { src: "ciqual", code: 7002, kcal: 261, protein_g: 7.41, carbs_g: 53.1, fat_g: 1.3 }, // aproape: Bread, French bread, with yeast
  "paine-neagra": { src: "ciqual", code: 7125, kcal: 260, protein_g: 8.27, carbs_g: 51.5, fat_g: 1 }, // aproape: Rye and wheat bread
  "paine-integrala": { src: "ciqual", code: 7110, kcal: 234, protein_g: 8.66, carbs_g: 41.2, fat_g: 1.7 }, // Bread, French bread, wholemeal or integral bread (made with flour type 150)
  "paine-feliata": { src: "ciqual", code: 7000, kcal: 276, protein_g: 8.18, carbs_g: 55, fat_g: 1.36 }, // aproape: Bread (average)
  "chifle": { src: "ciqual", code: 7000, kcal: 276, protein_g: 8.18, carbs_g: 55, fat_g: 1.36 }, // aproape: Bread (average)
  "lipie": { src: "ciqual", code: 7180, kcal: 249, protein_g: 7.48, carbs_g: 48.8, fat_g: 1.5 }, // aproape: Bread, pita
  "baghete": { src: "ciqual", code: 7001, kcal: 287, protein_g: 8.27, carbs_g: 58.3, fat_g: 1.4 }, // Bread, French bread, baguette
  "franzela": { src: "ciqual", code: 7001, kcal: 287, protein_g: 8.27, carbs_g: 58.3, fat_g: 1.4 }, // aproape: Bread, French bread, baguette
  "cozonac": { src: "ciqual", code: 7225, kcal: 338, protein_g: 8.89, carbs_g: 48.6, fat_g: 11.2 }, // aproape: Brioche or Vienna bread, from bakery
  "covrigi": { src: "ciqual", code: 7263, kcal: 330, protein_g: 9.18, carbs_g: 54.6, fat_g: 7.1 }, // aproape: Bretzel, fresh bread
  "pesmet": { src: "ciqual", code: 7500, kcal: 365, protein_g: 9.41, carbs_g: 74.3, fat_g: 1.6 }, // Breadcrumbs
  "orez": { src: "ciqual", code: 9100, kcal: 350, protein_g: 7.02, carbs_g: 77.5, fat_g: 0.79 }, // Rice, white, raw
  "orez-bob-rotund": { src: "ciqual", code: 9100, kcal: 350, protein_g: 7.02, carbs_g: 77.5, fat_g: 0.79 }, // aproape: Rice, white, raw
  "malai": { src: "ciqual", code: 9545, kcal: 362, protein_g: 5.59, carbs_g: 80.9, fat_g: 1.39 }, // Maize/corn flour
  "gris": { src: "ciqual", code: 9610, kcal: 350, protein_g: 11.8, carbs_g: 69.8, fat_g: 1.28 }, // Durum wheat semolina, raw
  "fulgi-ovaz": { src: "ciqual", code: 32140, kcal: 369, protein_g: 10.6, carbs_g: 57.7, fat_g: 7.82 }, // Oat flakes
  "musli": { src: "ciqual", code: 32141, kcal: 409, protein_g: 9.63, carbs_g: 61.8, fat_g: 11.6 }, // Muesli, not fortified (average food)
  "cereale-mic-dejun": { src: "ciqual", code: 32003, kcal: 402, protein_g: 7.96, carbs_g: 73.2, fat_g: 7.21 }, // aproape: Breakfast cereals (average)
  "paste-spaghete": { src: "ciqual", code: 9810, kcal: 364, protein_g: 12, carbs_g: 72.7, fat_g: 1.6 }, // Pasta, dry, regular, raw
  "paste-penne": { src: "ciqual", code: 9810, kcal: 364, protein_g: 12, carbs_g: 72.7, fat_g: 1.6 }, // Pasta, dry, regular, raw
  "paste-fusilli": { src: "ciqual", code: 9810, kcal: 364, protein_g: 12, carbs_g: 72.7, fat_g: 1.6 }, // Pasta, dry, regular, raw
  "taitei-supa": { src: "ciqual", code: 9821, kcal: 381, protein_g: 14, carbs_g: 68, fat_g: 4.72 }, // aproape: Pasta, dry, with egg, raw
  "fidea": { src: "ciqual", code: 9810, kcal: 364, protein_g: 12, carbs_g: 72.7, fat_g: 1.6 }, // Pasta, dry, regular, raw
  "lasagna-foi": { src: "ciqual", code: 9810, kcal: 364, protein_g: 12, carbs_g: 72.7, fat_g: 1.6 }, // aproape: Pasta, dry, regular, raw
  "couscous": { src: "ciqual", code: 9681, kcal: 366, protein_g: 12.3, carbs_g: 72.7, fat_g: 1.32 }, // Couscous (pre-cooked durum wheat semolina), raw
  "bulgur": { src: "ciqual", code: 9690, kcal: 347, protein_g: 11.7, carbs_g: 65.8, fat_g: 1.42 }, // Wheat, bulgur, raw
  "quinoa": { src: "ciqual", code: 9340, kcal: 358, protein_g: 13.2, carbs_g: 58.1, fat_g: 6.07 }, // Quinoa, raw
  "fasole-boabe-uscata": { src: "ciqual", code: 20501, kcal: 307, protein_g: 23.4, carbs_g: 43.9, fat_g: 0.85 }, // Haricot bean, dried
  "linte": { src: "ciqual", code: 20359, kcal: 327, protein_g: 25.1, carbs_g: 44.5, fat_g: 1.8 }, // Lentil, dried (average)
  "naut": { src: "ciqual", code: 20516, kcal: 350, protein_g: 20.5, carbs_g: 47.5, fat_g: 6.04 }, // Chick pea, dried
  "mazare-uscata": { src: "ciqual", code: 20515, kcal: 347, protein_g: 23.8, carbs_g: 47.5, fat_g: 1.16 }, // Split pea, dried
  "arpacas": { src: "ciqual", code: 9321, kcal: 346, protein_g: 9.91, carbs_g: 68.6, fat_g: 1.16 }, // Pearled barley, raw
  "faina-alba": { src: "ciqual", code: 9440, kcal: 355, protein_g: 8.44, carbs_g: 76.5, fat_g: 0.82 }, // aproape: Wheat flour, type 45 (for pastry)
  "faina-integrala": { src: "ciqual", code: 9415, kcal: 342, protein_g: 11.4, carbs_g: 64.9, fat_g: 1.52 }, // Wheat flour, type 150
  "zahar": { src: "ciqual", code: 31016, kcal: 399, protein_g: 0, carbs_g: 99.7, fat_g: 0 }, // Sugar, white
  "zahar-pudra": { src: "ciqual", code: 31016, kcal: 399, protein_g: 0, carbs_g: 99.7, fat_g: 0 }, // aproape: Sugar, white
  "zahar-vanilat": { src: "ciqual", code: 31044, kcal: 397, protein_g: 0.1, carbs_g: 98.6, fat_g: 0.33 }, // Sugar, vanilla flavoured
  "drojdie-proaspata": { src: "ciqual", code: 11010, kcal: 115, protein_g: 8.4, carbs_g: 11.9, fat_g: 1.9 }, // Baker's yeast, fresh
  "drojdie-uscata": { src: "ciqual", code: 11045, kcal: 341, protein_g: 42.7, carbs_g: 14.3, fat_g: 6.56 }, // Baker's yeast, dehydrated
  "praf-copt": { src: "ciqual", code: 11046, kcal: 108, protein_g: 0.1, carbs_g: 26.9, fat_g: 0 }, // Baking powder or raising agent
  "bicarbonat": { src: "ciqual", code: 11507, kcal: 0.4, protein_g: 0.1, carbs_g: 0, fat_g: 0 }, // Sodium bicarbonate
  "cacao": { src: "ciqual", code: 18100, kcal: 387, protein_g: 22.4, carbs_g: 11.6, fat_g: 20.6 }, // Cocoa powder, no added sugars, powder, instant
  "ciocolata-gatit": { src: "ciqual", code: 31085, kcal: 546, protein_g: 6.39, carbs_g: 51.4, fat_g: 33.1 }, // Dark chocolate, more than 40% cocoa, for cooking, bar
  "esenta-vanilie": { src: "ciqual", code: 11065, kcal: 240, protein_g: 0.05, carbs_g: 2.41, fat_g: 0 }, // aproape: Vanilla, alcoholic extract
  "nuci-miez": { src: "ciqual", code: 15005, kcal: 709, protein_g: 13.3, carbs_g: 6.88, fat_g: 67.3 }, // Walnut, kernel, dried
  "alune": { src: "ciqual", code: 15004, kcal: 632, protein_g: 14.4, carbs_g: 7.16, fat_g: 56.9 }, // aproape: Hazelnut, no added salt
  "migdale": { src: "ciqual", code: 15041, kcal: 631, protein_g: 21.4, carbs_g: 8.76, fat_g: 52.5 }, // Almond, peeled, no added salt
  "stafide": { src: "ciqual", code: 13046, kcal: 322, protein_g: 3, carbs_g: 73.2, fat_g: 0.9 }, // Raisin
  "lapte-condensat": { src: "ciqual", code: 19027, kcal: 327, protein_g: 7.7, carbs_g: 56.5, fat_g: 7.87 }, // Condensed milk, with sugar(s), whole
  "gelatina": { src: "ciqual", code: 11007, kcal: 348, protein_g: 86.9, carbs_g: 0, fat_g: 0.1 }, // Gelatin, dried
  "amidon": { src: "ciqual", code: 9510, kcal: 365, protein_g: 0.26, carbs_g: 90.4, fat_g: 0.05 }, // Maize/corn starch
  "foi-placinta": { src: "ciqual", code: 23445, kcal: 289, protein_g: 7.1, carbs_g: 50.7, fat_g: 6 }, // aproape: Phyllo or filo dough, raw
  "seminte-floarea-soarelui": { src: "ciqual", code: 15011, kcal: 653, protein_g: 21.3, carbs_g: 10.1, fat_g: 55.5 }, // Sunflower, seed
  "seminte-dovleac": { src: "ciqual", code: 15064, kcal: 618, protein_g: 29.5, carbs_g: 5.39, fat_g: 49.1 }, // Pumpkin and squash, seed, dried
  "susan": { src: "ciqual", code: 15010, kcal: 606, protein_g: 17.7, carbs_g: 12.8, fat_g: 49.7 }, // Sesame seed
  "mac": { src: "usda", code: 171330, kcal: 525, protein_g: 17.99, carbs_g: 8.63, fat_g: 41.56 }, // Spices, poppy seed
  "miere": { src: "ciqual", code: 31008, kcal: 331, protein_g: 0.65, carbs_g: 82.1, fat_g: 0 }, // Honey
  "gem": { src: "ciqual", code: 31006, kcal: 244, protein_g: 0.33, carbs_g: 59.3, fat_g: 0.28 }, // Jam or marmalade, miscellaneaous fruits (not reduced sugar) (average)
  "dulceata": { src: "ciqual", code: 31006, kcal: 244, protein_g: 0.33, carbs_g: 59.3, fat_g: 0.28 }, // aproape: Jam or marmalade, miscellaneaous fruits (not reduced sugar) (average)
  "magiun": { src: "ciqual", code: 31053, kcal: 240, protein_g: 0.28, carbs_g: 58.9, fat_g: 0.089 }, // aproape: Jam, plum
  "bulion": { src: "ciqual", code: 20170, kcal: 47.6, protein_g: 1.5, carbs_g: 8.42, fat_g: 0.2 }, // aproape: Tomato puree, canned
  "pasta-tomate": { src: "ciqual", code: 20068, kcal: 99.2, protein_g: 4.4, carbs_g: 17.1, fat_g: 0.53 }, // Tomato paste, concentrated, canned
  "rosii-conserva": { src: "ciqual", code: 20137, kcal: 21.8, protein_g: 0.79, carbs_g: 3.15, fat_g: 0.25 }, // Tomato, peeled, canned, in juice, solids and liquids
  "castraveti-murati": { src: "ciqual", code: 11004, kcal: 16, protein_g: 1.06, carbs_g: 0.78, fat_g: 0 }, // Gherkin, pickled in vinegar
  "varza-murata": { src: "usda", code: 169279, kcal: 19, protein_g: 0.91, carbs_g: 1.38, fat_g: 0.14 }, // Sauerkraut, canned, solids and liquids
  "varza-murata-frunze": { src: "usda", code: 169279, kcal: 19, protein_g: 0.91, carbs_g: 1.38, fat_g: 0.14 }, // aproape: Sauerkraut, canned, solids and liquids
  "ardei-copti-conserva": { src: "ciqual", code: 20275, kcal: 26.3, protein_g: 0.96, carbs_g: 4.5, fat_g: 0.2 }, // aproape: Sweet pepper, red, canned, drained
  "fasole-conserva": { src: "ciqual", code: 20511, kcal: 85.5, protein_g: 5.88, carbs_g: 10.9, fat_g: 0.5 }, // Haricot bean, canned, drained
  "mazare-conserva": { src: "ciqual", code: 20036, kcal: 92.5, protein_g: 4.87, carbs_g: 13.7, fat_g: 0.8 }, // Garden peas, canned, drained
  "porumb-conserva": { src: "ciqual", code: 20066, kcal: 105, protein_g: 2.66, carbs_g: 18.3, fat_g: 1.68 }, // Corn, sweet, canned, drained
  "ton-conserva": { src: "ciqual", code: 26180, kcal: 206, protein_g: 23.3, carbs_g: 0.76, fat_g: 12.2 }, // Tuna, whole slice, in sunflower oil, canned, drained
  "sardine-conserva": { src: "ciqual", code: 26034, kcal: 217, protein_g: 23.3, carbs_g: 0.31, fat_g: 13.7 }, // European pilchard or sardine, in oil, canned, drained
  "pateu": { src: "ciqual", code: 8211, kcal: 323, protein_g: 15.5, carbs_g: 1.5, fat_g: 28.2 }, // aproape: Country-style pâté or terrine
  "ciuperci-conserva": { src: "ciqual", code: 20079, kcal: 18.3, protein_g: 2, carbs_g: 0.64, fat_g: 0.37 }, // Button mushroom or cultivated mushroom, canned, drained
  "masline": { src: "ciqual", code: 13184, kcal: 165, protein_g: 1.29, carbs_g: 0.65, fat_g: 16.6 }, // Olive (average)
  "capere": { src: "usda", code: 172238, kcal: 23, protein_g: 2.36, carbs_g: 1.69, fat_g: 0.86 }, // Capers, canned
  "ketchup": { src: "ciqual", code: 11008, kcal: 108, protein_g: 1.23, carbs_g: 23.7, fat_g: 0.16 }, // Ketchup, prepacked
  "maioneza": { src: "ciqual", code: 11054, kcal: 692, protein_g: 1.33, carbs_g: 3.41, fat_g: 74.5 }, // Mayonnaise (70% fat min.), prepacked
  "mustar": { src: "ciqual", code: 11013, kcal: 151, protein_g: 6.92, carbs_g: 4.33, fat_g: 11.2 }, // Mustard
  "hrean-borcan": { src: "usda", code: 173472, kcal: 48, protein_g: 1.18, carbs_g: 7.99, fat_g: 0.69 }, // Horseradish, prepared
  "ulei-floarea-soarelui": { src: "ciqual", code: 17440, kcal: 900, protein_g: 0.25, carbs_g: 0, fat_g: 100 }, // Sunflower oil
  "ulei-masline": { src: "ciqual", code: 17270, kcal: 899, protein_g: 0.25, carbs_g: 0, fat_g: 99.9 }, // Olive oil, extra virgin
  "otet": { src: "ciqual", code: 11018, kcal: 22.5, protein_g: 0.04, carbs_g: 0.95, fat_g: 0.1 }, // Vinegar
  "otet-mere": { src: "usda", code: 173469, kcal: 21, protein_g: 0, carbs_g: 0.93, fat_g: 0 }, // Vinegar, cider
  "sare": { src: "ciqual", code: 11058, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, // Salt, white (sea, igneous or rock), iodine added, no fluride added
  "sare-grunjoasa": { src: "ciqual", code: 11017, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, // Salt, white (sea, igneous or rock), no fortification
  "piper-negru-macinat": { src: "ciqual", code: 11015, kcal: 331, protein_g: 13.3, carbs_g: 39.9, fat_g: 7.5 }, // Black pepper, powder
  "piper-boabe": { src: "ciqual", code: 11015, kcal: 331, protein_g: 13.3, carbs_g: 39.9, fat_g: 7.5 }, // Black pepper, powder
  "boia-dulce": { src: "ciqual", code: 11049, kcal: 318, protein_g: 14.1, carbs_g: 18.8, fat_g: 12.9 }, // Paprika, powder
  "boia-iute": { src: "ciqual", code: 11088, kcal: 376, protein_g: 12, carbs_g: 29.4, fat_g: 17.3 }, // aproape: Cayenne pepper, powder
  "boia-afumata": { src: "ciqual", code: 11049, kcal: 318, protein_g: 14.1, carbs_g: 18.8, fat_g: 12.9 }, // aproape: Paprika, powder
  "cimbru-uscat": { src: "ciqual", code: 11038, kcal: 285, protein_g: 9.11, carbs_g: 26.9, fat_g: 7.43 }, // Thyme, dried
  "oregano": { src: "ciqual", code: 11035, kcal: 265, protein_g: 9, carbs_g: 26.4, fat_g: 4.28 }, // Oregano, dried
  "busuioc-uscat": { src: "ciqual", code: 11032, kcal: 244, protein_g: 23, carbs_g: 10.1, fat_g: 4.07 }, // Basil, dried
  "dafin": { src: "ciqual", code: 11053, kcal: 353, protein_g: 7.61, carbs_g: 48.6, fat_g: 8.36 }, // Bay, leaves
  "chimen": { src: "ciqual", code: 11042, kcal: 427, protein_g: 17.8, carbs_g: 33.7, fat_g: 22.3 }, // Cumin, seed
  "coriandru": { src: "ciqual", code: 11026, kcal: 345, protein_g: 12.4, carbs_g: 13, fat_g: 17.8 }, // Coriander, seed
  "scortisoara": { src: "ciqual", code: 11025, kcal: 243, protein_g: 3.99, carbs_g: 27.5, fat_g: 1.24 }, // Cinnamon, powder
  "cuisoare": { src: "ciqual", code: 11052, kcal: 335, protein_g: 5.97, carbs_g: 31.6, fat_g: 13 }, // Cloves
  "nucsoara": { src: "ciqual", code: 11048, kcal: 506, protein_g: 5.84, carbs_g: 27.4, fat_g: 36.3 }, // Nutmeg
  "ienibahar": { src: "usda", code: 171315, kcal: 263, protein_g: 6.09, carbs_g: 50.52, fat_g: 8.69 }, // Spices, allspice, ground
  "curry": { src: "ciqual", code: 11005, kcal: 301, protein_g: 14.5, carbs_g: 2.63, fat_g: 14 }, // Curry, powder
  "cub-supa": { src: "ciqual", code: 11001, kcal: 232, protein_g: 10.2, carbs_g: 18, fat_g: 13.3 }, // aproape: Broth or stock, beef, dehydrated
  "tarhon": { src: "ciqual", code: 11050, kcal: 342, protein_g: 22.8, carbs_g: 42.8, fat_g: 7.24 }, // Tarragon, dried
  "marar-uscat": { src: "ciqual", code: 11063, kcal: 315, protein_g: 20, carbs_g: 42.2, fat_g: 4.36 }, // Dill, dried
  "sos-soia": { src: "ciqual", code: 11104, kcal: 39.9, protein_g: 7.25, carbs_g: 1.72, fat_g: 0 }, // Soy sauce, prepacked
  "ardei-iute-uscat": { src: "ciqual", code: 11088, kcal: 376, protein_g: 12, carbs_g: 29.4, fat_g: 17.3 }, // aproape: Cayenne pepper, powder
  "mazare-congelata": { src: "ciqual", code: 20084, kcal: 77.9, protein_g: 5.86, carbs_g: 9.5, fat_g: 0.4 }, // Garden peas, frozen, raw
  "fasole-verde-congelata": { src: "ciqual", code: 20070, kcal: 33.1, protein_g: 1.79, carbs_g: 4.76, fat_g: 0.21 }, // French bean, frozen, raw
  "legume-mix-congelate": { src: "ciqual", code: 20101, kcal: 65.1, protein_g: 2.26, carbs_g: 5.71, fat_g: 2.65 }, // Mixed vegetables, frozen, raw
  "spanac-congelat": { src: "ciqual", code: 20083, kcal: 28, protein_g: 3.32, carbs_g: 1, fat_g: 0.54 }, // Spinach, frozen, raw
  "cartofi-prajiti-congelati": { src: "ciqual", code: 4044, kcal: 142, protein_g: 2.38, carbs_g: 21, fat_g: 4.73 }, // French fries or chips, frozen, pre-fried, raw, to cook in the oven
  "fructe-padure-congelate": { src: "usda", code: 168209, kcal: 56, protein_g: 1.15, carbs_g: 8.25, fat_g: 0.81 }, // aproape: Raspberries, frozen, red, unsweetened
  "inghetata": { src: "ciqual", code: 39515, kcal: 191, protein_g: 2.55, carbs_g: 26.1, fat_g: 8.4 }, // Ice cream, in box
  "pizza-congelata": { src: "ciqual", code: 25516, kcal: 234, protein_g: 10, carbs_g: 27.4, fat_g: 8.88 }, // aproape: Pizza (average)
  "file-peste-pane": { src: "ciqual", code: 26029, kcal: 163, protein_g: 11, carbs_g: 15.6, fat_g: 6.14 }, // Fish, breaded, frozen, raw
  "aluat-foietaj": { src: "ciqual", code: 23420, kcal: 385, protein_g: 5.75, carbs_g: 41, fat_g: 21.4 }, // Puff pastry, with vegetal fat, prepacked, raw
  "pelmeni": { src: "ciqual", code: 25157, kcal: 265, protein_g: 11.4, carbs_g: 40.3, fat_g: 5.79 }, // aproape: Fresh pasta, stuffed with meat (e.g. bolognese-style ravioli), prepacked, raw
  "broccoli-congelat": { src: "ciqual", code: 20204, kcal: 26.4, protein_g: 2.78, carbs_g: 1.5, fat_g: 0.42 }, // Broccoli, frozen, raw
  "conopida-congelata": { src: "ciqual", code: 20082, kcal: 25.1, protein_g: 2.01, carbs_g: 2.5, fat_g: 0.27 }, // Cauliflower, frozen, raw
  "porumb-congelat": { src: "ciqual", code: 20233, kcal: 105, protein_g: 3.28, carbs_g: 19.8, fat_g: 0.78 }, // Corn, frozen, raw
  "ardei-congelat": { src: "ciqual", code: 20041, kcal: 22.6, protein_g: 0.8, carbs_g: 3.5, fat_g: 0.27 }, // aproape: Sweet pepper, green, yellow or red, raw
  "apa-plata": { src: "ciqual", code: 18045, kcal: 0.025, protein_g: 0, carbs_g: 0.006, fat_g: 0 }, // Mineral still water, bottled (average)
  "apa-minerala": { src: "ciqual", code: 18046, kcal: 0.018, protein_g: 0, carbs_g: 0.005, fat_g: 0 }, // Mineral sparkling water, bottled (average)
  "apa-aromatizata": { src: "ciqual", code: 18028, kcal: 0.096, protein_g: 0, carbs_g: 0.026, fat_g: 0 }, // Bottled water, flavoured, no added sugars and no sweetener(s)
  "suc-portocale": { src: "ciqual", code: 2070, kcal: 45.4, protein_g: 0.61, carbs_g: 9.61, fat_g: 0.11 }, // Orange juice, pure juice
  "suc-mere": { src: "ciqual", code: 2074, kcal: 48.9, protein_g: 0.17, carbs_g: 11.4, fat_g: 0.14 }, // Apple juice, pure juice
  "suc-caise": { src: "ciqual", code: 2043, kcal: 58.6, protein_g: 0.21, carbs_g: 13.7, fat_g: 0.03 }, // aproape: Apricot nectar
  "suc-multifructe": { src: "ciqual", code: 2035, kcal: 46.5, protein_g: 0.25, carbs_g: 11.2, fat_g: 0 }, // Multifruit juice, pure juice, standard
  "limonada": { src: "ciqual", code: 18010, kcal: 33, protein_g: 0, carbs_g: 8.24, fat_g: 0 }, // Lemonade, with sugar(s)
  "bautura-carbogazoasa": { src: "ciqual", code: 18026, kcal: 34.5, protein_g: 0.002, carbs_g: 8.28, fat_g: 0.043 }, // aproape: Carbonated beverage or soft drink, without fruit, with sugar(s)
  "cafea-macinata": { src: "ciqual", code: 18003, kcal: 341, protein_g: 13.9, carbs_g: 20.3, fat_g: 13.9 }, // Coffee, ground
  "cafea-boabe": { src: "ciqual", code: 18003, kcal: 341, protein_g: 13.9, carbs_g: 20.3, fat_g: 13.9 }, // aproape: Coffee, ground
  "cafea-instant": { src: "ciqual", code: 18005, kcal: 291, protein_g: 18.5, carbs_g: 41.9, fat_g: 1.1 }, // Coffee, powder, instant
  "ceai-negru": { src: "ciqual", code: 18076, kcal: 232, protein_g: 19.4, carbs_g: 6.3, fat_g: 2 }, // Tea leaf
  "ceai-plante": { src: "ciqual", code: 18022, kcal: 0.8, protein_g: 0, carbs_g: 0.2, fat_g: 0 }, // aproape: Infusion, brewed, no added sugars
  "ceai-tei": { src: "ciqual", code: 18022, kcal: 0.8, protein_g: 0, carbs_g: 0.2, fat_g: 0 }, // aproape: Infusion, brewed, no added sugars
  "bere": { src: "ciqual", code: 5001, kcal: 39, protein_g: 0.39, carbs_g: 3.12, fat_g: 0 }, // Beer, regular (4-5° alcohol)
  "bere-doza": { src: "ciqual", code: 5001, kcal: 39, protein_g: 0.39, carbs_g: 3.12, fat_g: 0 }, // Beer, regular (4-5° alcohol)
  "vin-alb": { src: "ciqual", code: 5215, kcal: 55.3, protein_g: 0.25, carbs_g: 0.17, fat_g: 0 }, // Wine, white, dry
  "vin-rosu": { src: "ciqual", code: 5214, kcal: 75.7, protein_g: 0.16, carbs_g: 0, fat_g: 0 }, // Wine, red
  "tuica": { src: "ciqual", code: 1001, kcal: 233, protein_g: 0, carbs_g: 0.63, fat_g: 0 }, // aproape: Fruit brandy or eau-de-vie
  "socata": { src: "ciqual", code: 18058, kcal: 31.2, protein_g: 0.055, carbs_g: 7.7, fat_g: 0 }, // aproape: Syrup (eg. Mint, strawberry etc.), with sugar(s), diluted in water
  "siropuri": { src: "ciqual", code: 18017, kcal: 252, protein_g: 0.25, carbs_g: 62.5, fat_g: 0 }, // Syrup, to be diluted, with sugar(s)
  "ciocolata": { src: "ciqual", code: 31004, kcal: 550, protein_g: 7.5, carbs_g: 58.9, fat_g: 30.8 }, // Milk chocolate, bar
  "ciocolata-neagra": { src: "ciqual", code: 31074, kcal: 591, protein_g: 10.4, carbs_g: 26.9, fat_g: 46.3 }, // Dark chocolate, 70% cocoa, bar
  "biscuiti": { src: "ciqual", code: 24001, kcal: 438, protein_g: 7.13, carbs_g: 74.9, fat_g: 11.5 }, // Biscuit (cookie), plain
  "biscuiti-crema": { src: "ciqual", code: 24224, kcal: 480, protein_g: 5.06, carbs_g: 69.2, fat_g: 19.6 }, // aproape: Chocolate biscuit (cookie), with vanilla filling, round, black and white
  "napolitane": { src: "ciqual", code: 24313, kcal: 538, protein_g: 5.75, carbs_g: 60.1, fat_g: 30.1 }, // aproape: Wafer biscuit, with vanilla filling
  "chipsuri": { src: "ciqual", code: 4004, kcal: 532, protein_g: 6, carbs_g: 51, fat_g: 32.7 }, // Potato, crisps, plain or flavoured, standard
  "covrigei": { src: "ciqual", code: 38107, kcal: 376, protein_g: 11.2, carbs_g: 73.7, fat_g: 3.13 }, // Salty snacks, crackers, mini pretzels or sticks
  "seminte-prajite": { src: "ciqual", code: 15045, kcal: 626, protein_g: 21.2, carbs_g: 12.7, fat_g: 51 }, // Sunflower seed, grilled, salted
  "seminte-dovleac-prajite": { src: "usda", code: 168601, kcal: 446, protein_g: 18.55, carbs_g: 35.35, fat_g: 19.4 }, // aproape: Seeds, pumpkin and squash seeds, whole, roasted, with salt added
  "halva": { src: "usda", code: 167996, kcal: 469, protein_g: 12.49, carbs_g: 55.99, fat_g: 21.52 }, // Candies, halavah, plain
  "floricele": { src: "ciqual", code: 9230, kcal: 477, protein_g: 8.3, carbs_g: 50.2, fat_g: 24.6 }, // aproape: Pop-corn or popped maize, with oil, salted
  "jeleuri": { src: "ciqual", code: 31060, kcal: 339, protein_g: 4.88, carbs_g: 76.9, fat_g: 0.53 }, // Jelly candy
  "bomboane": { src: "ciqual", code: 31059, kcal: 384, protein_g: 0.16, carbs_g: 95.3, fat_g: 0.18 }, // aproape: Hard candy and lollipop
  "batoane-cereale": { src: "ciqual", code: 31113, kcal: 379, protein_g: 5.49, carbs_g: 74.1, fat_g: 7.07 }, // Cereal bar with fruit
  "piure-fructe-copii": { src: "ciqual", code: 13158, kcal: 49.2, protein_g: 0.29, carbs_g: 10.9, fat_g: 0 }, // Baby food jar, fruits without banana
  "cereale-copii": { src: "ciqual", code: 13167, kcal: 393, protein_g: 5.1, carbs_g: 88.3, fat_g: 1.7 }, // aproape: Baby instant cereal (powder to be reconstituted), from 4/6 months
  "lapte-formula": { src: "ciqual", code: 3000, kcal: 496, protein_g: 10.9, carbs_g: 55, fat_g: 25.3 }, // Baby milk, infant formula, powder
  "biscuiti-copii": { src: "ciqual", code: 24001, kcal: 438, protein_g: 7.13, carbs_g: 74.9, fat_g: 11.5 }, // aproape: Biscuit (cookie), plain
};

// DE COMPLETAT (fără corespondent în CIQUAL sau USDA, ori nealimentare):
// usturoi-verde, patrunjel-radacina, loboda, leustean, telina-frunze, catina
// leurda, sorici, oase-pentru-supa, halloumi, pastrama
// pastrama-oaie, salam-biscuit, rulada, piftie, blat-pizza, esenta-rom
// frisca-praf, zacusca, muraturi-asortate, gogonele, pasta-ardei, lutenita
// delikat, bors, leustean-uscat, amestec-mexican, placinta-congelata, rahat
// pufuleti, fructe-uscate-mix, scutece, servetele-umede, iaurt-copii, sampon-copii
// crema-scutec, gel-dus-copii, suzete
