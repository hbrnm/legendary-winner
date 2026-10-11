// Tipurile entităților persistate. Câmpurile sunt în snake_case, identic cu
// coloanele din Postgres, ca să nu existe un strat de conversie între
// IndexedDB, sincronizare și Supabase.

export type ISODate = string; // "2026-10-11"
export type ISODateTime = string; // "2026-10-11T08:30:00.000Z"

export type UnitCode =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "buc"
  | "legatura"
  | "caserola"
  | "borcan"
  | "punga"
  | "pachet"
  | "sticla"
  | "cutie"
  | "conserva"
  | "plic"
  | "rola"
  | "lingura"
  | "lingurita"
  | "cana"
  | "catel"
  | "felie";

/** Cele 14 grupe de alergeni din Regulamentul UE 1169/2011. */
export type Allergen =
  | "gluten"
  | "crustacee"
  | "oua"
  | "peste"
  | "arahide"
  | "soia"
  | "lapte"
  | "fructe_coaja"
  | "telina"
  | "mustar"
  | "susan"
  | "sulfiti"
  | "lupin"
  | "moluste";

export type PurchaseSource = "supermarket" | "piata" | "producator" | "alta";

export type Role = "owner" | "admin" | "member";

/** Câmpuri comune tuturor rândurilor sincronizate. */
export interface SyncedRow {
  id: string;
  /** null = date de referință globale (catalog), altfel rândul aparține gospodăriei. */
  household_id: string | null;
  created_at: ISODateTime;
  /** Setat de server la fiecare scriere; pe client, ora ultimei modificări locale. */
  updated_at: ISODateTime;
  /** Ștergere logică, ca ștergerea să ajungă la ceilalți membri. */
  deleted_at: ISODateTime | null;
}

export interface ProductCategory extends SyncedRow {
  name: string;
  icon: string;
  sort_order: number;
  /** false pentru curățenie, igienă etc.; folosit la bugetul „alimente”. */
  is_food: boolean;
}

export interface Product extends SyncedRow {
  name: string;
  category_id: string;
  subcategory: string | null;
  default_unit: UnitCode;
  brand_id: string | null;
  ean: string | null;
  /** Lunile de sezon (1–12), goală dacă e disponibil tot anul. */
  season_months: number[];
  is_traditional: boolean;
  /** Se cumpără de obicei la piață sau de la producător. */
  is_market_typical: boolean;
  allergens: Allergen[];
  /** Greutatea aproximativă a unei bucăți (g), pentru conversia buc ↔ kg; null = nu se convertește. */
  piece_grams: number | null;
}

export interface ProductAlias extends SyncedRow {
  product_id: string;
  alias: string;
}

export interface Brand extends SyncedRow {
  name: string;
}

export type RetailerKind = "supermarket" | "hipermarket" | "discount" | "cash_carry" | "proximitate" | "piata" | "producator" | "alta";

export interface Retailer extends SyncedRow {
  name: string;
  kind: RetailerKind;
  /** Pentru piețe și producători: localitate, tarabă, telefon (opțional, introdus de utilizator). */
  details: string | null;
}

export interface ProductRetailerMapping extends SyncedRow {
  product_id: string;
  retailer_id: string;
  /** Denumirea din magazinul respectiv (varianta comercială). */
  retailer_product_name: string;
  ean: string | null;
}

export type PriceType = "platit" | "observat" | "promotie" | "estimat";
export type PriceConfidence = "ridicata" | "medie" | "scazuta";

export interface ProductPrice extends SyncedRow {
  product_id: string;
  retailer_id: string | null;
  source: PurchaseSource;
  /** Suma plătită/observată pentru `quantity` × `unit`. */
  amount: number;
  currency: "RON";
  quantity: number;
  unit: UnitCode;
  price_type: PriceType;
  confidence: PriceConfidence;
  observed_on: ISODate;
  /** Linia de tranzacție din care a provenit prețul, dacă e cazul. */
  transaction_item_id: string | null;
}

export type Priority = "normala" | "ridicata";

