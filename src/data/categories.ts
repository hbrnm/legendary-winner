import type { CategorySeed } from "./seed-types";

/** Categoriile de cumpărături, în ordinea în care apar în listă (aproximativ ordinea raioanelor). */
export const CATEGORY_SEEDS: CategorySeed[] = [
  { id: "fructe", name: "Fructe", icon: "apple", is_food: true },
  { id: "legume", name: "Legume și verdețuri", icon: "carrot", is_food: true },
  { id: "carne", name: "Carne", icon: "beef", is_food: true },
  { id: "peste", name: "Pește și fructe de mare", icon: "fish", is_food: true },
  { id: "lactate", name: "Lactate", icon: "milk", is_food: true },
  { id: "branzeturi", name: "Brânzeturi", icon: "triangle", is_food: true },
  { id: "oua", name: "Ouă", icon: "egg", is_food: true },
  { id: "mezeluri", name: "Mezeluri", icon: "ham", is_food: true },
  { id: "panificatie", name: "Panificație", icon: "croissant", is_food: true },
  { id: "cereale-paste", name: "Cereale, orez și paste", icon: "wheat", is_food: true },
  { id: "copt", name: "Făină, zahăr și ingrediente de copt", icon: "cake-slice", is_food: true },
  { id: "conserve", name: "Conserve și murături", icon: "cylinder", is_food: true },
  { id: "uleiuri-condimente", name: "Uleiuri și condimente", icon: "droplet", is_food: true },
  { id: "congelate", name: "Produse congelate", icon: "snowflake", is_food: true },
  { id: "bauturi", name: "Băuturi", icon: "cup-soda", is_food: true },
  { id: "dulciuri-gustari", name: "Dulciuri și gustări", icon: "candy", is_food: true },
  { id: "copii", name: "Produse pentru copii", icon: "baby", is_food: true },
  { id: "curatenie", name: "Produse de curățenie", icon: "spray-can", is_food: false },
  { id: "igiena", name: "Igienă personală", icon: "bath", is_food: false },
  { id: "diverse", name: "Diverse", icon: "package", is_food: false },
];
