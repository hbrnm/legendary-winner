import type { ISODate, ProductPrice, PurchaseSource, UnitCode } from "./types";
import { convertWithPiece } from "./units";
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
}

export interface PriceOptions {
  /** Lipsă = estimare generală, din orice sursă. */
  context?: PriceContext | null;
  /** Ziua de azi, pentru marcarea prețurilor vechi. Lipsă = nu se marchează. */
  today?: ISODate | null;
}

/** Prețurile pe produs; opțional, greutatea pe bucată, ca prețul pe kg să acopere și bucățile. */
export type PriceIndex = Map<string, ProductPrice[]> & { piece_grams?: ReadonlyMap<string, number> };

/**
 * Grupează prețurile pe produs, cele mai noi primele. Prețurile șterse și
 * cele cu cantitate zero se ignoră. Nu există prețuri implicite: un produs
 * fără preț introdus de gospodărie rămâne fără preț.
 */
export function buildPriceIndex(prices: ProductPrice[], pieceGrams?: ReadonlyMap<string, number>): PriceIndex {
  const index: PriceIndex = new Map();
  if (pieceGrams) index.piece_grams = pieceGrams;
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

function matchOf(p: ProductPrice, ctx: PriceContext | null | undefined): PriceMatch | null {
  if (!ctx) return "general";
  if (p.source !== ctx.source) return null;
  if (!ctx.retailer_id) return "sursa";
  return p.retailer_id === ctx.retailer_id ? "magazin" : "alt_magazin";
}

/**
 * Prețul cel mai potrivit, exprimabil în `unit` (sau orice unitate, dacă
 * `unit` lipsește). Ordinea: preț obișnuit din același magazin, preț
 * obișnuit din aceeași sursă, apoi promoțiile în aceeași ordine; în fiecare
 * treaptă, cel mai recent. Prețurile din alte surse nu se folosesc pentru o
 * linie de listă (piața nu estimează un coș de supermarket). Fără preț
 * potrivit, rezultatul e null: nu se inventează nimic.
 */
export function latestUnitPrice(index: PriceIndex, productId: string, unit?: UnitCode | null, opts: PriceOptions = {}): UnitPrice | null {
  const list = index.get(productId);
  if (!list) return null;
  const rank = (m: PriceMatch, promo: boolean) => (promo ? 2 : 0) + (m === "alt_magazin" ? 1 : 0);
  let best: { p: ProductPrice; match: PriceMatch; qty: number; target: UnitCode; rank: number } | null = null;
  const pg = index.piece_grams?.get(productId);
  for (const p of list) {
    const target = unit ?? p.unit;
    const qty = convertWithPiece(p.quantity, p.unit, target, pg);
    if (qty == null || qty <= 0) continue;
    const match = matchOf(p, opts.context);
    if (!match) continue;
    const r = rank(match, p.price_type === "promotie");
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
