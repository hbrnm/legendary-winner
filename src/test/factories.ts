import type {
  Budget,
  PantryItem,
  ProductCategory,
  ProductPrice,
  ProductVariant,
  Recipe,
  RecipeIngredient,
  ShoppingListItem,
  ShoppingTransactionItem,
  SyncedRow,
} from "@/lib/domain/types";

let seq = 0;
const T = "2026-03-01T10:00:00.000Z";

function base(over: Partial<SyncedRow> = {}): SyncedRow {
  seq++;
  return { id: `id-${seq}`, household_id: "h1", created_at: T, updated_at: T, deleted_at: null, ...over };
}

export function price(over: Partial<ProductPrice> & Pick<ProductPrice, "product_id" | "amount" | "quantity" | "unit">): ProductPrice {
  return {
    ...base(),
    retailer_id: null,
    source: "supermarket",
    currency: "RON",
    price_type: "platit",
    confidence: "ridicata",
    observed_on: "2026-03-01",
    transaction_item_id: null,
    ...over,
  };
}

export function variant(over: Partial<ProductVariant> & Pick<ProductVariant, "id" | "product_id" | "name">): ProductVariant {
  return { ...base(), brand_id: null, net_quantity: null, net_unit: null, ean: null, ...over };
}

export function listItem(over: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    ...base(),
    list_id: "l1",
    product_id: null,
    name: "Produs",
    quantity: 1,
    unit: "buc",
    category_id: "diverse",
    estimated_price: null,
    actual_price: null,
    retailer_id: null,
    source: "supermarket",
    priority: "normala",
    note: null,
    checked: false,
    checked_at: null,
    checked_by: null,
    origin: "manual",
    sort_order: 0,
    ...over,
  };
}

export function txItem(over: Partial<ShoppingTransactionItem> = {}): ShoppingTransactionItem {
  return {
    ...base(),
    transaction_id: "t1",
    list_item_id: null,
    product_id: null,
    name: "Produs",
    quantity: 1,
    unit: "buc",
    category_id: "diverse",
    amount: 10,
    retailer_id: null,
    source: "supermarket",
    purchased_at: "2026-03-10T09:00:00.000Z",
    ...over,
  };
}

export function category(over: Partial<ProductCategory> & Pick<ProductCategory, "id">): ProductCategory {
  return { ...base({ id: over.id, household_id: null }), name: over.id, icon: "tag", sort_order: 0, is_food: true, ...over };
}

export function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    ...base({ household_id: null }),
    name: "Rețetă",
    description: "",
    categories: ["cina"],
    cuisine: "romaneasca",
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 20,
    difficulty: "usor",
    image_url: null,
    nutrition: null,
    ...over,
  };
}

export function ingredient(over: Partial<RecipeIngredient> & Pick<RecipeIngredient, "recipe_id" | "product_id">): RecipeIngredient {
  return { ...base({ household_id: null }), quantity: 1, unit: "buc", note: null, optional: false, sort_order: 0, ...over };
}

export function pantryItem(over: Partial<PantryItem> & Pick<PantryItem, "product_id">): PantryItem {
  return {
    ...base(),
    name: over.product_id ?? "Produs",
    quantity: 1,
    unit: "buc",
    location_id: "frigider",
    purchased_on: null,
    expires_on: null,
    note: null,
    ...over,
  };
}

export function budget(over: Partial<Budget> = {}): Budget {
  return { ...base(), name: "Buget", period: "lunar", scope: { kind: "total" }, amount: 2000, active: true, ...over };
}