export interface ShoppingList extends SyncedRow {
  name: string;
  is_recurring: boolean;
  /** Numărul turei de cumpărături; crește la fiecare finalizare. */
  cycle: number;
  archived_at: ISODateTime | null;
  default_retailer_id: string | null;
  sort_order: number;
}

export type ItemOrigin = "manual" | "reteta" | "plan" | "recurent";

export interface ShoppingListItem extends SyncedRow {
  list_id: string;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: UnitCode | null;
  category_id: string;
  /** Estimare introdusă manual pentru toată linia; altfel se calculează din prețuri. */
  estimated_price: number | null;
  /** Suma plătită efectiv pentru toată linia. */
  actual_price: number | null;
  retailer_id: string | null;
  source: PurchaseSource;
  priority: Priority;
  note: string | null;
  checked: boolean;
  checked_at: ISODateTime | null;
  checked_by: string | null;
  origin: ItemOrigin;
  sort_order: number;
}

export interface ShoppingTransaction extends SyncedRow {
  list_id: string | null;
  list_cycle: number | null;
  started_at: ISODateTime;
  /** null = cumpărături în desfășurare. */
  completed_at: ISODateTime | null;
  note: string | null;
}

export interface ShoppingTransactionItem extends SyncedRow {
  transaction_id: string;
  list_item_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: UnitCode | null;
  category_id: string;
  amount: number | null;
  retailer_id: string | null;
  source: PurchaseSource;
  purchased_at: ISODateTime;
}

export type Difficulty = "usor" | "mediu" | "dificil";

export type RecipeCategoryId =
  | "mic_dejun"
  | "pranz"
  | "cina"
  | "gustari"
  | "supe_ciorbe"
  | "traditionale"
  | "carne"
  | "peste"
  | "vegetariene"
  | "salate"
  | "deserturi"
  | "rapide"
  | "meal_prep";

export interface Recipe extends SyncedRow {
  name: string;
  description: string;
  categories: RecipeCategoryId[];
  cuisine: "romaneasca" | "internationala";
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: Difficulty;
  image_url: string | null;
  /** Valori nutriționale per porție, doar dacă provin dintr-o sursă verificată. */
  nutrition: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

export interface RecipeIngredient extends SyncedRow {
  recipe_id: string;
  product_id: string;
  /** null = „după gust”, nu intră în cost și nici în lista de cumpărături. */
  quantity: number | null;
  unit: UnitCode | null;
  note: string | null;
  optional: boolean;
  sort_order: number;
}

export interface RecipeStep extends SyncedRow {
  recipe_id: string;
  position: number;
  text: string;
}

export interface FavoriteRecipe extends SyncedRow {
  recipe_id: string;
}

export type MealSlot = "mic_dejun" | "pranz" | "cina" | "gustare";

export interface MealPlanItem extends SyncedRow {
  date: ISODate;
  slot: MealSlot;
  recipe_id: string;
  servings: number;
  note: string | null;
}

export interface PantryLocation extends SyncedRow {
  name: string;
  sort_order: number;
}

export interface PantryItem extends SyncedRow {
  product_id: string | null;
  name: string;
  quantity: number;
  unit: UnitCode;
  location_id: string;
  purchased_on: ISODate | null;
  expires_on: ISODate | null;
  note: string | null;
}

export type BudgetPeriod = "lunar" | "saptamanal";
export type BudgetScope =
  | { kind: "total" }
  | { kind: "alimente" }
  | { kind: "nealimentare" }
  | { kind: "sursa"; source: PurchaseSource }
  | { kind: "categorie"; category_id: string }
  | { kind: "magazin"; retailer_id: string };

export interface Budget extends SyncedRow {
  name: string;
  period: BudgetPeriod;
  scope: BudgetScope;
  amount: number;
  active: boolean;
}

export type PantryOnPurchase = "intreaba" | "mereu" | "niciodata";

/** Setările gospodăriei (o singură linie per gospodărie). */
export interface HouseholdSettings extends SyncedRow {
  pantry_on_purchase: PantryOnPurchase;
  week_starts_on: 1;
}
