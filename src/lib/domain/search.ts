// Căutare de produse: insensibilă la diacritice și majuscule, cu sinonime,
// potrivire pe început de cuvânt și toleranță la o greșeală de tastare.
// Afișarea păstrează mereu denumirea corectă, cu diacritice.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forma de bază aproximativă a unui cuvânt românesc (cartofi → cartof, roșii → rosi). */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  for (const suffix of ["urile", "uri", "ele", "le", "i", "e", "a"]) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

export interface SearchDoc {
  id: string;
  /** Denumirea afișată. */
  name: string;
  /** Sinonime, denumiri regionale, comerciale, brand, EAN. */
  terms: string[];
  /** Termeni slabi (ex. subcategoria „Lapte”): găsesc produsul, dar nu îl urcă în fața potrivirilor directe. */
  weakTerms?: string[];
  /** Spor de relevanță (ex. produse folosite des de gospodărie). */
  boost?: number;
}

interface IndexedTerm {
  norm: string;
  words: string[];
  stems: string[];
  weight: number;
}

interface IndexedDoc {
  doc: SearchDoc;
  terms: IndexedTerm[];
}

export interface SearchIndex {
  docs: IndexedDoc[];
}

function indexTerm(text: string, weight: number): IndexedTerm {
  const norm = normalize(text);
  const words = norm.split(" ").filter(Boolean);
  return { norm, words, stems: words.map(stem), weight };
}

export function buildIndex(docs: SearchDoc[]): SearchIndex {
  return {
    docs: docs.map((doc) => ({
      doc,
      terms: [
        indexTerm(doc.name, 1),
        ...doc.terms.filter(Boolean).map((t) => indexTerm(t, 0.9)),
        ...(doc.weakTerms ?? []).filter(Boolean).map((t) => indexTerm(t, 0.5)),
      ],
    })),
  };
}

function scoreTerm(term: IndexedTerm, qNorm: string, qWords: string[]): number {
  if (!term.norm) return 0;
  const weight = term.weight;
  if (term.norm === qNorm) return 100 * weight;
  // Începe cu textul căutat: denumirile mai scurte (produsul de bază) urcă.
  if (term.norm.startsWith(qNorm)) return (80 - Math.min(10, (term.words.length - qWords.length) * 2)) * weight;

  // Fiecare cuvânt din căutare trebuie să se potrivească cu un cuvânt din termen.
  let total = 0;
  for (const qw of qWords) {
    const qs = stem(qw);
    let best = 0;
    for (let i = 0; i < term.words.length; i++) {
      const w = term.words[i];
      if (w === qw) best = Math.max(best, 30);
      else if (term.stems[i] === qs) best = Math.max(best, 28);
      else if (w.startsWith(qw)) best = Math.max(best, qw.length >= 2 ? 24 : 10);
      else if (qw.length >= 4 && levenshteinWithin(qs, term.stems[i], qw.length >= 7 ? 2 : 1)) best = Math.max(best, 15);
    }
    if (best === 0) return 0;
    total += best;
  }
  // Termenii mai scurți (mai specifici) primesc un mic avantaj.
  const brevity = Math.max(0, 10 - (term.words.length - qWords.length) * 2);
  return (total / qWords.length + brevity) * weight;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

export function search(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const qNorm = normalize(query);
  if (!qNorm) return [];
  const qWords = qNorm.split(" ");
  const hits: SearchHit[] = [];
  for (const entry of index.docs) {
    let best = 0;
    for (const t of entry.terms) best = Math.max(best, scoreTerm(t, qNorm, qWords));
    if (best > 0) hits.push({ doc: entry.doc, score: best + (entry.doc.boost ?? 0) });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.name.length - b.doc.name.length || a.doc.name.localeCompare(b.doc.name, "ro"));
  return hits.slice(0, limit);
}
