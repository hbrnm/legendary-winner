import type { UnitCode } from "./types";

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

/**
 * Ca `convert`, plus bucată ↔ masă pentru un produs cu greutate aproximativă
 * pe bucată (ex. ceapă ≈ 150 g): 10 buc → 1,5 kg; 2 kg → 13,33 buc.
 */
export function convertWithPiece(quantity: number, from: UnitCode, to: UnitCode, pieceGrams?: number | null): number | null {
  const direct = convert(quantity, from, to);
  if (direct != null || !pieceGrams || pieceGrams <= 0) return direct;
  if (from === "buc" && def(to).dimension === "masa") return convert(quantity * pieceGrams, "g", to);
  if (to === "buc" && def(from).dimension === "masa") return convert(quantity, from, "g")! / pieceGrams;
  return null;
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
