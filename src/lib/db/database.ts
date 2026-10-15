import Dexie, { type Table } from "dexie";
import type {
  Brand,
  Budget,
  FavoriteRecipe,
  HouseholdSettings,
  MealPlanItem,
  PantryItem,
  PantryLocation,
  Product,
  ProductAlias,
  ProductCategory,
  ProductPrice,
  ProductRetailerMapping,
  Recipe,
  RecipeIngredient,
  RecipePhoto,
  RecipeStep,
  Retailer,
  ShoppingList,
  ShoppingListItem,
  ShoppingTransaction,
  ShoppingTransactionItem,
  SyncedRow,
} from "@/lib/domain/types";

/** Tabelele sincronizate cu Supabase, cu tipul rândurilor lor. */
export interface SyncedTables {
  product_categories: ProductCategory;
  brands: Brand;
  products: Product;
  product_aliases: ProductAlias;
  retailers: Retailer;
  product_retailer_mappings: ProductRetailerMapping;
  pantry_locations: PantryLocation;
  recipes: Recipe;
  recipe_ingredients: RecipeIngredient;
  recipe_steps: RecipeStep;
  recipe_photos: RecipePhoto;
  household_settings: HouseholdSettings;
  shopping_lists: ShoppingList;
  shopping_list_items: ShoppingListItem;
  shopping_transactions: ShoppingTransaction;
  shopping_transaction_items: ShoppingTransactionItem;
  product_prices: ProductPrice;
  favorite_recipes: FavoriteRecipe;
  meal_plan_items: MealPlanItem;
  pantry_items: PantryItem;
  budgets: Budget;
}

export type TableName = keyof SyncedTables;

/**
 * Ordinea contează: la trimiterea către server, părinții (liste, rețete,
 * tranzacții) ajung înaintea copiilor; la tragere, la fel.
 */
export const SYNCED_TABLES: TableName[] = [
  "product_categories",
  "brands",
  "retailers",
  "products",
  "product_aliases",
  "product_retailer_mappings",
  "pantry_locations",
  "recipes",
  "recipe_ingredients",
  "recipe_steps",
  "recipe_photos",
  "household_settings",
  "shopping_lists",
  "shopping_list_items",
  "shopping_transactions",
  "shopping_transaction_items",
  "product_prices",
  "favorite_recipes",
  "meal_plan_items",
  "pantry_items",
  "budgets",
];

/** Tabele cu date de catalog (pot avea household_id NULL). */
export const CATALOG_TABLES = new Set<TableName>([
  "product_categories",
  "brands",
  "retailers",
  "products",
  "product_aliases",
  "product_retailer_mappings",
  "pantry_locations",
  "recipes",
  "recipe_ingredients",
  "recipe_steps",
]);

export interface OutboxEntry {
  seq?: number;
  table: TableName;
  row_id: string;
  /** insert = rândul complet; update = doar câmpurile schimbate. */
  op: "insert" | "update";
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
}

export interface SyncError {
  id?: number;
  table: TableName;
  row_id: string;
  op: "insert" | "update";
  message: string;
  at: string;
}

/**
 * Tabele adăugate după prima publicare: pot lipsi pe server până se aplică
 * migrația lor pe producție. Tragerea le sare atunci, fără eroare.
 */
export const OPTIONAL_TABLES = new Set<TableName>(["recipe_photos"]);

/**
 * Fișierul unei fotografii a gospodăriei, ținut local până ajunge în
 * Storage (apoi trece în cache); în modul demonstrativ rămâne aici.
 * Rândul `recipe_photos` nu pleacă spre server înaintea fișierului.
 */
export interface PhotoFile {
  photo_id: string;
  storage_path: string;
  content_type: "image/webp" | "image/jpeg";
  /** ArrayBuffer, nu Blob: Safari pe iPhone a avut probleme cu Blob în IndexedDB. */
  data: ArrayBuffer;
  created_at: string;
  attempts: number;
}

/** Un fișier de șters din Storage după ce ștergerea logică a rândului a ajuns pe server. */
export interface PhotoRemoval {
  storage_path: string;
  photo_id: string;
  created_at: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class CamaraDB extends Dexie {
  product_categories!: Table<ProductCategory, string>;
  brands!: Table<Brand, string>;
  products!: Table<Product, string>;
  product_aliases!: Table<ProductAlias, string>;
  retailers!: Table<Retailer, string>;
  product_retailer_mappings!: Table<ProductRetailerMapping, string>;
  pantry_locations!: Table<PantryLocation, string>;
  recipes!: Table<Recipe, string>;
  recipe_ingredients!: Table<RecipeIngredient, string>;
  recipe_steps!: Table<RecipeStep, string>;
  recipe_photos!: Table<RecipePhoto, string>;
  household_settings!: Table<HouseholdSettings, string>;
  shopping_lists!: Table<ShoppingList, string>;
  shopping_list_items!: Table<ShoppingListItem, string>;
  shopping_transactions!: Table<ShoppingTransaction, string>;
  shopping_transaction_items!: Table<ShoppingTransactionItem, string>;
  product_prices!: Table<ProductPrice, string>;
  favorite_recipes!: Table<FavoriteRecipe, string>;
  meal_plan_items!: Table<MealPlanItem, string>;
  pantry_items!: Table<PantryItem, string>;
  budgets!: Table<Budget, string>;
  outbox!: Table<OutboxEntry, number>;
  sync_errors!: Table<SyncError, number>;
  meta!: Table<MetaEntry, string>;
  photo_uploads!: Table<PhotoFile, string>;
  photo_removals!: Table<PhotoRemoval, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      product_categories: "&id, household_id",
      brands: "&id, household_id",
      products: "&id, household_id, category_id",
      product_aliases: "&id, household_id, product_id",
      retailers: "&id, household_id",
      product_retailer_mappings: "&id, household_id, product_id",
      pantry_locations: "&id, household_id",
      recipes: "&id, household_id",
      recipe_ingredients: "&id, household_id, recipe_id, product_id",
      recipe_steps: "&id, household_id, recipe_id",
      household_settings: "&id, household_id",
      shopping_lists: "&id, household_id",
      shopping_list_items: "&id, household_id, list_id",
      shopping_transactions: "&id, household_id, list_id",
      shopping_transaction_items: "&id, household_id, transaction_id",
      product_prices: "&id, household_id, product_id",
      favorite_recipes: "&id, household_id, recipe_id",
      meal_plan_items: "&id, household_id, date",
      pantry_items: "&id, household_id, product_id",
      budgets: "&id, household_id",
      outbox: "++seq, [table+row_id]",
      sync_errors: "++id",
      meta: "&key",
    });
    // Fotografiile gospodăriei (.tasks/008, etapa 4); tabelele vechi rămân neschimbate.
    this.version(2).stores({
      recipe_photos: "&id, household_id, recipe_id",
      photo_uploads: "&photo_id",
      photo_removals: "&storage_path",
    });
  }

  table_<T extends TableName>(name: T): Table<SyncedTables[T], string> {
    return this.table(name) as unknown as Table<SyncedTables[T], string>;
  }
}

export type AnyRow = SyncedRow & Record<string, unknown>;

export async function getMeta<T>(db: CamaraDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: CamaraDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
