import type { ParsedReceipt, ReceiptLine, ReceiptUnit } from "./receipt";
import { roundMoney, sumMoney } from "./money";

// Cumpărăturile scrise sau dictate, fără bon: „lapte 2 buc 13,98, pâine 5,50”.
// Fiecare produs e pe un rând sau după o virgulă urmată de spațiu (virgula
// zecimală nu are spațiu). Pe un produs: cantitatea cu unitatea, dacă e, și
// suma, ultimul număr. Nimic nu se inventează: fără sumă, linia rămâne „de
// verificat” și omul o completează pe același ecran ca bonul.

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
/** „13 lei și 98 de bani”, cum scrie uneori dictarea. */
const LEI_BANI = new RegExp(String.raw`(\d+)\s*lei\s*(?:și|si)?\s*(\d{1,2})\s*(?:de\s*)?bani(?!\p{L})`, "iu");
/** Cantitatea cu unitatea: „2 buc”, „1,2 kg”, „500 g”, „x3”; unitatea e un cuvânt întreg („2 găini” nu e „2 g”). */
const QTY = new RegExp(String.raw`${NUM}\s*(buc(?:ăți|ăţi|ati|ata|ată)?|kg|kilograme?|g|grame?)(?!\p{L})\.?|(?<!\p{L})x\s*(\d+)(?!\p{L})|(?<![\p{L}\d.,])(\d+)\s*x(?!\p{L})`, "iu");
const AMOUNT = new RegExp(String.raw`${NUM}\s*(?:lei|ron)?\.?\s*$`, "i");
/** Un număr întreg separat de nume, nu partea unui zecimal („cola 0,5”). */
const LEFT_NUMBER = /^(.*?)\s+(?<![.,\d])(\d+)\s*$/;

const toNumber = (s: string) => Number(s.replace(",", "."));

function parseLine(raw: string): ReceiptLine | null {
  let s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  s = s.replace(LEI_BANI, (_, lei: string, bani: string) => `${lei},${bani.padStart(2, "0")} lei`);

  let quantity: number | null = null;
  let unit: ReceiptUnit | null = null;
  const q = s.match(QTY);
  if (q) {
    if (q[1]) {
      const n = toNumber(q[1]);
      const u = q[2].toLowerCase();
      if (u.startsWith("b")) [quantity, unit] = [n, "buc"];
      else if (u.startsWith("k")) [quantity, unit] = [n, "kg"];
      else [quantity, unit] = [n / 1000, "kg"];
    } else [quantity, unit] = [Number(q[3] ?? q[4]), "buc"];
    s = `${s.slice(0, q.index)} ${s.slice(q.index! + q[0].length)}`.trim();
  }

  let amount: number | null = null;
  const a = s.match(AMOUNT);
  if (a) {
    amount = roundMoney(toNumber(a[1]));
    s = s.slice(0, a.index).trim();
    // „lapte 2 13,98”: numărul rămas în stânga sumei e cantitatea, în bucăți.
    const left = quantity == null ? s.match(LEFT_NUMBER) : null;
    if (left && left[1]) [s, quantity, unit] = [left[1], Number(left[2]), "buc"];
  }

  const name = s.replace(/[\s,;:.-]+$/, "").replace(/^[\s,;:.-]+/, "");
  if (!name && amount == null) return null;
  return { name, quantity, unit, unit_price: null, amount, printed_amount: amount, discount: 0, check: amount == null ? "de_verificat" : "sigur" };
}

/** Liniile scrise, în forma bonului citit, ca să treacă prin același ecran de verificare. */
export function parseTypedPurchases(text: string): ParsedReceipt {
  const lines: ReceiptLine[] = [];
  for (const line of text.split(/\n|;|,(?=\s)/).map(parseLine)) {
    if (!line) continue;
    // „lapte 2 buc, 13,98”: dictarea pune des o virgulă înainte de sumă.
    const prev = lines[lines.length - 1];
    if (!line.name && prev && prev.amount == null) lines[lines.length - 1] = { ...prev, amount: line.amount, printed_amount: line.amount, check: "sigur" };
    else lines.push(line);
  }
  return { chain: null, store_name: null, date: null, lines, total: null, lines_total: sumMoney(lines.map((l) => l.amount ?? 0)), total_matches: false };
}
