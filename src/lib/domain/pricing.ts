import type { ISODate, ProductPrice, ProductVariant, PurchaseSource, UnitCode } from "./types";
import { convert, convertWithVariant, type ProductUnits } from "./units";
import { roundMoney } from "./money";
import { daysBetween } from "./dates";

/** Un preț mai vechi de atât se folosește, dar e marcat „preț vechi” (decizia proprietarului, 11 oct. 2026). */
export const STALE_AFTER_DAYS = 90;

/**
 * Pentru ce cumpărătură se caută prețul. O linie de listă are magazinul ei
 * și sursa (supermarket, piață…); rețetele și planul nu au context.
 */
export interface PriceContext {
  retailer_id: string | null;
  source: PurchaseSource;
}

/**
 * De unde vine prețul ales:
 * - „magazin”: chiar din magazinul liniei;
 * - „alt_magazin”: linia are un magazin, prețul e din altul de același tip de sursă;
 * - „sursa”: linia nu are magazin, prețul e din aceeași sursă;
 * - „general”: fără context (rețete, plan), din orice sursă.
 */
export type PriceMatch = "magazin" | "alt_magazin" | "sursa" | "general";

/** Prețul unitar cunoscut pentru un produs, cu proveniența lui. */
export interface UnitPrice {
  product_id: string;
  /** RON pentru 1 × `unit`. */
  per_unit: number;
  unit: UnitCode;
  observed_on: ISODate;
  price_id: string;
  retailer_id: string | null;
  source: PurchaseSource;
  match: PriceMatch;
  promo: boolean;
  /** Mai vechi de STALE_AFTER_DAYS față de `today`. */
  stale: boolean;
  /** Varianta comercială a prețului; null = produsul generic. */
  variant_id: string | null;
}

export interface PriceOptions {
  /** Lipsă = estimare generală, din orice sursă. */
  context?: PriceContext | null;
  /** Ziua de azi, pentru marcarea prețurilor vechi. Lipsă = nu se marchează. */
  today?: ISODate | null;
  /** Doar prețurile din magazinul contextului, oricare le-ar fi sursa (comparația pe magazine). */
  retailer_only?: boolean;
  /** Varianta liniei: prețurile ei au întâietate, apoi oricare ale produsului. */
  variant_id?: string | null;
}

/**
 * Prețurile pe produs; opțional, factorii de conversie, ca prețul pe kg să
 * acopere și bucățile sau lingurile, și variantele, pentru ambalaje.
 */
export type PriceIndex = Map<string, ProductPrice[]> & {
  product_units?: ReadonlyMap<string, ProductUnits>;
  variants?: ReadonlyMap<string, ProductVariant>;
};

/**
 * Grupează prețurile pe produs, cele mai noi primele. Prețurile șterse și
 * cele cu cantitate zero se ignoră. Nu există prețuri implicite: un produs
 * fără preț introdus de gospodărie rămâne fără preț.
 */
export function buildPriceIndex(
  prices: ProductPrice[],
  productUnits?: ReadonlyMap<string, ProductUnits>,
  variants?: ReadonlyMap<string, ProductVariant>,
): PriceIndex {
  const index: PriceIndex = new Map();
  if (productUnits) index.product_units = productUnits;
  if (variants) index.variants = variants;
  for (const p of prices) {
    if (p.deleted_at || p.quantity <= 0 || p.amount < 0) continue;
    const list = index.get(p.product_id) ?? [];
    list.push(p);
    index.set(p.product_id, list);
  }
  for (const list of index.values()) {
    list.sort((a, b) => (b.observed_on.localeCompare(a.observed_on)) || b.updated_at.localeCompare(a.updated_at));
  }
  return index;
}

function matchOf(p: ProductPrice, ctx: PriceContext | null | undefined, retailerOnly = false): PriceMatch | null {
  if (!ctx) return "general";
  if (retailerOnly) return ctx.retailer_id && p.retailer_id === ctx.retailer_id ? "magazin" : null;
  if (p.source !== ctx.source) return null;
  if (!ctx.retailer_id) return "sursa";
  return p.retailer_id === ctx.retailer_id ? "magazin" : "alt_magazin";
}

/**
 * Prețul cel mai potrivit, exprimabil în `unit` (sau orice unitate, dacă
 * `unit` lipsește). Ordinea: preț obișnuit din același magazin, preț
 * obișnuit din aceeași sursă, apoi promoțiile în aceeași ordine; în fiecare
 * treaptă, cel mai recent. Prețurile din alte surse nu se folosesc pentru o
 * linie de listă (piața nu estimează un coș de supermarket). Cu
 * `variant_id`, prețurile variantei trec înaintea tuturor celorlalte, în
 * aceeași ordine. Fără preț potrivit, rezultatul e null: nu se inventează nimic.
 */
