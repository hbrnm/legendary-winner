import type { ProductVariant, UnitCode } from "./types";

type Dimension = "masa" | "volum" | "bucata" | UnitCode;

interface UnitDef {
  code: UnitCode;
  singular: string;
  plural: string;
  /** Unitățile din aceeași dimensiune se pot converti între ele. */
  dimension: Dimension;
  /** Factorul față de unitatea de bază a dimensiunii (g, ml, buc). */
  factor: number;
}

const DEFS: UnitDef[] = [
  { code: "g", singular: "g", plural: "g", dimension: "masa", factor: 1 },
  { code: "kg", singular: "kg", plural: "kg", dimension: "masa", factor: 1000 },
  { code: "ml", singular: "ml", plural: "ml", dimension: "volum", factor: 1 },
  { code: "l", singular: "l", plural: "l", dimension: "volum", factor: 1000 },
  { code: "lingura", singular: "lingură", plural: "linguri", dimension: "volum", factor: 15 },
  { code: "lingurita", singular: "linguriță", plural: "lingurițe", dimension: "volum", factor: 5 },
  { code: "cana", singular: "cană", plural: "căni", dimension: "volum", factor: 250 },
  { code: "buc", singular: "buc", plural: "buc", dimension: "bucata", factor: 1 },
  { code: "legatura", singular: "legătură", plural: "legături", dimension: "legatura", factor: 1 },
  { code: "caserola", singular: "caserolă", plural: "caserole", dimension: "caserola", factor: 1 },
  { code: "borcan", singular: "borcan", plural: "borcane", dimension: "borcan", factor: 1 },
  { code: "punga", singular: "pungă", plural: "pungi", dimension: "punga", factor: 1 },
  { code: "pachet", singular: "pachet", plural: "pachete", dimension: "pachet", factor: 1 },
  { code: "sticla", singular: "sticlă", plural: "sticle", dimension: "sticla", factor: 1 },
  { code: "cutie", singular: "cutie", plural: "cutii", dimension: "cutie", factor: 1 },
  { code: "conserva", singular: "conservă", plural: "conserve", dimension: "conserva", factor: 1 },
  { code: "plic", singular: "plic", plural: "plicuri", dimension: "plic", factor: 1 },
  { code: "rola", singular: "rolă", plural: "role", dimension: "rola", factor: 1 },
  { code: "catel", singular: "cățel", plural: "căței", dimension: "catel", factor: 1 },
  { code: "felie", singular: "felie", plural: "felii", dimension: "felie", factor: 1 },
];

const BY_CODE = new Map(DEFS.map((d) => [d.code, d]));

export const UNIT_CODES: UnitCode[] = DEFS.map((d) => d.code);

/** Unitățile oferite în listele de cumpărături (fără măsurile de bucătărie). */
export const SHOPPING_UNITS: UnitCode[] = UNIT_CODES.filter(
  (u) => !["lingura", "lingurita", "cana", "catel", "felie"].includes(u),
);

export function isUnitCode(value: unknown): value is UnitCode {
  return typeof value === "string" && BY_CODE.has(value as UnitCode);
}

function def(unit: UnitCode): UnitDef {
  const d = BY_CODE.get(unit);
  if (!d) throw new Error(`Unitate necunoscută: ${unit}`);
  return d;
}

export function canConvert(from: UnitCode, to: UnitCode): boolean {
  return def(from).dimension === def(to).dimension;
}

/** Convertește o cantitate; întoarce null dacă unitățile nu sunt compatibile. */
export function convert(quantity: number, from: UnitCode, to: UnitCode): number | null {
  if (from === to) return quantity;
  const a = def(from);
  const b = def(to);
  if (a.dimension !== b.dimension) return null;
  return (quantity * a.factor) / b.factor;
}

/** Factorii de conversie ai unui produs, aprobați de proprietar: greutatea unei bucăți și densitatea. */
export interface ProductUnits {
  piece_grams?: number | null;
  /** Grame la 1 ml, pentru lingura și lingurița de zahăr, făină etc. */
  grams_per_ml?: number | null;
}

/**
 * Ca `convert`, plus conversiile care țin de produs, prin grame: bucată ↔
 * masă cu greutatea pe bucată (10 cepe → 1,5 kg) și volum ↔ masă cu
 * densitatea (2 linguri de zahăr → 25,5 g). Fără factorul potrivit: null.
 */
