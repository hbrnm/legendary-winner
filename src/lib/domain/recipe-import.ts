// Importul rețetelor: din pagina unui site (JSON-LD schema.org `Recipe`) sau
// din textul lipit (descrierea de pe Instagram, TikTok, Facebook) se face o
// ciornă de rețetă, pe care omul o verifică înainte de salvare. Logică pură,
// fără rețea și fără importuri prin „@/”, ca s-o poată folosi și funcția Edge.

import type { UnitCode } from "./types";
import { normalize, search, type SearchIndex } from "./search";

/** Rețeta propusă, înainte de confirmare. Ce nu se poate citi sigur rămâne null. */
export interface RecipeDraft {
  name: string;
  description: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  /** Ingredientele, ca text, câte unul pe rând. */
  ingredients: string[];
  steps: string[];
  source_url: string | null;
}

const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const MAX_STEP = 1500;
const MAX_INGREDIENT = 200;
const MAX_URL = 500;

// --- Text ---------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "„", deg: "°", frac12: "½", frac14: "¼", frac34: "¾" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/** Text simplu dintr-un fragment HTML: fără etichete, cu entitățile decodate și spațiile strânse. */
function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

// --- Adresa sursei ---------------------------------------------------------------

/** Adresa sursei, de păstrat pe rețetă: doar https, fără fragment și fără parametri de urmărire; altfel null. */
export function cleanSourceUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "igshid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  const out = url.toString();
  return out.length <= MAX_URL ? out : null;
}

// --- Durate și porții ----------------------------------------------------------------

/** Durata ISO 8601 („PT1H30M”, „P0DT45M”) în minute; null dacă nu se poate citi. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim());
  if (!m || value.trim().length <= 2) return null;
  const [, d, h, min, s] = m.map((x) => (x === undefined ? 0 : Number(x)));
  const total = Math.round(d * 1440 + h * 60 + min + s / 60);
  return total <= 2880 ? total : null;
}

/** Porțiile din `recipeYield` („4”, „4 porții”, ["4", "4 servings"], 6); null dacă nu e un număr clar. */
function parseYield(value: unknown): number | null {
  const first = Array.isArray(value) ? value.find((v) => parseYield(v) != null) : value;
  if (typeof first === "number") return Number.isInteger(first) && first >= 1 && first <= 50 ? first : null;
  if (typeof first !== "string") return null;
  const m = /^\D{0,20}?(\d{1,2})(?![.,]\d)(?!\s*[-–]\s*\d)\b/.exec(first.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 50 ? n : null;
}

// --- JSON-LD ------------------------------------------------------------------------

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasType(node: Json, type: string): boolean {
  const t = node["@type"];
  // „Recipe”, „schema:Recipe”, „https://schema.org/Recipe”.
  const is = (v: unknown) => typeof v === "string" && v.replace(/^.*[/:#]/, "") === type;
  return Array.isArray(t) ? t.some(is) : is(t);
}

/** Blocurile `<script type="application/ld+json">` dintr-o pagină, citite ca JSON (cele stricate se sar). */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const body = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/^<!--|-->$/g, "").trim();
    try {
      out.push(JSON.parse(body));
    } catch {
      // Un bloc stricat nu oprește căutarea în celelalte.
    }
  }
  return out;
}