export function latestUnitPrice(index: PriceIndex, productId: string, unit?: UnitCode | null, opts: PriceOptions = {}): UnitPrice | null {
  const list = index.get(productId);
  if (!list) return null;
  const wanted = opts.variant_id ?? null;
  const rank = (m: PriceMatch, promo: boolean, otherVariant: boolean) => (otherVariant ? 4 : 0) + (promo ? 2 : 0) + (m === "alt_magazin" ? 1 : 0);
  let best: { p: ProductPrice; match: PriceMatch; qty: number; target: UnitCode; rank: number } | null = null;
  const pg = index.product_units?.get(productId);
  const variantOf = (id: string | null | undefined) => (id ? index.variants?.get(id) ?? null : null);
  for (const p of list) {
    const target = unit ?? p.unit;
    const qty = unit
      ? convertWithVariant(p.quantity, p.unit, target, { units: pg, from_variant: variantOf(p.variant_id), to_variant: variantOf(wanted) })
      : p.quantity;
    if (qty == null || qty <= 0) continue;
    const match = matchOf(p, opts.context, opts.retailer_only);
    if (!match) continue;
    const r = rank(match, p.price_type === "promotie", wanted != null && (p.variant_id ?? null) !== wanted);
    // Lista e deja sortată de la cel mai nou, deci la rang egal îl păstrăm pe primul.
    if (!best || r < best.rank) best = { p, match, qty, target, rank: r };
  }
  if (!best) return null;
  const { p } = best;
  return {
    product_id: productId,
    per_unit: p.amount / best.qty,
    unit: best.target,
    observed_on: p.observed_on,
    price_id: p.id,
    retailer_id: p.retailer_id,
    source: p.source,
    match: best.match,
    promo: p.price_type === "promotie",
    stale: opts.today ? daysBetween(p.observed_on, opts.today) > STALE_AFTER_DAYS : false,
    variant_id: p.variant_id ?? null,
  };
}

export interface CostEstimate {
  cost: number;
  observed_on: ISODate;
  price: UnitPrice;
}

/** Costul estimat pentru o cantitate; null dacă nu există un preț compatibil. */
export function estimateCost(index: PriceIndex, productId: string, quantity: number | null, unit: UnitCode | null, opts: PriceOptions = {}): CostEstimate | null {
  if (quantity == null || !unit) return null;
  const up = latestUnitPrice(index, productId, unit, opts);
  if (!up) return null;
  return { cost: roundMoney(up.per_unit * quantity), observed_on: up.observed_on, price: up };
}

/** Baza prețului de pe eticheta de la raft (decizia proprietarului, 12 oct. 2026). */
export type ShelfBasis = "buc" | "kg" | "100g" | "l" | "100ml";

export const SHELF_BASES: { basis: ShelfBasis; quantity: number; unit: UnitCode; label: string; short: string }[] = [
  { basis: "buc", quantity: 1, unit: "buc", label: "pe bucată", short: "buc" },
  { basis: "kg", quantity: 1, unit: "kg", label: "pe kg", short: "kg" },
  { basis: "100g", quantity: 100, unit: "g", label: "pe 100 g", short: "100 g" },
  { basis: "l", quantity: 1, unit: "l", label: "pe litru", short: "l" },
  { basis: "100ml", quantity: 100, unit: "ml", label: "pe 100 ml", short: "100 ml" },
];

/** Baza propusă după unitatea liniei: grame → 100 g, kg → kg, ml → 100 ml, litri → litru, altfel bucata. */
export function defaultShelfBasis(unit: UnitCode | null): ShelfBasis {
  if (unit === "g") return "100g";
  if (unit === "kg") return "kg";
  if (unit === "ml") return "100ml";
  if (unit === "l") return "l";
  return "buc";
}

/**
 * Totalul pentru cantitatea cumpărată, din prețul de la raft:
 * 300 g × 7,99 lei/100 g = 23,97 lei. Null dacă unitatea cantității nu se
 * potrivește cu baza (ex. bucăți la un preț pe kg).
 */
export function totalFromShelfPrice(shelfPrice: number, basis: ShelfBasis, quantity: number, unit: UnitCode): number | null {
  const b = SHELF_BASES.find((s) => s.basis === basis)!;
  const q = convert(quantity, unit, b.unit);
  if (q == null) return null;
  return roundMoney((shelfPrice * q) / b.quantity);
}
