import { z } from "zod";
import type { Product, ProductVariant, RetailerKind } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { buildIndex, normalize, type SearchDoc, type SearchIndex } from "@/lib/domain/search";
import { type AppCtx, UserError, w } from "./context";
import { parse, parsePatch, zEan, zName, zQuantity, zUnit } from "./validation";
import { visible } from "./queries";

// Produse proprii, magazine (piețe, producători) și indexul de căutare.
// Cu `global: true`, administratorii aplicației modifică catalogul comun
// (serverul verifică dreptul prin RLS).

const productInput = z.object({
  name: zName(120, "Denumirea produsului"),
  category_id: z.string().min(1, "Alege o categorie."),
  subcategory: z.string().trim().max(60).nullable().default(null),
  default_unit: zUnit,
  ean: zEan.nullable().default(null),
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
  await insertRow(ctx.db, "products", { id, household_id, brand_id: null, piece_grams: null, grams_per_ml: null, ...fields }, w(ctx));
  for (const alias of aliases) await insertRow(ctx.db, "product_aliases", { id: newId(), household_id, product_id: id, alias }, w(ctx));
  return id;
}

export async function updateProduct(ctx: AppCtx, id: string, patch: Partial<ProductInput>) {
  const v = parsePatch(productInput, patch);
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

// Variantele comerciale (.tasks/007): marca, denumirea de pe ambalaj,
// conținutul net și codul de bare, doar cum le scrie omul.

const variantPatch = z.object({
  brand: z.string().trim().max(80, "Marca poate avea cel mult 80 de caractere.").nullable(),
  name: zName(120, "Numele de pe ambalaj"),
  net_quantity: zQuantity.nullable(),
  net_unit: z.enum(["g", "kg", "ml", "l"]).nullable(),
  ean: zEan.nullable(),
}).partial();
const variantFields = variantPatch.required({ name: true }).extend({
  brand: variantPatch.shape.brand.default(null),
  net_quantity: variantPatch.shape.net_quantity.default(null),
  net_unit: variantPatch.shape.net_unit.default(null),
  ean: variantPatch.shape.ean.default(null),
});
const NET_BOTH = "Scrie și cantitatea, și unitatea ambalajului (de exemplu 300 g).";

export type VariantInput = z.input<typeof variantFields> & { product_id: string };

/** Marca după nume (fără diacritice și majuscule); dacă nu există, se adaugă în același catalog ca varianta. */
async function brandId(ctx: AppCtx, name: string | null, household_id: string | null): Promise<string | null> {
  if (!name) return null;
  const same = (await visible(ctx.db, "brands", ctx.householdId)).find(
    (b) => normalize(b.name) === normalize(name) && (b.household_id === null || b.household_id === household_id),
  );
  if (same) return same.id;
  const id = newId();
  await insertRow(ctx.db, "brands", { id, household_id, name }, w(ctx));
  return id;
}

async function checkEan(ctx: AppCtx, ean: string | null, household_id: string | null, exceptId?: string) {
  if (!ean) return;
  const taken = (await visible(ctx.db, "product_variants", ctx.householdId)).some((v) => v.ean === ean && v.household_id === household_id && v.id !== exceptId);
  if (taken) throw new UserError("Codul de bare e deja la altă variantă.");
}

/** Variantă nouă: a gospodăriei sau, cu `global: true`, în catalogul comun (doar administratorii). */
export async function createVariant(ctx: AppCtx, input: VariantInput, opts: { global?: boolean } = {}): Promise<string> {
  const v = parse(variantFields, input);
  if ((v.net_quantity == null) !== (v.net_unit == null)) throw new UserError(NET_BOTH);
  const product = await ctx.db.products.get(input.product_id);
  if (!product || product.deleted_at) throw new UserError("Produsul nu există în catalog.");
  const household_id = opts.global ? null : ctx.householdId;
  // Catalogul comun nu poate trimite la un produs al unei gospodării.
  if (household_id === null && product.household_id !== null) throw new UserError("Produsul nu e în catalogul comun.");
  await checkEan(ctx, v.ean, household_id);
  const id = newId();
  const { brand, ...fields } = v;
  await insertRow(ctx.db, "product_variants", { id, household_id, product_id: product.id, brand_id: await brandId(ctx, brand, household_id), ...fields }, w(ctx));
  return id;
}

export async function updateVariant(ctx: AppCtx, id: string, patch: z.input<typeof variantPatch>) {
  const current = await ctx.db.product_variants.get(id);
  if (!current || current.deleted_at) throw new UserError("Varianta nu mai există.");
  const v = parse(variantPatch, patch);
  const net_quantity = v.net_quantity !== undefined ? v.net_quantity : current.net_quantity;
  const net_unit = v.net_unit !== undefined ? v.net_unit : current.net_unit;
  if ((net_quantity == null) !== (net_unit == null)) throw new UserError(NET_BOTH);
  if (v.ean !== undefined) await checkEan(ctx, v.ean, current.household_id, id);
  const { brand, ...fields } = v;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, x]) => x !== undefined)) as Partial<ProductVariant>;
  if (brand !== undefined) clean.brand_id = await brandId(ctx, brand, current.household_id);
  await updateRow(ctx.db, "product_variants", id, clean, w(ctx));
}

export async function deleteVariant(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "product_variants", id, w(ctx));
}

/**
 * Varianta de pus pe o linie sau pe un preț: trebuie să existe și să fie a
 * produsului. Câmpul se trimite doar când e o variantă, ca rândurile fără
 * variantă să meargă și pe un server fără migrația variantelor.
 */
export async function variantField(ctx: AppCtx, variantId: string | null | undefined, productId: string | null): Promise<{ variant_id?: string }> {
  if (!variantId) return {};
  const v = await ctx.db.product_variants.get(variantId);
  if (!v || v.deleted_at || v.product_id !== productId) throw new UserError("Varianta aleasă nu mai există la acest produs.");
  return { variant_id: v.id };
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
  const v = parsePatch(retailerInput, patch);
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
  const v = parsePatch(categoryInput, patch);
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