export function convertForProduct(quantity: number, from: UnitCode, to: UnitCode, factors?: number | ProductUnits | null): number | null {
  const direct = convert(quantity, from, to);
  if (direct != null || !factors) return direct;
  const { piece_grams: pg, grams_per_ml: gml } = typeof factors === "number" ? { piece_grams: factors, grams_per_ml: null } : factors;
  const dimFrom = def(from).dimension;
  const dimTo = def(to).dimension;
  let grams: number | null = null;
  if (dimFrom === "masa") grams = convert(quantity, from, "g");
  else if (from === "buc" && pg && pg > 0) grams = quantity * pg;
  else if (dimFrom === "volum" && gml && gml > 0) grams = convert(quantity, from, "ml")! * gml;
  if (grams == null) return null;
  if (dimTo === "masa") return convert(grams, "g", to);
  if (to === "buc" && pg && pg > 0) return grams / pg;
  if (dimTo === "volum" && gml && gml > 0) return convert(grams / gml, "ml", to);
  return null;
}

/** Unitățile în care se scrie conținutul net al unui ambalaj. */
export const NET_UNITS: UnitCode[] = ["g", "kg", "ml", "l"];

/** Unitățile care înseamnă „un ambalaj” al variantei: 1 pachet de șuncă Sissi = 300 g. */
export const PACKAGE_UNITS: UnitCode[] = ["buc", "pachet", "borcan", "sticla", "cutie", "conserva", "punga", "plic", "caserola"];

function netOf(variant: ProductVariant | null | undefined, unit: UnitCode): { quantity: number; unit: UnitCode } | null {
  if (!variant || variant.deleted_at || !PACKAGE_UNITS.includes(unit)) return null;
  const { net_quantity: q, net_unit: u } = variant;
  return q != null && q > 0 && u && NET_UNITS.includes(u) ? { quantity: q, unit: u } : null;
}

/**
 * Ca `convertForProduct`, plus ambalajul variantelor: un pachet de 300 g
 * înseamnă 300 g (2 pachete Sissi → 600 g; 600 g → 2 pachete). `from_variant`
 * e varianta cantității date, `to_variant` a unității cerute. Fără conținut
 * net cunoscut, rămâne conversia de acum (1 pachet = 1 pachet).
 */
export function convertWithVariant(
  quantity: number,
  from: UnitCode,
  to: UnitCode,
  opts: { units?: ProductUnits | null; from_variant?: ProductVariant | null; to_variant?: ProductVariant | null } = {},
): number | null {
  const fromNet = netOf(opts.from_variant, from);
  const toNet = netOf(opts.to_variant, to);
  // Aceeași unitate, fără variantă cerută: 1 pachet rămâne 1 pachet, ca înainte.
  if (from === to && !toNet) return quantity;
  let out: number | null = null;
  if (fromNet || toNet) {
    const q = fromNet ? quantity * fromNet.quantity : quantity;
    const u = fromNet ? fromNet.unit : from;
    if (!toNet) out = convertForProduct(q, u, to, opts.units);
    else {
      const inNet = convertForProduct(q, u, toNet.unit, opts.units);
      out = inNet == null ? null : inNet / toNet.quantity;
    }
  }
  return out ?? convertForProduct(quantity, from, to, opts.units);
}

/** Unitatea în care se adună cantitățile unei dimensiuni (kg/l pentru masă și volum). */
export function canonicalUnit(unit: UnitCode): UnitCode {
  const d = def(unit).dimension;
  if (d === "masa") return "g";
  if (d === "volum") return "ml";
  return unit;
}

export function unitLabel(unit: UnitCode, quantity = 1): string {
  const d = def(unit);
  return quantity === 1 ? d.singular : d.plural;
}

/** Rotunjește la o valoare afișabilă: 0,5 kg, 1,25 l, 3 buc. */
export function roundQuantity(q: number): number {
  if (q >= 100) return Math.round(q);
  if (q >= 10) return Math.round(q * 10) / 10;
  return Math.round(q * 100) / 100;
}

/** Alege o unitate ușor de citit: 1500 g → 1,5 kg; 0,25 kg → 250 g. */
export function humanize(quantity: number, unit: UnitCode): { quantity: number; unit: UnitCode } {
  const d = def(unit).dimension;
  if (d === "masa") {
    const g = convert(quantity, unit, "g")!;
    return g >= 1000 ? { quantity: roundQuantity(g / 1000), unit: "kg" } : { quantity: roundQuantity(g), unit: "g" };
  }
  if (d === "volum" && (unit === "ml" || unit === "l")) {
    const ml = convert(quantity, unit, "ml")!;
    return ml >= 1000 ? { quantity: roundQuantity(ml / 1000), unit: "l" } : { quantity: roundQuantity(ml), unit: "ml" };
  }
  return { quantity: roundQuantity(quantity), unit };
}

const NUMBER_FORMAT = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

export function formatQuantity(quantity: number | null, unit: UnitCode | null): string {
  if (quantity == null) return unit ? unitLabel(unit, 2) : "";
  if (!unit) return NUMBER_FORMAT.format(quantity);
  const h = humanize(quantity, unit);
  return `${NUMBER_FORMAT.format(h.quantity)} ${unitLabel(h.unit, h.quantity)}`;
}
