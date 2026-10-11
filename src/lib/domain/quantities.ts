import type { UnitCode } from "./types";
import { canConvert, canonicalUnit, convert, formatQuantity, humanize } from "./units";

/** O cantitate necesară dintr-un produs (din rețete, plan sau listă). */
export interface Need {
  product_id: string;
  /** null = „după gust” / fără cantitate. */
  quantity: number | null;
  unit: UnitCode | null;
}

/** Stoc disponibil (din cămară). */
export interface Stock {
  product_id: string;
  quantity: number;
  unit: UnitCode;
}

function key(n: Need): string {
  return `${n.product_id}|${n.quantity != null && n.unit ? canonicalUnit(n.unit) : "-"}`;
}

/**
 * Adună nevoile pe produs. Cantitățile în unități compatibile se însumează
 * (500 g + 300 g piept de pui = 800 g; 1 kg + 250 g = 1,25 kg). Unitățile
 * incompatibile pentru același produs rămân linii separate. O nevoie fără
 * cantitate dispare dacă produsul are deja o cantitate cerută.
 */
export function aggregateNeeds(needs: Need[]): Need[] {
  const sums = new Map<string, Need>();
  const order: string[] = [];
  for (const n of needs) {
    const k = key(n);
    const existing = sums.get(k);
    if (!existing) {
      order.push(k);
      sums.set(
        k,
        n.quantity != null && n.unit
          ? { product_id: n.product_id, quantity: convert(n.quantity, n.unit, canonicalUnit(n.unit))!, unit: canonicalUnit(n.unit) }
          : { product_id: n.product_id, quantity: null, unit: null },
      );
      continue;
    }
    if (n.quantity != null && n.unit) {
      const add = convert(n.quantity, n.unit, existing.unit!)!;
      existing.quantity = (existing.quantity ?? 0) + add;
    }
  }
  const quantified = new Set(order.filter((k) => sums.get(k)!.quantity != null).map((k) => sums.get(k)!.product_id));
  const out: Need[] = [];
  for (const k of order) {
    const n = sums.get(k)!;
    if (n.quantity == null) {
      if (quantified.has(n.product_id)) continue;
      // Un singur rând „după gust” per produs.
      if (out.some((o) => o.product_id === n.product_id && o.quantity == null)) continue;
      out.push({ product_id: n.product_id, quantity: null, unit: null });
      continue;
    }
    const h = humanize(n.quantity, n.unit!);
    out.push({ product_id: n.product_id, quantity: h.quantity, unit: h.unit });
  }
  return out;
}

export interface SubtractResult {
  /** Ce mai trebuie cumpărat. */
  remaining: Need[];
  /** Ce acoperă cămara, pe produs. */
  covered: Need[];
}

/**
 * Scade stocul din nevoi. Un produs fără cantitate („după gust”) se consideră
 * acoperit dacă există în cămară. Unitățile incompatibile nu se scad.
 */
export function subtractStock(needs: Need[], stock: Stock[]): SubtractResult {
  const available = stock.map((s) => ({ ...s }));
  const remaining: Need[] = [];
  const covered: Need[] = [];
  for (const n of needs) {
    const matches = available.filter((s) => s.product_id === n.product_id && s.quantity > 0);
    if (n.quantity == null || !n.unit) {
      if (matches.length === 0) remaining.push(n);
      else covered.push(n);
      continue;
    }
    let left = n.quantity;
    for (const s of matches) {
      if (!canConvert(s.unit, n.unit) || left <= 0) continue;
      const inNeedUnit = convert(s.quantity, s.unit, n.unit)!;
      const used = Math.min(inNeedUnit, left);
      left -= used;
      s.quantity -= convert(used, n.unit, s.unit)!;
    }
    const usedTotal = n.quantity - left;
    if (usedTotal > 1e-9) covered.push({ ...n, quantity: roundTiny(usedTotal) });
    if (left > 1e-9) remaining.push({ ...n, quantity: roundTiny(left) });
  }
  return { remaining, covered };
}

function roundTiny(q: number): number {
  return Math.round(q * 1000) / 1000;
}

export function scaleQuantity(quantity: number | null, fromServings: number, toServings: number): number | null {
  if (quantity == null) return null;
  if (fromServings <= 0) throw new Error("Numărul de porții trebuie să fie pozitiv");
  return roundTiny((quantity * toServings) / fromServings);
}

const WHOLE_UNITS = new Set<UnitCode>(["buc", "legatura", "caserola", "borcan", "punga", "pachet", "sticla", "cutie", "conserva", "plic", "rola"]);

/** La cumpărături nu iei 1,5 ouă sau 0,3 borcane: rotunjim în sus unitățile întregi. */
export function roundForShopping(quantity: number, unit: UnitCode): number {
  if (WHOLE_UNITS.has(unit)) return Math.ceil(quantity - 1e-9);
  return quantity;
}

export interface ShoppingNeed extends Need {
  /** Explicație pentru cumpărător, ex. „pentru rețete: 300 g”. */
  note: string | null;
}

/**
 * Transformă o nevoie din rețetă în ce pui pe lista de cumpărături, în
 * unitatea în care se vinde produsul: 600 g cartofi → 0,6 kg; 3 linguri de
 * smântână (vândută la bucată) → 1 buc, cu nota „pentru rețete: 3 linguri”.
 */
export function toShoppingNeed(need: Need, defaultUnit: UnitCode): ShoppingNeed {
  if (need.quantity == null || !need.unit) return { product_id: need.product_id, quantity: null, unit: null, note: null };
  if (canConvert(need.unit, defaultUnit)) {
    const h = humanize(convert(need.quantity, need.unit, defaultUnit)!, defaultUnit);
    return { product_id: need.product_id, quantity: roundForShopping(h.quantity, h.unit), unit: h.unit, note: null };
  }
  return { product_id: need.product_id, quantity: 1, unit: defaultUnit, note: `pentru rețete: ${formatQuantity(need.quantity, need.unit)}` };
}
