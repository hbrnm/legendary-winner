import { normalize, search, type SearchIndex } from "./search";

// Potrivirea liniilor de pe bon cu produsele (.tasks/005, etapa 3): întâi ce a
// învățat gospodăria din confirmările ei, apoi căutarea în catalog. Doar o
// propunere: omul o confirmă sau o schimbă pe „Verifică bonul”.

/** Ce a învățat gospodăria: textul de pe bonul unui magazin → produsul. */
export interface ReceiptAliasLike {
  retailer_id: string | null;
  receipt_text: string;
  product_id: string;
  deleted_at: string | null;
}

export interface MatchProposal {
  product_id: string;
  /** „invatat”: din confirmările gospodăriei; „catalog”: din căutare (mai nesigur). */
  source: "invatat" | "catalog";
}

/** Cheia unui text de pe bon: fără diacritice, majuscule și semne („LAPTE ZUZU 1.5% 1L” → „lapte zuzu 1 5 1l”). */
export function receiptKey(text: string): string {
  return normalize(text).slice(0, 120);
}

/** Cuvintele care pot fi căutate: cel puțin 3 litere (fără „klc”, „410g”, „n.”). */
function words(key: string): string[] {
  return key.split(" ").filter((w) => /^[a-z]{3,}$/.test(w));
}

export function proposeMatch(text: string, retailerId: string | null, aliases: ReceiptAliasLike[], index: SearchIndex): MatchProposal | null {
  const key = receiptKey(text);
  if (!key) return null;
  const learned = aliases.filter((a) => !a.deleted_at && a.receipt_text === key);
  // Același text la același magazin, apoi la oricare (același produs, alt lanț).
  const own = learned.find((a) => a.retailer_id === retailerId) ?? learned.find((a) => a.retailer_id === null) ?? learned[0];
  if (own) return { product_id: own.product_id, source: "invatat" };

  // Căutarea cere ca fiecare cuvânt să se potrivească: pe bon sunt abrevieri și
  // resturi OCR, deci încercăm întâi tot textul, apoi fără câte un cuvânt.
  const ws = words(key);
  if (ws.length === 0) return null;
  const tries = [ws.join(" "), ...ws.map((_, i) => ws.filter((__, j) => j !== i).join(" ")).filter(Boolean)];
  for (const q of tries) {
    const hit = search(index, q, 1)[0];
    if (hit) return { product_id: hit.doc.id, source: "catalog" };
  }
  return null;
}
