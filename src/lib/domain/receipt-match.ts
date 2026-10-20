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
  updated_at: string;
}

export interface MatchProposal {
  product_id: string;
  /** „invatat”: din confirmările gospodăriei; „catalog”: din căutare (mai nesigur). */
  source: "invatat" | "catalog";
}

/** Cheia unui text de pe bon: fără diacritice, majuscule și semne („LAPTE ZUZU 1.5% 1L” → „lapte zuzu 1 5 1l”). */
export function receiptKey(text: string): string {
  return normalize(text).slice(0, 120).trim();
}

/** Cuvintele care pot fi căutate: cel puțin 3 litere (fără „klc”, „410g”, „n.”). */
function words(key: string): string[] {
  return key.split(" ").filter((w) => /^[a-z]{3,}$/.test(w));
}

/** `products`: id-urile produselor care încă există (o potrivire spre un produs șters nu se propune). */
export function proposeMatch(text: string, retailerId: string | null, aliases: ReceiptAliasLike[], index: SearchIndex, products?: ReadonlySet<string>): MatchProposal | null {
  const key = receiptKey(text);
  if (!key) return null;
  // Cea mai recentă confirmare întâi, ca alegerea să nu depindă de ordinea din baza locală.
  const learned = aliases
    .filter((a) => !a.deleted_at && a.receipt_text === key && (!products || products.has(a.product_id)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  // Același text la același magazin, apoi la oricare (același produs, alt lanț).
  const own = learned.find((a) => a.retailer_id === retailerId) ?? learned.find((a) => a.retailer_id === null) ?? learned[0];
  if (own) return { product_id: own.product_id, source: "invatat" };

  // Căutarea cere ca fiecare cuvânt să se potrivească: pe bon sunt abrevieri și
  // resturi OCR, deci încercăm întâi tot textul, apoi fără câte un cuvânt. Nu se
  // scoate cuvântul care spune ce e produsul: primul și cel de după „de”/„cu”
  // („Bomboane cu lapte” nu e lapte, „Unt de arahide” nu e unt, 20 oct. 2026).
  const ws = words(key);
  if (ws.length === 0) return null;
  const tokens = key.split(" ");
  const kept = new Set([ws[0], ...tokens.filter((_, i) => tokens[i - 1] === "de" || tokens[i - 1] === "cu")]);
  const tries = [ws.join(" "), ...ws.map((w, i) => (kept.has(w) ? "" : ws.filter((__, j) => j !== i).join(" "))).filter(Boolean)];
  for (const q of tries) {
    const hit = search(index, q, 1)[0];
    if (hit) return { product_id: hit.doc.id, source: "catalog" };
  }
  return null;
}
