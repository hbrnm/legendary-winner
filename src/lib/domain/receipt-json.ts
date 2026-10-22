import type { ISODate } from "./types";
import { roundMoney, sumMoney } from "./money";
import { chainOf, type ParsedReceipt, type ReceiptLine, type ReceiptUnit } from "./receipt";

// Bonul citit de Gemini direct ca JSON, după o schemă (.tasks/015; ideea, schema
// și regulile de citire adaptate din bida, github.com/theoldg/bida, licența MIT,
// © 2026 theoldg). Modelul doar copiază ce e tipărit: sumele ca text zecimal,
// cantitatea și prețul unitar doar când sunt tipărite. Nimic nu se calculează
// acolo; aici, doar „cantitate × preț” când lipsește suma liniei, și verificarea
// cu totalul. Fără Deno și fără „@/”: îl folosesc și funcția Edge, și telefonul.

export interface ReceiptJsonLine {
  /** Numele scris normal (nu cu majusculele casei), fără litera TVA de la capăt. */
  label: string;
  /** Suma liniei, tipărită în coloana sumelor („11.19”). */
  amount: string | null;
  /** Cantitatea tipărită: bucăți sau kilograme („0.482”). */
  quantity: number | null;
  unit: ReceiptUnit | null;
  /** Prețul unei bucăți sau al unui kilogram, dacă e tipărit. */
  unitAmount: string | null;
  /** Reducerea tipărită chiar sub linie (Lidl Plus, „DISCOUNT”), pozitivă. */
  discount: string | null;
}

export interface ReceiptJson {
  /** Fotografia nu e un bon sau nu se poate citi; atunci restul e gol. */
  error: string | null;
  /** Magazinul, fără forma juridică („Lidl”). */
  store: string | null;
  date: string | null;
  /** Totalul tipărit, niciodată adunat de model. */
  total: string | null;
  lines: ReceiptJsonLine[];
  /** Reducerile pe tot bonul, care nu stau sub o linie anume, pozitive. */
  discounts: { label: string; amount: string }[];
}

export const RECEIPT_JSON_LIMITS = { maxLines: 200, maxLabel: 120 };

const AMOUNT = /^\d{1,6}(\.\d{1,2})?$/;

/** O sumă ca număr, sau null dacă nu e un zecimal pozitiv cu punct. */
function money(text: string | null | undefined): number | null {
  const t = typeof text === "string" ? text.trim() : "";
  return AMOUNT.test(t) ? Number(t) : null;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);
/** O sumă tipărită; cu minus (un retur, un storno) nu e o cumpărătură: null, deci de verificat. */
const amountText = (v: unknown): string | null => (typeof v === "string" && money(v) != null ? v.trim() : null);
/** O reducere: pozitivă oricum, iartă minusul pe care îl tipărește casa. */
const discountText = (v: unknown): string | null => (typeof v === "string" ? amountText(v.trim().replace(/^-/, "")) : null);

/** O zi care există („2026-02-30” nu), ca la `parseReceipt`. */
function validDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : null;
}

/** Răspunsul modelului, verificat și curățat; null dacă nu are forma cerută. */
export function readReceiptJson(value: unknown, limits = RECEIPT_JSON_LIMITS): ReceiptJson | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.lines)) return null;
  const lines: ReceiptJsonLine[] = [];
  for (const raw of v.lines.slice(0, limits.maxLines) as Record<string, unknown>[]) {
    // O linie cu sumă, dar fără nume citit, rămâne: omul o alege din catalog sau o scoate.
    const label = str(raw?.label, limits.maxLabel) ?? "";
    if (!label && amountText(raw?.amount) == null) continue;
    const quantity = typeof raw.quantity === "number" && Number.isFinite(raw.quantity) && raw.quantity > 0 ? raw.quantity : null;
    const unit = raw.unit === "buc" || raw.unit === "kg" ? raw.unit : null;
    lines.push({ label, amount: amountText(raw.amount), quantity, unit: quantity == null ? null : unit, unitAmount: amountText(raw.unitAmount), discount: discountText(raw.discount) });
  }
  const discounts = (Array.isArray(v.discounts) ? (v.discounts as Record<string, unknown>[]) : [])
    .map((d) => ({ label: str(d?.label, limits.maxLabel) ?? "", amount: discountText(d?.amount) }))
    .filter((d): d is { label: string; amount: string } => d.amount != null && money(d.amount)! > 0);
  return { error: str(v.error, 300), store: str(v.store, limits.maxLabel), date: validDate(v.date), total: amountText(v.total), lines, discounts };
}

/** În cenți, ca împărțirea să nu piardă bani. */
const cents = (n: number) => Math.round(n * 100);

/**
 * Bonul citit, în forma ecranului „Verifică bonul”. O reducere pe tot bonul se
 * împarte pe linii după sumă (restul de cenți pe cea mai mare), ca bugetul să dea
 * totalul plătit. Liniile sunt „sigure” când suma lor dă totalul tipărit; altfel,
 * doar cele la care cantitatea × prețul confirmă suma.
 */
export function receiptFromJson(r: ReceiptJson): ParsedReceipt {
  const lines: ReceiptLine[] = r.lines.map((l) => {
    const printed = money(l.amount);
    const unitPrice = money(l.unitAmount);
    const product = l.quantity != null && unitPrice != null ? roundMoney(l.quantity * unitPrice) : null;
    const confirmed = printed != null && product != null && cents(product) === cents(printed);
    return {
      name: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: unitPrice,
      amount: printed ?? product,
      printed_amount: printed,
      discount: money(l.discount) ?? 0,
      check: confirmed && l.label ? "sigur" : "de_verificat",
    };
  });

  const billDiscount = cents(sumMoney(r.discounts.map((d) => money(d.amount)!)));
  if (billDiscount > 0) {
    const base = lines.map((l) => Math.max(0, cents(l.amount ?? 0) - cents(l.discount ?? 0)));
    const all = base.reduce((a, b) => a + b, 0);
    if (all >= billDiscount) {
      const share = base.map((b) => Math.floor((b * billDiscount) / all));
      const largest = base.indexOf(Math.max(...base));
      share[largest] += billDiscount - share.reduce((a, b) => a + b, 0);
      lines.forEach((l, i) => (l.discount = roundMoney((l.discount ?? 0) + share[i] / 100)));
    }
  }

  const total = money(r.total);
  const linesTotal = sumMoney(lines.map((l) => roundMoney((l.amount ?? 0) - (l.discount ?? 0))));
  // O reducere mai mare decât linia ei e citită greșit: totalul nu mai confirmă nimic.
  const sane = lines.every((l) => l.amount != null && cents(l.discount ?? 0) <= cents(l.amount) && l.name);
  const totalMatches = total != null && lines.length > 0 && sane && cents(linesTotal) === cents(total);
  if (totalMatches) for (const l of lines) l.check = "sigur";
  return {
    chain: r.store ? chainOf([r.store]) : null,
    store_name: r.store,
    date: r.date as ISODate | null,
    lines,
    total,
    lines_total: linesTotal,
    total_matches: totalMatches,
  };
}
