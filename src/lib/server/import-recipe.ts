// Funcția Edge `import-recipe` (.tasks/009, etapa 2): primește linkul unei
// rețete, descarcă pagina în siguranță și întoarce ciorna din JSON-LD. Logică
// fără Deno și fără importuri prin „@/”: rețeaua, DNS-ul și limita de cereri
// vin din afară, ca să se poată testa. Se împachetează pentru Deno cu
// `npm run build:functions` în supabase/functions/import-recipe/core.js.
// Nu păstrează paginile.

import { draftFromHtml, type RecipeDraft } from "../domain/recipe-import";

export type ImportErrorCode =
  | "bad_request"
  | "unauthorized"
  | "rate_limited"
  | "invalid_url"
  | "blocked_address"
  | "fetch_failed"
  | "timeout"
  | "too_large"
  | "not_html"
  | "not_image"
  | "no_recipe";

export type ImportResponse = { draft: RecipeDraft } | { error: ImportErrorCode };

export interface ImportDeps {
  fetch: typeof fetch;
  /** Adresele IP (A și AAAA) ale unui nume; listă goală dacă numele nu există. */
  resolveHost: (host: string) => Promise<string[]>;
  /** Limita de cereri a omului cu acest token: true = mai are voie, false = a depășit, null = token nevalid. */
  takeQuota: (authorization: string) => Promise<boolean | null>;
}

export const IMPORT_LIMITS = {
  /** Timpul total pentru pagină, cu tot cu redirecționări. */
  timeoutMs: 10_000,
  maxBytes: 3_000_000,
  /** Fotografia rețetei (.tasks/013): cel mult 5 MB, se micșorează apoi pe telefon. */
  maxImageBytes: 5_000_000,
  maxRedirects: 3,
  maxUrlLength: 500,
};

const STATUS: Record<ImportErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  rate_limited: 429,
  invalid_url: 400,
  blocked_address: 400,
  fetch_failed: 502,
  timeout: 504,
  too_large: 413,
  not_html: 422,
  not_image: 422,
  no_recipe: 422,
};

// Aplicația o cheamă din browser, cu tokenul în antet (fără cookie-uri).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

class ImportError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(code);
  }
}

// --- Adresele permise ------------------------------------------------------------

function ipv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const n = parts.map(Number);
  return n.every((x) => x <= 255) ? n : null;
}

/** IPv6 ca 8 grupuri de 16 biți; null dacă nu e o adresă IPv6 validă. */
function ipv6(host: string): number[] | null {
  let s = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!s.includes(":") || s.includes("%")) return null;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4) {
    const n = ipv4(v4[1]);
    if (!n) return null;
    s = s.slice(0, -v4[1].length) + ((n[0] << 8) | n[1]).toString(16) + ":" + ((n[2] << 8) | n[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Adresă publică, bună de descărcat: nu e locală, privată, rezervată sau de
 * documentație. La IPv6 sunt permise doar adresele globale (2000::/3), fără
 * cele care ar putea ascunde o adresă IPv4 (6to4, Teredo) și fără documentație.
 */
export function isPublicAddress(ip: string): boolean {
  const v4 = ipv4(ip);
  if (v4) {
    const [a, b, c] = v4;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  const v6 = ipv6(ip);
  if (!v6) return false;
  const [g0, g1] = v6;
  if (g0 < 0x2000 || g0 > 0x3fff) return false;
  if (g0 === 0x2002) return false;
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0x0db8)) return false;
  return true;
}

/** Linkul primit, dacă e o adresă https obișnuită (fără port, utilizator sau parolă); altfel null. */
export function parseImportUrl(input: unknown): URL | null {
  if (typeof input !== "string" || !input.trim() || input.length > IMPORT_LIMITS.maxUrlLength) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !url.hostname.includes(".")) return null;
  return url;
}

/** Promisiunea, dar respinsă cu „timeout” dacă timpul cererii se termină înainte. */
function within<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new ImportError("timeout"));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new ImportError("timeout"));
    signal.addEventListener("abort", stop, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

async function checkHost(url: URL, deps: ImportDeps, signal: AbortSignal): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = ipv4(host) || ipv6(host);
  const addresses = literal ? [host] : await within(deps.resolveHost(host).catch(() => [] as string[]), signal);
  if (addresses.length === 0) throw new ImportError("fetch_failed");
  if (!addresses.every(isPublicAddress)) throw new ImportError("blocked_address");
}

