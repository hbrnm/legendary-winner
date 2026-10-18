import type { ISODate } from "./types";
import { roundMoney, sumMoney } from "./money";

// Citirea textului OCR al unui bon fiscal (.tasks/005, etapa 2). Nimic nu se
// inventează: ce nu se poate citi rămâne null și linia e „de verificat”, iar
// omul confirmă fiecare linie înainte de orice salvare.
//
// Din proba pe bonuri reale (etapa 1): rândul „1,000 BUC x 3,49” iese corect
// mult mai des decât suma din dreapta, unde litera TVA se lipește de cifre
// („3,49C”, „1,898”). Deci suma liniei se calculează din cantitate × preț, iar
// suma tipărită doar o verifică.

/** Lanțurile recunoscute, cu id-ul magazinului din catalog (`src/data/retailers.ts`). */
export type ReceiptChain = "lidl" | "kaufland" | "mega-image" | "profi" | "penny" | "carrefour" | "auchan" | "selgros" | "metro" | "la-doi-pasi" | "annabella" | "diana";
export type ReceiptUnit = "buc" | "kg";

export interface ReceiptLine {
  /** Denumirea de pe bon, curățată; "" dacă nu s-a putut citi. */
  name: string;
  quantity: number | null;
  unit: ReceiptUnit | null;
  unit_price: number | null;
  /** Suma liniei înainte de reducere: cantitate × preț sau, fără ele, suma tipărită. */
  amount: number | null;
  /** Suma tipărită în dreapta, dacă s-a citit. */
  printed_amount: number | null;
  /** Reducerea (pozitivă); null dacă bonul are o reducere care nu s-a putut citi. */
  discount: number | null;
  /** „sigur” doar când suma e confirmată (de suma tipărită sau de totalul bonului). */
  check: "sigur" | "de_verificat";
}

export interface ParsedReceipt {
  chain: ReceiptChain | null;
  /** Primul rând al bonului (firma), curățat. */
  store_name: string | null;
  date: ISODate | null;
  lines: ReceiptLine[];
  /** Totalul tipărit, dacă s-a citit. */
  total: number | null;
  /** Suma liniilor citite, după reduceri. */
  lines_total: number;
  /** Toate liniile au sumă și împreună dau exact totalul bonului. */
  total_matches: boolean;
}

const CHAINS: [RegExp, ReceiptChain][] = [
  [/\bLIDL\b/i, "lidl"],
  [/\bKAUFLAND\b/i, "kaufland"],
  [/\bMEGA\s*IMAGE\b/i, "mega-image"],
  [/\bPROFI\b/i, "profi"],
  [/\bPENNY\b/i, "penny"],
  [/\bCARREFOUR\b/i, "carrefour"],
  [/\bAUCHAN\b/i, "auchan"],
  [/\bSELGROS\b/i, "selgros"],
  [/\bMETRO\b/i, "metro"],
  [/\bLA\s*DOI\s*PA[SȘ]I\b/i, "la-doi-pasi"],
  [/\bANNABELLA\b/i, "annabella"],
  [/\bDIANA\b/i, "diana"],
];

const MONEY = /(\d{1,5})[.,:;](\d{2})/g;
/** „1,000 BUC x 3,49”: cantitatea (oricât de stricată), unitatea, prețul unitar. */
const QTY_LINE = /^(.*?)\b(BUC|BUE|BIC|BC|KG|K6)\b\s*\.?\s*[xX×]+[\s,.]*(\S+)/;
/** „MIEZ DOVLEAC CRUD 0.185 KG X 69.00= 12.77 B”: totul pe un rând. */
const ONE_LINE = /^(.*?[A-Za-z].*?)\s+(\d+[.,]\d{3})\s*(KG|BUC)\s*[XxA×]\s*(\d+[.,]\d{2})\s*=\s*(\d+[.,]\d{2})/;
const DISCOUNT = /^\W*(D[I1]SC\w*|B?ESC[I1]UN\w*|REDUCERE\b|RED[UI]CERE)/i;
/** Rânduri de promoție fără sumă: „3 la preț de 2”, „Reducere Lidl Plus”. */
const PROMO_LABEL = /(\bla\s+pre[tţț]\s+de\b|\bLidl\s+P|\bREDUCERE\s+\d+\s*%|\bRe\w{3,6}e\s+Lidl)/i;
/** Sfârșitul produselor: „TOTAL” sau „SUBTOTAL” la începutul rândului (nu „Iaurt Total 0%”). */
const END = /^\W*(SUB)?TOTAL\b/i;