/** Primul obiect `Recipe` din JSON-LD: direct, în liste, în `@graph` sau în `mainEntity`. */
export function findRecipeNode(data: unknown, depth = 0): Json | null {
  if (depth > 6) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (hasType(data, "Recipe")) return data;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const found = findRecipeNode(data[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function instructionTexts(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    // Un singur text cu toți pașii: câte un pas pe rând.
    return value
      .split(/<br\s*\/?>|<\/p>|<\/li>|\r?\n/i)
      .map((s) => stripStepNumber(plainText(s)))
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((v) => instructionTexts(v, depth + 1));
  if (!isObject(value)) return [];
  if (hasType(value, "HowToSection") || value.itemListElement) return instructionTexts(value.itemListElement, depth + 1);
  const text = plainText(value.text) || plainText(value.name) || plainText(value.description);
  return text ? [stripStepNumber(text)].filter(Boolean) : [];
}

function stringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return list.map((v) => plainText(v)).filter(Boolean);
}

/** Ciorna din obiectul `Recipe`. Imaginea și valorile nutriționale se ignoră. */
export function draftFromJsonLd(node: Json, sourceUrl: string | null = null): RecipeDraft | null {
  const name = plainText(node.name) || plainText(node.headline);
  const ingredients = stringList(node.recipeIngredient ?? node.ingredients).map((s) => clip(s, MAX_INGREDIENT));
  const steps = instructionTexts(node.recipeInstructions).map((s) => clip(s, MAX_STEP));
  if (!name || (ingredients.length === 0 && steps.length === 0)) return null;
  return {
    name: clip(name, MAX_NAME),
    description: clip(plainText(node.description), MAX_DESCRIPTION),
    servings: parseYield(node.recipeYield),
    // Timpul total poate include dospirea sau odihna, deci nu se transformă în timp de gătit.
    prep_minutes: parseIsoDuration(node.prepTime),
    cook_minutes: parseIsoDuration(node.cookTime),
    ingredients,
    steps,
    source_url: sourceUrl ? cleanSourceUrl(sourceUrl) : null,
  };
}

/** Ciorna din pagina HTML a unui site; null dacă pagina nu are rețeta în format standard. */
export function draftFromHtml(html: string, sourceUrl: string | null = null): RecipeDraft | null {
  for (const block of extractJsonLd(html)) {
    const node = findRecipeNode(block);
    const draft = node && draftFromJsonLd(node, sourceUrl);
    if (draft) return draft;
  }
  return null;
}

// --- Textul lipit ---------------------------------------------------------------------

const INGREDIENTS_HEADER = /^(ingrediente(le)?|ingredients?|ai nevoie de|de ce ai nevoie|lista de ingrediente)( (pentru|for) .+)?$/;
const STEPS_HEADER = /^(mod(ul)? de preparare|preparare(a)?|cum se (face|prepara)|pasi(i)?|instructiuni(le)?|instructions?|method|directions?|steps?|how to make( it)?|preparation)$/;
const SERVINGS = /\b(?:portii|portie|persoane|servings?|serves|makes)\b/;

/** Fără bulină, emoji sau liniuță la început („• ”, „- ”, „✅ ”, „▪️ ”). */
function stripBullet(line: string): string {
  return line.replace(/^(?:[\s\-–—*•·▪◦‣○●►▶✓✔☑✅➡️→>]|\p{Extended_Pictographic}|️|‍)+/u, "").trim();
}

/** Fără numerotarea pasului („1.”, „2)”, „Pasul 3:”, „Step 4 -”). */
function stripStepNumber(line: string): string {
  return line.replace(/^(?:(?:pasul|pas|step)\s*\d+\s*[:.)\-–]?|\d{1,2}\s*[.)](?!\d)|\d{1,2}\s*[-–:]\s(?!\d))\s*/i, "").trim();
}

function headerOf(line: string): "ingrediente" | "pasi" | null {
  const n = normalize(stripBullet(line));
  if (!n || n.split(" ").length > 5) return null;
  if (INGREDIENTS_HEADER.test(n)) return "ingrediente";
  if (STEPS_HEADER.test(n)) return "pasi";
  return null;
}

function servingsFromLine(line: string): number | null {
  const n = normalize(line);
  if (!SERVINGS.test(n) || /\d\s*[-–]\s*\d/.test(line)) return null;
  // Numărul lângă cuvânt: „pentru 4 persoane”, „Porții: 4”, „serves 6” (nu „2 linguri ulei” din același rând).
  const m = /\b(\d{1,2}) (?:de )?(?:portii|portie|persoane|servings?)\b/.exec(n) ?? /\b(?:portii|portie|persoane|servings?|serves|makes|pentru) (\d{1,2})\b/.exec(n);
  const v = m ? Number(m[1]) : NaN;
  return v >= 1 && v <= 50 ? v : null;
}

/** Arată a ingredient: începe cu o cantitate sau e scurt și fără punct la final. */
function looksLikeIngredient(line: string): boolean {
  if (line.length > MAX_INGREDIENT) return false;
  if (/^\d{1,2}\s*[.)](?!\d)/.test(line)) return false; // pas numerotat
  return /^(\d|[½¼¾⅓⅔])/.test(line) || /^(un|o|una|doua|doi|trei|patru|cinci) /.test(normalize(line));
}

