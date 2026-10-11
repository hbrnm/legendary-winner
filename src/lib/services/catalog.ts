import { z } from "zod";
import type { Product, RetailerKind } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { buildIndex, normalize, type SearchDoc, type SearchIndex } from "@/lib/domain/search";
import { type AppCtx, UserError, w } from "./context";
import { parse, zName, zUnit } from "./validation";
import { visible } from "./queries";

// Produse proprii, magazine (piețe, producători) și indexul de căutare.
// Cu `global: true`, administratorii aplicației modifică catalogul comun
// (serverul verifică dreptul prin RLS).

const productInput = z.object({
  name: zName(120, "Denumirea produsului"),
  category_id: z.string().min(1, "Alege o categorie."),
  subcategory: z.string().trim().max(60).nullable().default(null),
  default_unit: zUnit,
  ean: z
    .string()
    .regex(/^(\d{8}|\d{12,14})$/, "Codul de bare are 8, 12, 13 sau 14 cifre.")
    .nullable()
    .default(null),
  is_market_typical: z.boolean().default(false),
  is_traditional: z.boolean().default(false),
  season_months: z.array(z.number().int().min(1).max(12)).default([]),
  allergens: z.array(z.enum(["gluten", "crustacee", "oua", "peste", "arahide", "soia", "lapte", "fructe_coaja", "telina", "mustar", "susan", "sulfiti", "lupin", "moluste"])).default([]),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});

export type ProductInput = z.input<typeof productInput>;

export async function createProduct(ctx: AppCtx, input: ProductInput, opts: { global?: boolean; id?: string } = {}): Promise<string> {
  const v = parse(productInput, input);
  const existing = await visible(ctx.db, "products", ctx.householdId);
  if (existing.some((p) => normalize(p.name) === normalize(v.name))) throw new UserError(`„${v.name}” există deja în catalog.`);
  const household_id = opts.global ? null : ctx.householdId;
  const id = opts.id ?? newId();
  const { aliases, ...fields } = v;
  await insertRow(ctx.db, "products", { id, household_id, brand_id: null, ...fields }, w(ctx));
  for (const alias of aliases) await insertRow(ctx.db, "product_aliases", { id: newId(), household_id, product_id: id, alias }, w(ctx));
  return id;
}

export async function updateProduct(ctx: AppCtx, id: string, patch: Partial<ProductInput>) {
  const v = parse(productInput.partial(), patch);
  const { aliases, ...fields } = v;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, x]) => x !== undefined)) as Partial<Product>;
  await updateRow(ctx.db, "products", id, clean, w(ctx));
  if (aliases) {
    const product = await ctx.db.products.get(id);
    const current = (await ctx.db.product_aliases.where("product_id").equals(id).toArray()).filter((a) => !a.deleted_at);
    for (const a of current) if (!aliases.includes(a.alias)) await softDelete(ctx.db, "product_aliases", a.id, w(ctx));
    for (const alias of aliases) {
      if (!current.some((a) => a.alias === alias)) await insertRow(ctx.db, "product_aliases", { id: newId(), household_id: product?.household_id ?? null, product_id: id, alias }, w(ctx));
    }
  }
}

export async function deleteProduct(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "products", id, w(ctx));
}

const retailerInput = z.object({
  name: zName(80, "Numele"),
  kind: z.enum(["supermarket", "hipermarket", "discount", "cash_carry", "proximitate", "piata", "producator", "alta"]),
  details: z.string().trim().max(300).nullable().default(null),
});

/** Piața preferată, un producător local sau un magazin care nu e în listă. */
export async function createRetailer(ctx: AppCtx, input: z.input<typeof retailerInput>, opts: { global?: boolean } = {}): Promise<string> {
  const v = parse(retailerInput, input);
  const id = newId();
  await insertRow(ctx.db, "retailers", { id, household_id: opts.global ? null : ctx.householdId, ...v, kind: v.kind as RetailerKind }, w(ctx));
  return id;
}

export async function updateRetailer(ctx: AppCtx, id: string, patch: Partial<z.input<typeof retailerInput>>) {
  const v = parse(retailerInput.partial(), patch);
  await updateRow(ctx.db, "retailers", id, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)), w(ctx));
}

export async function deleteRetailer(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "retailers", id, w(ctx));
}

const categoryInput = z.object({ name: zName(60, "Numele categoriei"), icon: z.string().max(40).default("tag"), is_food: z.boolean().default(true), sort_order: z.number().int().default(500) });

export async function createCategory(ctx: AppCtx, input: z.input<typeof categoryInput>, opts: { global?: boolean } = {}): Promise<string> {
  const v = parse(categoryInput, input);
  const id = newId();
  await insertRow(ctx.db, "product_categories", { id, household_id: opts.global ? null : ctx.householdId, ...v }, w(ctx));
  return id;
}

export async function updateCategory(ctx: AppCtx, id: string, patch: Partial<z.input<typeof categoryInput>>) {
  const v = parse(categoryInput.partial(), patch);
  await updateRow(ctx.db, "product_categories", id, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)), w(ctx));
}

/** Indexul de căutare: denumire, sinonime (globale și ale gospodăriei), categorie, EAN; produsele cumpărate des urcă. */
export async function productSearchIndex(ctx: AppCtx, boosts: Map<string, number> = new Map()): Promise<SearchIndex> {
  const products = await visible(ctx.db, "products", ctx.householdId);
  const aliases = await visible(ctx.db, "product_aliases", ctx.householdId);
  const byProduct = new Map<string, string[]>();
  for (const a of aliases) byProduct.set(a.product_id, [...(byProduct.get(a.product_id) ?? []), a.alias]);
  const docs: SearchDoc[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    terms: [...(byProduct.get(p.id) ?? []), p.ean ?? ""],
    weakTerms: [p.subcategory ?? ""],
    boost: boosts.get(p.id) ?? 0,
  }));
  return buildIndex(docs);
}
