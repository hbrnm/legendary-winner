import type { Allergen, Difficulty, RecipeCategoryId, RetailerKind, UnitCode } from "@/lib/domain/types";

// Formatul compact în care se scrie catalogul inițial. Din el se construiesc
// rândurile pentru IndexedDB (src/data/catalog.ts) și seed-ul SQL
// (scripts/generate-seed-sql.ts). Nu conține prețuri: prețurile vin doar
// de la utilizatori.

export type CategoryId =
  | "fructe"
  | "legume"
  | "carne"
  | "peste"
  | "lactate"
  | "branzeturi"
  | "oua"
  | "mezeluri"
  | "panificatie"
  | "cereale-paste"
  | "copt"
  | "conserve"
  | "uleiuri-condimente"
  | "congelate"
  | "bauturi"
  | "dulciuri-gustari"
  | "copii"
  | "curatenie"
  | "igiena"
  | "diverse";

export interface CategorySeed {
  id: CategoryId;
  name: string;
  /** Numele unei pictograme lucide-react. */
  icon: string;
  is_food: boolean;
}

export interface ProductSeed {
  /** Identificator stabil: litere mici fără diacritice, cifre și cratimă (ex. "ardei-kapia"). */
  id: string;
  /** Denumirea afișată, cu diacritice. */
  name: string;
  category: CategoryId;
  /** Subcategorie liberă (ex. "Rădăcinoase", "Verdețuri"). */
  sub?: string;
  /** Unitatea în care se cumpără de obicei. */
  unit: UnitCode;
  /** Sinonime, forme de singular/plural, denumiri regionale. Fără diacritice nu e nevoie: căutarea le ignoră. */
  aliases?: string[];
  /** Lunile de sezon în România (1–12). Lipsă = tot anul. */
  season?: number[];
  traditional?: boolean;
  /** Se cumpără des la piață sau de la producători. */
  market?: boolean;
  allergens?: Allergen[];
}

export interface RecipeIngredientSeed {
  /** id-ul produsului din catalog. */
  p: string;
  /** Cantitatea pentru numărul de porții al rețetei; null = „după gust”. */
  q: number | null;
  u: UnitCode | null;
  note?: string;
  opt?: boolean;
}

export interface RecipeSeed {
  id: string;
  name: string;
  description: string;
  categories: RecipeCategoryId[];
  cuisine: "romaneasca" | "internationala";
  servings: number;
  prep: number;
  cook: number;
  difficulty: Difficulty;
  ingredients: RecipeIngredientSeed[];
  steps: string[];
}

export interface RetailerSeed {
  id: string;
  name: string;
  kind: RetailerKind;
}
