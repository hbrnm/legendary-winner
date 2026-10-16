import { CamaraDB, type TableName, getMeta, setMeta } from "@/lib/db/database";
import { buildCatalog, CATALOG_VERSION, type Catalog } from "@/data/catalog";
import { insertRow } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { seedDemoExample } from "./demo-seed";

/**
 * Încarcă catalogul inițial (produse, rețete etc.) în baza locală, o singură
 * dată per versiune. Nu suprascrie rândurile mai noi venite de la server
 * (ex. un produs corectat de administrator).
 */
export async function seedCatalog(db: CamaraDB): Promise<void> {
  if ((await getMeta<string>(db, "catalog_version")) === CATALOG_VERSION) return;
  const catalog = buildCatalog();
  for (const table of Object.keys(catalog) as (keyof Catalog & TableName)[]) {
    const rows = catalog[table] as unknown as { id: string; updated_at: string }[];
    await db.transaction("rw", db.table(table), async () => {
      const existing = new Map(((await db.table(table).bulkGet(rows.map((r) => r.id))) as ({ updated_at: string } | undefined)[]).map((r, i) => [rows[i].id, r]));
      const fresh = rows.filter((r) => {
        const e = existing.get(r.id);
        return !e || e.updated_at <= r.updated_at;
      });
      await db.table(table).bulkPut(fresh);
    });
  }
  await setMeta(db, "catalog_version", CATALOG_VERSION);
}

export const DEMO_HOUSEHOLD_ID = "00000000-0000-4000-8000-0000000000d1";
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000000a1";

/**
 * Modul demonstrativ: o gospodărie locală, cu o listă. Cu `example`, la prima
 * pornire se umple cu gospodăria model (date de exemplu, doar pe dispozitiv);
 * fără, lista rămâne goală (testele end-to-end pornesc de la zero).
 */
export async function ensureDemoHousehold(db: CamaraDB, opts: { example?: boolean } = {}): Promise<void> {
  if (await getMeta(db, "demo_ready")) return;
  const write = { outbox: false };
  await db.household_settings.put({
    id: DEMO_HOUSEHOLD_ID,
    household_id: DEMO_HOUSEHOLD_ID,
    pantry_on_purchase: "intreaba",
    week_starts_on: 1,
    created_at: CATALOG_VERSION,
    updated_at: CATALOG_VERSION,
    deleted_at: null,
  });
  await insertRow(
    db,
    "shopping_lists",
    { id: newId(), household_id: DEMO_HOUSEHOLD_ID, name: "Cumpărături săptămânale", is_recurring: true, cycle: 1, archived_at: null, default_retailer_id: null, sort_order: 0 },
    write,
  );
  if (opts.example) await seedDemoExample(db, DEMO_HOUSEHOLD_ID, DEMO_USER_ID);
  await setMeta(db, "demo_ready", true);
}

export function openDatabase(name: string): CamaraDB {
  return new CamaraDB(name);
}
