import type { ISODate, ProductPrice, ProductVariant, UnitCode } from "./types";
import { convertWithVariant, formatQuantity, type ProductUnits } from "./units";
import { daysBetween } from "./dates";
import { STALE_AFTER_DAYS, type PriceIndex } from "./pricing";

// Variantele comerciale (marcă, ambalaj, cod de bare): prețul pe kg al unui
// preț dat pe pachet și comparația mărcilor unui produs (.tasks/007).

/** Prețul pe kg sau pe litru, din cantitatea prețului și ambalajul variantei. */
export interface BasePrice {
  per: number;
  unit: "kg" | "l";
}

const VOLUME: UnitCode[] = ["ml", "l", "lingura", "lingurita", "cana"];

/**
 * 21 lei pentru 1 pachet Sissi de 300 g → 70 lei/kg. Lichidele (variantă în
 * ml/l sau preț pe litru) se dau pe litru. Null dacă prețul nu se poate
 * raporta la kg sau litru (ex. pachet fără gramaj): nu se ghicește.
 */
export function basePrice(p: ProductPrice, variant: ProductVariant | null, units?: ProductUnits | null): BasePrice | null {
  if (p.deleted_at || p.quantity <= 0 || p.amount < 0) return null;
  const liquid = VOLUME.includes(variant?.net_unit ?? p.unit);
  const order: ("kg" | "l")[] = liquid ? ["l", "kg"] : ["kg", "l"];
  for (const unit of order) {
    const q = convertWithVariant(p.quantity, p.unit, unit, { units, from_variant: variant });
    if (q != null && q > 0) return { per: p.amount / q, unit };
  }
  return null;
}

/** Un rând din comparația mărcilor: cel mai bun preț cunoscut al unei variante. */
export interface VariantPriceRow extends BasePrice {
  /** null = prețurile fără variantă (produsul generic). */
  variant_id: string | null;
  price_id: string;
  observed_on: ISODate;
  retailer_id: string | null;
  promo: boolean;
  stale: boolean;
}

/**
 * Prețul pe kg (sau litru) al fiecărei variante a unui produs, cu prețul
 * obișnuit cel mai recent (promoția doar dacă variantele nu au altul), cel
 * mai ieftin primul (întâi cele pe kg, apoi cele pe litru). Se compară
 * mărcile, nu magazinele: intră prețurile din orice magazin și sursă.
 * Variantele fără preț raportabil la kg nu apar.
 */
export function compareVariants(index: PriceIndex, productId: string, today: ISODate | null = null): VariantPriceRow[] {
  const units = index.product_units?.get(productId);
  const best = new Map<string | null, VariantPriceRow>();
  // Lista din index e deja de la cel mai nou la cel mai vechi.
  for (const p of index.get(productId) ?? []) {
    const id = p.variant_id ?? null;
    const variant = id ? index.variants?.get(id) ?? null : null;
    // Prețurile unei variante șterse sau necunoscute nu intră în comparație.
    if (id && (!variant || variant.deleted_at)) continue;
    const bp = basePrice(p, variant, units);
    if (!bp) continue;
    const promo = p.price_type === "promotie";
    const seen = best.get(id);
    if (seen && (!seen.promo || promo)) continue;
    best.set(id, {
      ...bp,
      variant_id: id,
      price_id: p.id,
      observed_on: p.observed_on,
      retailer_id: p.retailer_id,
      promo,
      stale: today ? daysBetween(p.observed_on, today) > STALE_AFTER_DAYS : false,
    });
  }
  return [...best.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.per - b.per);
}

/** Variantele unui produs, fără cele șterse, ordonate după nume. */
export function variantsOf(variants: Iterable<ProductVariant>, productId: string): ProductVariant[] {
  return [...variants].filter((v) => v.product_id === productId && !v.deleted_at).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

/** „Sissi, Șuncă de pui, 300 g”: marca (dacă e), denumirea, conținutul net (dacă e). */
export function variantLabel(variant: ProductVariant, brandName?: string | null): string {
  const parts = [brandName?.trim(), variant.name.trim()];
  if (variant.net_quantity != null && variant.net_unit) parts.push(formatQuantity(variant.net_quantity, variant.net_unit));
  return parts.filter(Boolean).join(", ");
}
