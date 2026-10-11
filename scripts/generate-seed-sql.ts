// Generează supabase/seed.sql din catalogul din src/data.
// Rulare: npm run seed:sql. Testul src/data/catalog.test.ts verifică că
// fișierul comis e la zi.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCatalog, type Catalog } from "../src/data/catalog";

function literal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    return `array[${v.map(literal).join(", ")}]`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const COLUMNS: { [K in keyof Catalog]: string[] } = {
  product_categories: ["id", "name", "icon", "sort_order", "is_food"],
  products: ["id", "name", "category_id", "subcategory", "default_unit", "season_months", "is_traditional", "is_market_typical", "allergens"],
  product_aliases: ["id", "product_id", "alias"],
  retailers: ["id", "name", "kind"],
  pantry_locations: ["id", "name", "sort_order"],
  recipes: ["id", "name", "description", "categories", "cuisine", "servings", "prep_minutes", "cook_minutes", "difficulty"],
  recipe_ingredients: ["id", "recipe_id", "product_id", "quantity", "unit", "note", "optional", "sort_order"],
  recipe_steps: ["id", "recipe_id", "position", "text"],
};

const CASTS: Record<string, string> = { season_months: "::smallint[]", allergens: "::text[]", categories: "::text[]" };

export function seedSql(): string {
  const catalog = buildCatalog();
  const out: string[] = [
    "-- Generat de scripts/generate-seed-sql.ts din src/data. Nu edita de mână.",
    "-- Catalogul inițial: categorii, produse, sinonime, magazine, locuri de depozitare, rețete.",
    "-- Fără prețuri: prețurile vin doar de la gospodării.",
    "",
  ];
  for (const table of Object.keys(COLUMNS) as (keyof Catalog)[]) {
    const cols = COLUMNS[table];
    const rows = catalog[table] as unknown as Record<string, unknown>[];
    if (rows.length === 0) continue;
    out.push(`insert into public.${table} (${cols.join(", ")}, created_at, updated_at) values`);
    out.push(
      rows
        .map((r) => {
          const values = cols.map((c) => {
            const v = r[c];
            const lit = literal(v);
            return Array.isArray(v) && CASTS[c] ? `${lit}${CASTS[c]}` : lit;
          });
          return `  (${values.join(", ")}, ${literal(r.created_at)}, ${literal(r.updated_at)})`;
        })
        .join(",\n"),
    );
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`);
    out.push(`on conflict (id) do update set ${updates.join(", ")}, deleted_at = null;`, "");
  }
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(new URL("../supabase/seed.sql", import.meta.url), seedSql());
  console.log("supabase/seed.sql actualizat");
}
