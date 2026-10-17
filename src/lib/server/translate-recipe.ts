// Funcția Edge `translate-recipe` (.tasks/012): traduce în română numele,
// descrierea și pașii unei rețete importate, cu DeepL API Free (decizia
// proprietarului: gratuit). Logică fără Deno și fără importuri prin „@/”:
// rețeaua și limita de cereri vin din afară, ca să se poată testa. Se împachetează pentru Deno cu `npm run build:functions` în
// supabase/functions/translate-recipe/core.js. Nu păstrează nimic.

import { quotaViaRest } from "./import-recipe";

export { quotaViaRest };

export type TranslateErrorCode = "bad_request" | "unauthorized" | "rate_limited" | "too_large" | "failed";

/** Textul rețetei care se traduce (ingredientele nu: sunt deja potrivite cu catalogul). */
export interface RecipeText {
  name: string;
  description: string;
  steps: string[];
}

export type TranslateResponse = { recipe: RecipeText } | { error: TranslateErrorCode };

export interface TranslateDeps {
  /** Limita de cereri a omului cu acest token: true = mai are voie, false = a depășit, null = token nevalid. */
  takeQuota: (authorization: string) => Promise<boolean | null>;
  /** Traducerea rețetei (aceleași câmpuri), sau o eroare. */
  translate: (recipe: RecipeText) => Promise<unknown>;
}

// Aceleași limite ca la ciorna rețetei (src/lib/domain/recipe-import.ts); `maxBody` e corpul cererii.
export const TRANSLATE_LIMITS = { maxName: 120, maxDescription: 1000, maxStep: 1500, maxSteps: 60, maxChars: 20_000, maxBody: 100_000 };

const STATUS: Record<TranslateErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  rate_limited: 429,
  too_large: 413,
  failed: 502,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function reply(body: TranslateResponse | null, status: number): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: body ? { ...CORS, "content-type": "application/json; charset=utf-8" } : CORS,
  });
}

const fail = (code: TranslateErrorCode) => reply({ error: code }, STATUS[code]);

const isString = (v: unknown): v is string => typeof v === "string";

/** Rețeta din cerere, sau null dacă nu are forma așteptată. */
export function readRecipeText(value: unknown): RecipeText | null {
  const r = value as Partial<RecipeText> | null;
  if (!r || !isString(r.name) || !isString(r.description) || !Array.isArray(r.steps) || !r.steps.every(isString)) return null;
  return { name: r.name, description: r.description, steps: r.steps };
}

function tooLarge(r: RecipeText, limits = TRANSLATE_LIMITS): boolean {
  const total = r.name.length + r.description.length + r.steps.reduce((n, s) => n + s.length, 0);
  return (
    r.name.length > limits.maxName ||
    r.description.length > limits.maxDescription ||
    r.steps.length > limits.maxSteps ||
    r.steps.some((s) => s.length > limits.maxStep) ||
    total > limits.maxChars
  );
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Traducerea primită, verificată: aceleași câmpuri, același număr de
 * pași, nimic golit unde originalul avea text și nimic adăugat unde era gol.
 * Româna e de obicei mai lungă: textele se taie la limitele ciornei. Altfel null.
 */
export function checkTranslation(original: RecipeText, value: unknown, limits = TRANSLATE_LIMITS): RecipeText | null {
  const t = readRecipeText(value);
  if (!t || t.steps.length !== original.steps.length) return null;
  const field = (orig: string, out: string, max: number): string | null => {
    if (orig.trim() === "") return "";
    const clean = out.replace(/\s+/g, " ").trim();
    return clean ? clip(clean, max) : null;
  };
  const name = field(original.name, t.name, limits.maxName);
  const description = field(original.description, t.description, limits.maxDescription);
  const steps = original.steps.map((s, i) => field(s, t.steps[i], limits.maxStep));
  if (name === null || description === null || steps.some((s) => s === null)) return null;
  return { name, description, steps: steps as string[] };
}

/** Câte texte primește DeepL într-o cerere. */
const DEEPL_BATCH = 50;

/**
 * Traducerea cu DeepL (`POST /v2/translate`, `target_lang: "RO"`, limba sursă
 * recunoscută de DeepL). Cheile gratuite se termină în „:fx” și merg la
 * api-free.deepl.com. Câmpurile goale nu se trimit (nu consumă din cele
 * 500.000 de caractere gratuite pe lună). La limita lunară DeepL răspunde 456.
 */
export function deeplTranslator(fetchFn: typeof fetch, apiKey: string): TranslateDeps["translate"] {
  const host = apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  return async (recipe) => {
    const fields = [recipe.name, recipe.description, ...recipe.steps];
    const filled = fields.flatMap((text, i) => (text.trim() ? [i] : []));
    const out = [...fields];
    for (let start = 0; start < filled.length; start += DEEPL_BATCH) {
      const batch = filled.slice(start, start + DEEPL_BATCH);
      const res = await fetchFn(`${host}/v2/translate`, {
        method: "POST",
        headers: { authorization: `DeepL-Auth-Key ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ text: batch.map((i) => fields[i]), target_lang: "RO", preserve_formatting: true }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`DeepL ${res.status}`);
      const body = (await res.json()) as { translations?: { text?: unknown }[] };
      if (!Array.isArray(body.translations) || body.translations.length !== batch.length) throw new Error("DeepL: răspuns neașteptat");
      batch.forEach((i, k) => {
        const text = body.translations![k]?.text;
        if (typeof text !== "string") throw new Error("DeepL: răspuns neașteptat");
        out[i] = text;
      });
    }
    return { name: out[0], description: out[1], steps: out.slice(2) };
  };
}

/** Cererea aplicației: POST cu `{ "recipe": { name, description, steps } }` și tokenul omului în `Authorization`. */
export async function handleTranslateRequest(req: Request, deps: TranslateDeps, limits = TRANSLATE_LIMITS): Promise<Response> {
  if (req.method === "OPTIONS") return reply(null, 204);
  if (req.method !== "POST") return fail("bad_request");
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) return fail("unauthorized");

  if (Number(req.headers.get("content-length")) > limits.maxBody) return fail("too_large");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const recipe = readRecipeText((body as { recipe?: unknown } | null)?.recipe);
  if (!recipe) return fail("bad_request");
  if (tooLarge(recipe, limits)) return fail("too_large");

  try {
    const quota = await deps.takeQuota(authorization);
    if (quota === null) return fail("unauthorized");
    if (!quota) return fail("rate_limited");
    // Limita se consumă și dacă traducerea nu reușește: fiecare apel consumă din caracterele gratuite.
    const translated = checkTranslation(recipe, await deps.translate(recipe), limits);
    if (!translated) console.error("translate-recipe: traducerea nu are forma cerută");
    return translated ? reply({ recipe: translated }, 200) : fail("failed");
  } catch (e) {
    // Doar motivul (limita lunară, cheia, eroare a serviciului), fără textul rețetei.
    console.error(`translate-recipe: ${e instanceof Error ? `${e.name}: ${e.message}` : "eroare"}`);
    return fail("failed");
  }
}