// --- Descărcarea paginii -------------------------------------------------------------

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new ImportError("too_large");
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ImportError("too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Codarea din antet sau, dacă lipsește, din `<meta charset>` de la începutul paginii (site-urile vechi, windows-1250). */
function charsetOf(bytes: Uint8Array, contentType: string): string | undefined {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = charsetOf(bytes, contentType);
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Tipurile de imagine pe care le poate citi telefonul (createImageBitmap). */
const IMAGE_TYPE = /^\s*(image\/(?:jpeg|png|webp|avif|gif))\s*(?:;|$)/i;

/**
 * Descarcă o pagină sau o imagine în siguranță: doar adrese publice (și după
 * fiecare redirecționare), cu limită de timp și de mărime, doar tipul cerut.
 */
async function fetchResource(start: URL, deps: ImportDeps, limits: typeof IMPORT_LIMITS, kind: "page" | "image"): Promise<{ bytes: Uint8Array; type: string; url: URL }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  try {
    let url = start;
    for (let hop = 0; ; hop++) {
      await checkHost(url, deps, controller.signal);
      const res = await deps
        .fetch(url.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: kind === "page" ? "text/html,application/xhtml+xml" : "image/avif,image/webp,image/png,image/jpeg,image/gif",
            "user-agent": "CamaraApp/0.1 (import retete)",
          },
        })
        .catch((e: unknown) => {
          throw new ImportError(controller.signal.aborted || (e instanceof Error && e.name === "AbortError") ? "timeout" : "fetch_failed");
        });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {});
        const next = parseImportUrl(new URL(res.headers.get("location") ?? "", url).href);
        if (!next) throw new ImportError(res.headers.get("location") ? "invalid_url" : "fetch_failed");
        if (hop >= limits.maxRedirects) throw new ImportError("fetch_failed");
        url = next;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new ImportError("fetch_failed");
      }
      const type = res.headers.get("content-type") ?? "";
      // Fără Content-Type, pagina se citește ca HTML; imaginea trebuie să-și spună tipul.
      const wrongType = kind === "page" ? type.trim() && !/^\s*(text\/html|application\/xhtml\+xml)/i.test(type) : !IMAGE_TYPE.test(type);
      if (wrongType) {
        await res.body?.cancel().catch(() => {});
        throw new ImportError(kind === "page" ? "not_html" : "not_image");
      }
      const bytes = await readLimited(res, kind === "page" ? limits.maxBytes : limits.maxImageBytes).catch((e: unknown) => {
        if (e instanceof ImportError) throw e;
        throw new ImportError(controller.signal.aborted ? "timeout" : "fetch_failed");
      });
      return { bytes, type, url };
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pagina de la acest link, cu adresa finală. Fiecare adresă (și fiecare
 * redirecționare) trebuie să fie publică; timpul și mărimea sunt limitate.
 */
export async function fetchRecipePage(start: URL, deps: ImportDeps, limits = IMPORT_LIMITS): Promise<{ html: string; url: URL }> {
  const { bytes, type, url } = await fetchResource(start, deps, limits, "page");
  return { html: decode(bytes, type), url };
}

/** Fotografia rețetei (.tasks/013): octeții și tipul imaginii. */
export async function fetchRecipeImage(start: URL, deps: ImportDeps, limits = IMPORT_LIMITS): Promise<{ bytes: Uint8Array; type: string }> {
  const { bytes, type } = await fetchResource(start, deps, limits, "image");
  return { bytes, type: IMAGE_TYPE.exec(type)![1].toLowerCase() };
}

// --- Cererea -------------------------------------------------------------------------

function reply(body: ImportResponse | null, status: number): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: body ? { ...CORS, "content-type": "application/json; charset=utf-8" } : CORS,
  });
}

const fail = (code: ImportErrorCode) => reply({ error: code }, STATUS[code]);

/** Cererea aplicației: POST cu `{ "url": "https://…" }` (sau `{ "image": … }`) și tokenul omului în `Authorization`. */
export async function handleImportRequest(req: Request, deps: ImportDeps, limits = IMPORT_LIMITS): Promise<Response> {
  if (req.method === "OPTIONS") return reply(null, 204);
  if (req.method !== "POST") return fail("bad_request");
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) return fail("unauthorized");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  // `{"image": "https://…"}`: fotografia rețetei citite înainte (.tasks/013); altfel `{"url"}`: pagina.
  const wanted = body as { url?: unknown; image?: unknown } | null;
  const image = typeof wanted?.image === "string";
  if (image && wanted?.url !== undefined) return fail("bad_request");
  const url = parseImportUrl(image ? wanted?.image : wanted?.url);
  if (!url) return fail("invalid_url");

  try {
    const quota = await deps.takeQuota(authorization);
    if (quota === null) return fail("unauthorized");
    if (!quota) return fail("rate_limited");
    if (image) {
      const photo = await fetchRecipeImage(url, deps, limits);
      return new Response(photo.bytes as BodyInit, { status: 200, headers: { ...CORS, "content-type": photo.type, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    }
    const page = await fetchRecipePage(url, deps, limits);
    const draft = draftFromHtml(page.html, page.url.href);
    return draft ? reply({ draft }, 200) : fail("no_recipe");
  } catch (e) {
    return fail(e instanceof ImportError ? e.code : "fetch_failed");
  }
}

/** Limita de cereri prin PostgREST, cu tokenul omului (fără service_role). `rpc` alege limita (import sau traducere). */
export function quotaViaRest(fetchFn: typeof fetch, supabaseUrl: string, anonKey: string, rpc = "take_recipe_import_quota"): ImportDeps["takeQuota"] {
  return async (authorization) => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { apikey: anonKey, authorization, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      throw new ImportError("fetch_failed");
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new ImportError("fetch_failed");
    return (await res.json()) === true;
  };
}