/**
 * Ciorna dintr-un text lipit: primul rând e numele, apoi descrierea; secțiunile
 * se recunosc după „Ingrediente” și „Mod de preparare” (sau echivalentele din
 * engleză). Fără titluri de secțiuni, rândurile care încep cu o cantitate sunt
 * ingrediente, iar restul pași. Hashtagurile și rândurile goale se sar.
 */
export function draftFromText(input: string): RecipeDraft | null {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/(?:^|\s)#\p{L}[\p{L}\p{N}_]*/gu, " ").replace(/\s+/g, " ").trim())
    .filter((l) => stripBullet(l) !== "");
  if (lines.length === 0) return null;

  let name = "";
  const description: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];
  let servings: number | null = null;
  let section: "inceput" | "ingrediente" | "pasi" = "inceput";
  const hasHeaders = lines.some((l) => headerOf(l) != null);

  for (const raw of lines) {
    const header = headerOf(raw);
    if (header) {
      // „Ingrediente pentru 4 persoane:”.
      if (header === "ingrediente") servings ??= servingsFromLine(raw);
      section = header;
      continue;
    }
    const line = stripBullet(raw);
    // Porțiile doar înainte de ingrediente: în pași, „împarte în 8 porții” nu e numărul de porții.
    const s = section === "inceput" ? servingsFromLine(line) : null;
    if (s != null) {
      servings ??= s;
      if (line.length <= 40) continue;
    }
    // Subtitlurile din secțiuni („Pentru sos:”) nu sunt nici ingrediente, nici pași.
    if (section !== "inceput" && line.endsWith(":") && line.split(" ").length <= 5) continue;
    if (section === "inceput") {
      if (!name) name = line;
      else if (!hasHeaders && looksLikeIngredient(line)) ingredients.push(line);
      else if (!hasHeaders && ingredients.length > 0) steps.push(stripStepNumber(line));
      else description.push(line);
    } else if (section === "ingrediente") {
      // Pe rețele, ingredientele vin uneori pe un singur rând, cu virgule: le lăsăm așa, se corectează de mână.
      ingredients.push(line);
    } else {
      const step = stripStepNumber(line);
      if (step) steps.push(step);
    }
  }
  if (!name || (ingredients.length === 0 && steps.length === 0)) return null;
  return {
    name: clip(name.replace(/[\s:.!\p{Extended_Pictographic}\uFE0F\u200D]+$/u, ""), MAX_NAME),
    description: clip(description.join(" "), MAX_DESCRIPTION),
    servings,
    prep_minutes: null,
    cook_minutes: null,
    ingredients: ingredients.map((i) => clip(i, MAX_INGREDIENT)),
    steps: steps.map((i) => clip(i, MAX_STEP)),
    source_url: null,
  };
}

// --- Ingredientele ---------------------------------------------------------------------

export interface ParsedIngredient {
  /** Rândul original, pentru ecranul de confirmare. */
  text: string;
  /** null = „după gust” sau o cantitate care nu se poate citi sigur (ex. „2–3”). */
  quantity: number | null;
  unit: UnitCode | null;
  /** Denumirea, de căutat în catalog. */
  name: string;
  note: string | null;
  optional: boolean;
}