function money(s: string): number | null {
  const all = [...s.matchAll(MONEY)];
  const m = all[all.length - 1];
  return m ? Number(`${m[1]}.${m[2]}`) : null;
}

function quantity(raw: string, unit: ReceiptUnit): number | null {
  const s = raw.replace(/\s/g, "").replace(/\.$/, "");
  if (unit === "kg") {
    const m = /^(\d+)[.,:](\d{3})$/.exec(s);
    return m ? Number(`${m[1]}.${m[2]}`) : null;
  }
  // La bucată, cantitatea e întreagă: „1,000”, „4,000”, „1,00”, „1:00”, „1000”.
  // „1,500 BUC” nu e o cantitate de bucăți: n-o rotunjim, rămâne necitită.
  const m = /^(\d+)(?:[.,:](\d{0,3}))?$/.exec(s);
  if (!m || (m[2] && /[1-9]/.test(m[2]))) return null;
  const n = /^\d000$/.test(s) ? Number(s[0]) : Number(m[1]);
  return n > 0 ? n : null;
}

function unitPrice(raw: string): number | null {
  const m = /^(\d{1,5})[.,](\d{2})(?![\d%])/.exec(raw.replace(/^[.,]/, ""));
  return m ? Number(`${m[1]}.${m[2]}`) : null;
}

/** Denumirea fără suma din dreapta și fără resturile OCR de la coadă. */
function cleanName(s: string): string {
  const tokens = s.split(/\s+/).filter(Boolean);
  const junk = (t: string) =>
    // sumă sau cifre (cu litera TVA lipită: „3,49C”, „35C”), bucăți fără litere, litere răzlețe
    // (un procent ține de nume: „Total 0%”)
    /^-?\d[\d.,:;]*[A-D]?[^\w%]*$/.test(t) || (!/[A-Za-zĂÂÎȘȚăâîșț%]/.test(t)) || /^[A-Za-z]{1,2}\W*$/.test(t);
  while (tokens.length > 1 && junk(tokens[tokens.length - 1])) tokens.pop();
  return tokens
    .join(" ")
    .replace(/^[^A-Za-zĂÂÎȘȚăâîșț0-9]+/, "")
    .replace(/[^A-Za-zĂÂÎȘȚăâîșț0-9%)]+$/, "")
    .trim();
}

function chainOf(header: string[]): ReceiptChain | null {
  for (const line of header) for (const [re, chain] of CHAINS) if (re.test(line)) return chain;
  return null;
}