/** Cuvintele de unitate, normalizate (fără diacritice). Factorul transformă în unitatea din aplicație. */
const UNITS: [string, UnitCode, number][] = [
  ["g", "g", 1], ["gr", "g", 1], ["grame", "g", 1], ["gram", "g", 1], ["grams", "g", 1],
  ["kg", "kg", 1], ["kilograme", "kg", 1], ["kilogram", "kg", 1], ["kilograms", "kg", 1],
  ["ml", "ml", 1], ["mililitri", "ml", 1], ["milliliters", "ml", 1], ["millilitres", "ml", 1],
  ["cl", "ml", 10], ["dl", "ml", 100],
  ["l", "l", 1], ["litri", "l", 1], ["litru", "l", 1], ["liter", "l", 1], ["liters", "l", 1], ["litre", "l", 1], ["litres", "l", 1],
  ["lb", "g", 453.59237], ["lbs", "g", 453.59237], ["pound", "g", 453.59237], ["pounds", "g", 453.59237],
  ["oz", "g", 28.349523125], ["ounce", "g", 28.349523125], ["ounces", "g", 28.349523125],
  ["lingura", "lingura", 1], ["linguri", "lingura", 1], ["lg", "lingura", 1], ["tbsp", "lingura", 1], ["tablespoon", "lingura", 1], ["tablespoons", "lingura", 1],
  ["lingurita", "lingurita", 1], ["lingurite", "lingurita", 1], ["lgt", "lingurita", 1], ["lgta", "lingurita", 1], ["tsp", "lingurita", 1], ["teaspoon", "lingurita", 1], ["teaspoons", "lingurita", 1],
  ["cana", "cana", 1], ["cani", "cana", 1],
  // Măsurile americane de volum, în ml (cana de 240 ml, ca pe etichetele din SUA).
  ["cup", "ml", 240], ["cups", "ml", 240],
  // Fără abrevieri („pt” e și „pentru” în română).
  ["pint", "ml", 473], ["pints", "ml", 473],
  ["quart", "ml", 946], ["quarts", "ml", 946],
  ["gallon", "ml", 3785], ["gallons", "ml", 3785],
  ["buc", "buc", 1], ["bucata", "buc", 1], ["bucati", "buc", 1], ["pcs", "buc", 1], ["piece", "buc", 1], ["pieces", "buc", 1],
  ["legatura", "legatura", 1], ["legaturi", "legatura", 1], ["bunch", "legatura", 1], ["bunches", "legatura", 1],
  ["catel", "catel", 1], ["catei", "catel", 1], ["clove", "catel", 1], ["cloves", "catel", 1],
  ["felie", "felie", 1], ["felii", "felie", 1], ["slice", "felie", 1], ["slices", "felie", 1],
  ["pachet", "pachet", 1], ["pachete", "pachet", 1], ["package", "pachet", 1], ["packages", "pachet", 1],
  ["plic", "plic", 1], ["plicuri", "plic", 1], ["sachet", "plic", 1], ["sachets", "plic", 1],
  ["conserva", "conserva", 1], ["conserve", "conserva", 1], ["can", "conserva", 1], ["cans", "conserva", 1], ["tin", "conserva", 1], ["tins", "conserva", 1],
  ["borcan", "borcan", 1], ["borcane", "borcan", 1], ["jar", "borcan", 1], ["jars", "borcan", 1],
  ["cutie", "cutie", 1], ["cutii", "cutie", 1], ["box", "cutie", 1], ["boxes", "cutie", 1],
  ["sticla", "sticla", 1], ["sticle", "sticla", 1], ["bottle", "sticla", 1], ["bottles", "sticla", 1],
  ["punga", "punga", 1], ["pungi", "punga", 1], ["bag", "punga", 1], ["bags", "punga", 1],
];
const UNIT_MAP = new Map(UNITS.map(([w, code, factor]) => [w, { code, factor }]));

const WORD_NUMBERS = new Map(Object.entries({ un: 1, o: 1, una: 1, unu: 1, a: 1, an: 1, one: 1, doua: 2, doi: 2, two: 2, trei: 3, three: 3, patru: 4, four: 4, cinci: 5, five: 5, sase: 6, six: 6, jumatate: 0.5, half: 0.5 }));
const FRACTIONS = new Map(Object.entries({ "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 }));
/** Măsuri fără echivalent sigur („2 pumni de nuci”, „1 fir de ceapă verde”): cantitatea rămâne în notă. */
const MEASURES = new Set(["pumn", "pumni", "fir", "fire", "foaie", "foi", "crenguta", "crengute", "mana", "pahar", "pahare", "ceasca", "cesti", "strop", "stropi", "cub", "cuburi", "handful", "handfuls", "sprig", "sprigs", "dash", "drop", "drops", "splash", "stick", "sticks"]);
const TO_TASTE: string[][] = [["dupa", "gust"], ["cat", "cuprinde"], ["to", "taste"], ["as", "needed"]];
/** „un vârf de cuțit de sare”, „un praf de piper”, „a pinch of salt” (dar nu „praf de copt”). */
const PINCH = /^(?:un |a )?(?:varf de cutit|varf|praf|pinch|dash)(?! de copt\b)(?: de| of)? /;
const OPTIONAL = new Set(["optional", "optionala"]);

/** Scoate din `tokens` prima apariție a expresiei (comparată fără diacritice); întoarce dacă a găsit-o. */
function removePhrase(tokens: string[], phrase: string[]): boolean {
  const norm = tokens.map((t) => normalize(t));
  for (let i = 0; i + phrase.length <= norm.length; i++) {
    if (phrase.every((w, k) => norm[i + k] === w)) {
      tokens.splice(i, phrase.length);
      return true;
    }
  }
  return false;
}

function readNumber(token: string): number | null {
  const f = FRACTIONS.get(token);
  if (f != null) return f;
  const mixed = /^(\d+)([½¼¾⅓⅔⅛])$/.exec(token);
  if (mixed) return Number(mixed[1]) + FRACTIONS.get(mixed[2])!;
  const frac = /^(\d+)\/(\d+)$/.exec(token);
  if (frac) return Number(frac[2]) > 0 ? Number(frac[1]) / Number(frac[2]) : null;
  if (/^\d+(?:[.,]\d+)?$/.test(token)) return Number(token.replace(",", "."));
  return null;
}

/** Prima virgulă (care nu e zecimală, ca în „1,5”) sau punct și virgulă; -1 dacă nu există. */
function splitPoint(s: string): number {
  for (let k = 0; k < s.length; k++) {
    if (s[k] === ";") return k;
    if (s[k] === "," && !(/\d/.test(s[k - 1] ?? "") && /\d/.test(s[k + 1] ?? ""))) return k;
  }
  return -1;
}

function round(q: number): number {
  return Math.round(q * 1000) / 1000;
}

/**
 * Citește un rând de ingredient: „500 g carne tocată”, „2 linguri de ulei”,
 * „1 ½ cups flour”, „o ceapă mare, tocată”, „sare după gust”, „2-3 căței de
 * usturoi” (cantitate nesigură → null, păstrată în notă).
 */
export function parseIngredientLine(input: string): ParsedIngredient {
  const text = input.replace(/\s+/g, " ").trim();
  let rest = stripBullet(text);
  const notes: string[] = [];

  // Parantezele sunt note: „100 ml (1/2 cană) lapte”, „ulei (opțional)”.
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });
  // După virgulă sau punct și virgulă: mod de pregătire („tocată”, „la temperatura camerei”).
  const comma = splitPoint(rest);
  if (comma > 0) {
    const after = rest.slice(comma + 1).trim();
    if (after) notes.push(after);
    rest = rest.slice(0, comma);
  }
  rest = rest.replace(/\s+/g, " ").trim();
  // „2kg”, „500g”, „1,5l”, „2-3buc” → cifră și unitate despărțite.
  rest = rest.replace(/^([\d.,/½¼¾⅓⅔⅛\-–]+)([a-zA-ZăâîșțşţĂÂÎȘȚ]+)(?=\s|$)/, (all, n: string, u: string) => (UNIT_MAP.has(normalize(u)) ? `${n} ${u}` : all));

  const tokens = rest.split(" ").filter(Boolean);
  let i = 0;
  let quantity: number | null = null;
  let uncertain: string | null = null;

  const range = tokens[0] ? /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/.exec(tokens[0]) : null;
  let fromWord: number | null = null;
  if (range) {
    uncertain = `${range[1]}–${range[2]}`;
    i = 1;
  } else if (tokens[0] && /^[1-9]\d*[.,]\d{3}$/.test(tokens[0])) {
    // „1.000 ml” sau „1,500 kg”: mii sau zecimale? Nu se poate ști sigur.
    uncertain = tokens[0];
    i = 1;
  } else if (tokens[0] && tokens[1] && /^\d+(?:[.,]\d+)?$/.test(tokens[0]) && /^(?:[-–]|sau|or|to)$/.test(tokens[1]) && readNumber(tokens[2] ?? "") != null) {
    uncertain = `${tokens[0]}–${tokens[2]}`;
    i = 3;
  } else if (tokens[0] && /^\d+(?:[.,]\d+)?$/.test(tokens[0]) && normalize(tokens.slice(1, 3).join(" ")) === "pana la" && readNumber(tokens[3] ?? "") != null) {
    uncertain = `${tokens[0]}–${tokens[3]}`;
    i = 4;
  } else {
    const first = readNumber(tokens[0] ?? "");
    if (first != null) {
      quantity = first;
      i = 1;
      // „1 1/2”, „1 ½”.
      const second = tokens[1] ? readNumber(tokens[1]) : null;
      if (second != null && second < 1 && Number.isInteger(first)) {
        quantity = first + second;
        i = 2;
      }
    } else if (tokens.length > 1 && WORD_NUMBERS.has(normalize(tokens[0]))) {
      // „o ceapă”, „un ou”, „a cup of” — dar nu „a” la început de nume obișnuit.
      if (!(normalize(tokens[0]) === "a" || normalize(tokens[0]) === "an") || UNIT_MAP.has(normalize(tokens[1]))) {
        quantity = fromWord = WORD_NUMBERS.get(normalize(tokens[0]))!;
        i = 1;
      }
    }
  }

  let unit: UnitCode | null = null;
  const unitWord = tokens[i] ? normalize(tokens[i].replace(/\.$/, "")) : "";
  // „8 fl oz”, „2 fl. oz.”: uncia de volum, 30 ml (8 fl oz = o cană).
  const fluid = unitWord === "fl" && normalize((tokens[i + 1] ?? "").replace(/\.$/, "")) === "oz";
  // Un „stick” de unt are 113 g; alte „sticks” (țelină, scorțișoară) rămân măsuri.
  const butterStick = /^sticks?$/.test(unitWord) && tokens.slice(i + 1).some((t) => normalize(t) === "butter");
  const u = fluid ? { code: "ml" as UnitCode, factor: 30 } : butterStick ? { code: "g" as UnitCode, factor: 113 } : UNIT_MAP.get(unitWord);
  if (u && (quantity != null || uncertain) && tokens.length > i + 1 + (fluid ? 1 : 0)) {
    if (fluid) tokens.splice(i, 2, "fl oz");
    unit = u.code;
    if (quantity != null && u.factor !== 1) quantity = Math.round(quantity * u.factor);
    i += 1;
    if (uncertain) uncertain += ` ${tokens[i - 1]}`;
  }
  // „2 pumni de nuci”: măsură necunoscută, cantitatea doar în notă.
  let measured = false;
  if (!unit && (quantity != null || uncertain) && MEASURES.has(normalize(tokens[i] ?? "")) && tokens.length > i + 1) {
    i += 1;
    uncertain = tokens.slice(0, i).join(" ");
    measured = true;
  }
  // „2 linguri de ulei”, „a cup of flour”, „jumătate de lămâie”.
  if ((unit || measured || fromWord === 0.5) && tokens[i] && /^(de|of|a)$/i.test(tokens[i]) && tokens.length > i + 1) i += 1;

  let nameTokens = tokens.slice(i);
  // Opționalul se notează separat; cantitatea rămâne.
  let optional = false;
  for (let k = notes.length - 1; k >= 0; k--) {
    if (OPTIONAL.has(normalize(notes[k]))) {
      notes.splice(k, 1);
      optional = true;
    }
  }
  const before = nameTokens.length;
  nameTokens = nameTokens.filter((t) => !OPTIONAL.has(normalize(t)));
  if (nameTokens.length < before) optional = true;

  // „sare după gust”, „un praf de sare”: fără cantitate.
  let vague: string | null = null;
  // Doar fără cantitate în cifre: „2 linguri praf de cacao” are cantitate.
  const pinch = !unit && (quantity == null || fromWord != null) ? PINCH.exec(normalize(nameTokens.join(" ")) + " ") : null;
  if (pinch && nameTokens.length > pinch[0].trim().split(" ").length) {
    nameTokens = nameTokens.slice(pinch[0].trim().split(" ").length);
    vague = "un praf";
  }
  for (const phrase of TO_TASTE) if (removePhrase(nameTokens, phrase)) vague ??= "după gust";
  if (vague) {
    quantity = null;
    uncertain = null;
    notes.unshift(vague);
  }
  if (uncertain) {
    quantity = null;
    notes.unshift(uncertain);
  }
  if (quantity != null && !(quantity > 0 && quantity <= 100000)) quantity = null;
  if (quantity == null) unit = null;

  const name = nameTokens.join(" ");
  return {
    text,
    quantity: quantity == null ? null : round(quantity),
    unit,
    name: name || stripBullet(text),
    note: notes.length ? clip(notes.join(", "), 120) : null,
    optional,
  };
}

// --- Temperaturi și lungimi în pași ----------------------------------------------------

// Fără literă după „F”, „C” sau „inch” (cu flag-ul `u`, ca „250 făină” să nu fie temperatură).
const FAHRENHEIT = String.raw`(?<!\d)(\d{2,3})\s*(?:[°º]\s*F|degrees?\s+(?:F|Fahrenheit)|F)(?!\p{L})`;
const CELSIUS = String.raw`(?<!\d)(\d{2,3})\s*[°º]\s*C(?!\p{L})`;
/** Cele două valori ale aceleiași temperaturi: „350°F (175°C)”, „180°C/350°F”, „350°F, or 175°C”. */
const PAIR = String.raw`\s*(?:\(\s*X\s*\)|\/\s*X|,?\s+(?:or|and|sau|ori|si|și)\s+X)`;
const RANGE = String.raw`\s*(?:-|–|to)\s*`;
const INCHES = String.raw`(?<![\d/])(\d+\s+\d\/\d|\d\/\d|\d+(?:\.\d+)?)`;
const INCH = String.raw`\s*-?\s*inch(?:es)?(?!\p{L})`;

function toCelsius(f: number): number {
  return Math.round((((f - 32) * 5) / 9) / 5) * 5;
}

function readInches(s: string): number {
  return s.trim().split(/\s+/).reduce((sum, part) => sum + (readNumber(part) ?? 0), 0);
}

/** Centimetri pentru bucătărie: la jumătate de cm sub 3 cm, apoi la cm întreg. */
function toCm(inches: string): string {
  const cm = readInches(inches) * 2.54;
  const r = cm < 3 ? Math.round(cm * 2) / 2 : Math.round(cm);
  return String(r).replace(".", ",");
}

/**
 * Trece în metric temperaturile și lungimile dintr-un pas al rețetei:
 * „350°F” → „175°C” (rotunjit la 5 grade), „350-375°F” → „175–190°C”,
 * „9x13 inch” → „23×33 cm”. Dacă pasul are deja și °C („350°F (175°C)”),
 * rămâne doar valoarea în °C.
 */
export function metricText(text: string): string {
  const re = (source: string) => new RegExp(source, "giu");
  return text
    .replace(re(FAHRENHEIT + PAIR.replaceAll("X", CELSIUS)), (...m: string[]) => `${m[2] ?? m[3] ?? m[4]}°C`)
    .replace(re(CELSIUS + PAIR.replaceAll("X", FAHRENHEIT)), (_, c: string) => `${c}°C`)
    .replace(re(String.raw`(?<!\d)(\d{2,3})(?:\s*[°º]\s*F?)?` + RANGE + FAHRENHEIT), (_, a: string, b: string) => `${toCelsius(Number(a))}–${toCelsius(Number(b))}°C`)
    .replace(re(FAHRENHEIT), (all: string, f: string) => {
      // „F” singur doar pentru temperaturi de cuptor, ca să nu schimbe alte texte.
      const n = Number(f);
      return /[°º]|degree/i.test(all) || (n >= 200 && n <= 600) ? `${toCelsius(n)}°C` : all;
    })
    .replace(re(`${INCHES}\\s*[x×]\\s*${INCHES}${INCH}`), (_, a: string, b: string) => `${toCm(a)}×${toCm(b)} cm`)
    .replace(re(`${INCHES}${RANGE}${INCHES}${INCH}`), (_, a: string, b: string) => `${toCm(a)}–${toCm(b)} cm`)
    .replace(re(`${INCHES}${INCH}`), (_, a: string) => `${toCm(a)} cm`);
}

// --- Potrivirea cu catalogul ------------------------------------------------------------

export interface IngredientMatch {
  ingredient: ParsedIngredient;
  /** Produsul potrivit automat (bifat pe ecranul de confirmare); null = de ales de om. */
  product_id: string | null;
  /** Variante de propus, cele mai potrivite primele. */
  candidates: string[];
}

/** Sub acest scor potrivirea e doar aproximativă (greșeală de tastare), deci o alege omul. */
const AUTO_MATCH_SCORE = 30;
const FILLER = new Set(["de", "cu", "si", "la", "din", "pentru", "of", "and", "with", "for", "the"]);

/** Singularul englezesc aproximativ: tomatoes → tomato, cherries → cherry, peaches → peach. */
function englishSingular(w: string): string {
  if (w === "leaves") return "leaf";
  if (w.length <= 3 || /(ss|us|is)$/.test(w)) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (/(oes|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
  return w.endsWith("s") ? w.slice(0, -1) : w;
}

function englishWords(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean).map(englishSingular);
}

/** Cheia unei expresii din dicționar (fără diacritice, la singular), ca să se poată verifica dublurile. */
export function englishKey(phrase: string): string {
  return englishWords(phrase).join(" ");
}

/**
 * Dicționarul de denumiri (expresie → produs; `null` = fără potrivire automată):
 * întoarce produsul expresiei celei mai lungi din text, sau `undefined` dacă
 * nicio expresie nu apare. La aceeași lungime câștigă cea din dreapta: în
 * engleză substantivul e la urmă („dill pickle” e murătură, nu mărar).
 * Fără diacritice, cratime sau apostrofuri, la singular.
 */
export function phraseDictionary(entries: [string, string | null][]): (text: string) => string | null | undefined {
  const map = new Map(entries.map(([phrase, id]) => [englishKey(phrase), id]));
  const longest = Math.max(1, ...[...map.keys()].map((k) => k.split(" ").length));
  return (text) => {
    const words = englishWords(text);
    for (let n = Math.min(longest, words.length); n >= 1; n--) {
      for (let i = words.length - n; i >= 0; i--) {
        const key = words.slice(i, i + n).join(" ");
        if (map.has(key)) return map.get(key);
      }
    }
    return undefined;
  };
}

/**
 * Caută produsul pentru fiecare ingredient, cu căutarea din aplicație
 * (diacritice, sinonime, forme de plural). Dacă denumirea întreagă nu se
 * găsește („ulei de măsline extravirgin”), încearcă începuturi tot mai scurte
 * („ulei de măsline”, „ulei”). `known` e dicționarul englez–român (.tasks/011).
 */
export function matchIngredients(
  ingredients: ParsedIngredient[],
  index: SearchIndex,
  maxCandidates = 5,
  known?: (text: string) => string | null | undefined,
): IngredientMatch[] {
  return ingredients.map((ingredient) => {
    // Întâi dicționarul (rețetele în engleză).
    const id = known?.(ingredient.name);
    if (id !== undefined) return { ingredient, product_id: id, candidates: id ? [id] : [] };
    // „boneless, skinless chicken breasts” are produsul după virgulă, dar nota poate
    // fi și „seasoned with salt”: din notă doar o variantă, nebifată.
    const fromNote = ingredient.note ? known?.(ingredient.note) : undefined;
    if (fromNote) return { ingredient, product_id: null, candidates: [fromNote] };

    const words = normalize(ingredient.name).split(" ").filter(Boolean);
    for (let n = words.length; n >= 1; n--) {
      if (FILLER.has(words[n - 1])) continue;
      const hits = search(index, words.slice(0, n).join(" "), maxCandidates);
      if (hits.length === 0) continue;
      const best = hits[0];
      // Un început scurtat urmat de „de” e alt produs („unt” din „unt de arahide”): doar variantă, nebifat.
      const compound = n < words.length && FILLER.has(words[n]);
      return {
        ingredient,
        product_id: best.score >= AUTO_MATCH_SCORE && !compound ? best.doc.id : null,
        candidates: hits.map((h) => h.doc.id),
      };
    }
    return { ingredient, product_id: null, candidates: [] };
  });
}