/** Data bonului: întâi cea de după „DATA”, altfel prima dată validă din text. */
function dateOf(text: string): ISODate | null {
  const date = /(\d{2})[/.-](\d{2})[/.-](20\d{2})/;
  for (const m of [new RegExp(`DATA\\W{0,3}${date.source}`, "i").exec(text), ...text.matchAll(new RegExp(date.source, "g"))]) {
    if (!m) continue;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const check = new Date(Date.UTC(y, mo - 1, d));
    if (check.getUTCMonth() === mo - 1 && check.getUTCDate() === d) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

interface Draft extends ReceiptLine {
  /** O valoare presupusă (ex. reducerea fără virgulă): linia rămâne de verificat. */
  guessed?: boolean;
}

export function parseReceipt(text: string): ParsedReceipt {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const drafts: Draft[] = [];
  let pending: { quantity: number | null; unit: ReceiptUnit; unit_price: number | null } | null = null;
  let total: number | null = null;
  let started = false;
  let ended = false;

  const push = (d: Omit<Draft, "check" | "discount" | "amount"> & { amount?: number | null }) => {
    const computed = d.quantity != null && d.unit_price != null ? roundMoney(d.quantity * d.unit_price) : null;
    drafts.push({ ...d, amount: d.amount ?? computed ?? d.printed_amount, discount: 0, check: "de_verificat" });
  };
  const flush = (name: string, printed: number | null) => {
    if (!pending) return;
    push({ name, quantity: pending.quantity, unit: pending.unit, unit_price: pending.unit_price, printed_amount: printed });
    pending = null;
  };

  for (const row of rows) {
    if (END.test(row) && !/\bTVA\b|\bTUR\b/i.test(row)) {
      flush("", null);
      if (/^\W*TOTAL\b/i.test(row) && total == null) total = money(row);
      if (started) ended = true;
      continue;
    }
    // După produse se mai caută doar totalul (după „SUBTOTAL”).
    if (ended) continue;
    const one = ONE_LINE.exec(row);
    if (one) {
      flush("", null);
      started = true;
      const unit: ReceiptUnit = one[3].toUpperCase() === "KG" ? "kg" : "buc";
      const printed = Number(one[5].replace(",", "."));
      // Aici suma de după „=” e de obicei cea bună (în probă, prețul pe kg era cel greșit).
      const q = quantity(one[2], unit);
      const price = Number(one[4].replace(",", "."));
      push({ name: cleanName(one[1]), quantity: q, unit, unit_price: price, printed_amount: printed, amount: printed });
      // Cantitate × preț nu dă suma: ceva e citit greșit, linia rămâne de verificat.
      if (q == null || roundMoney(q * price) !== printed) drafts[drafts.length - 1].guessed = true;
      continue;
    }
    const qty = QTY_LINE.exec(row);
    if (qty) {
      flush("", null);
      started = true;
      const unit: ReceiptUnit = /^K/i.test(qty[2]) ? "kg" : "buc";
      pending = { quantity: quantity(qty[1].replace(/^\W+/, ""), unit), unit, unit_price: unitPrice(qty[3]) };
      continue;
    }
    if (PROMO_LABEL.test(row) && money(row) == null) continue;
    if (DISCOUNT.test(row)) {
      flush("", null);
      const last = drafts[drafts.length - 1];
      if (!last) continue;
      let value = money(row);
      // Pe rândul de reducere, OCR-ul pierde uneori virgula: „255” = 2,55.
      if (value == null) {
        const bare = /(\d{3,5})\D*$/.exec(row.replace(/\d+\s*%/, ""));
        if (bare) value = Number(bare[1]) / 100;
        last.guessed = true;
      }
      last.discount = value == null || last.discount == null ? null : roundMoney(last.discount + value);
      continue;
    }
    if (pending) {
      flush(cleanName(row), money(row));
      continue;
    }
    // Un rând cu denumire și sumă, fără rândul de cantitate (alte case de marcat).
    const printed = money(row);
    if (started && printed != null && /[A-Za-z].*[A-Za-z].*[A-Za-z]/.test(row)) push({ name: cleanName(row), quantity: null, unit: null, unit_price: null, printed_amount: printed });
  }
  flush("", null);

  for (const d of drafts) {
    // Confirmare = două cifre independente care se potrivesc: cantitate × preț și suma tipărită.
    const confirmed = d.amount != null && d.printed_amount != null && d.quantity != null && d.unit_price != null && Math.abs(d.amount - d.printed_amount) < 0.005;
    d.check = confirmed && d.name !== "" && d.discount != null && !d.guessed ? "sigur" : "de_verificat";
  }
  // O singură linie greșită: dacă cealaltă sumă a ei închide exact totalul, o luăm pe aceea.
  const sumOf = () => sumMoney(drafts.map((d) => (d.amount ?? 0) - (d.discount ?? 0)));
  if (total != null && Math.abs(sumOf() - total) >= 0.005) {
    const gap = roundMoney(total - sumOf());
    const fix = drafts.find((d) => d.amount != null && d.printed_amount != null && Math.abs(roundMoney(d.printed_amount - d.amount) - gap) < 0.005);
    // E o alegere, nu o confirmare: linia rămâne de verificat.
    if (fix) Object.assign(fix, { amount: fix.printed_amount, guessed: true });
  }
  const lines_total = sumOf();
  const total_matches = total != null && drafts.length > 0 && drafts.every((d) => d.amount != null && d.discount != null) && Math.abs(lines_total - total) < 0.005;
  // Totalul confirmă toate liniile împreună.
  if (total_matches) for (const d of drafts) if (d.name !== "" && !d.guessed) d.check = "sigur";

  const lines: ReceiptLine[] = drafts.map(({ guessed: _g, ...l }) => (void _g, l));
  const header = rows.slice(0, 3);
  return {
    chain: chainOf(header.slice(0, 1)),
    store_name: header[0] ? cleanName(header[0]) || null : null,
    date: dateOf(text),
    lines,
    total,
    lines_total,
    total_matches,
  };
}
