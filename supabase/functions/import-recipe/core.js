// Generat de scripts/build-functions.mjs din src/lib/server/. Nu edita de mână: npm run build:functions.

// src/lib/domain/recipe-import.ts
var MAX_NAME = 120;
var MAX_DESCRIPTION = 1e3;
var MAX_STEP = 1500;
var MAX_INGREDIENT = 200;
var MAX_URL = 500;
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "„", deg: "°", frac12: "½", frac14: "¼", frac34: "¾" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (all, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 1114111 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}
function plainText(value) {
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
function clip(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}
function cleanSourceUrl(input) {
  let url;
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
function parseIsoDuration(value) {
  if (typeof value !== "string") return null;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim());
  if (!m || value.trim().length <= 2) return null;
  const [, d, h, min, s] = m.map((x) => x === void 0 ? 0 : Number(x));
  const total = Math.round(d * 1440 + h * 60 + min + s / 60);
  return total <= 2880 ? total : null;
}
function parseYield(value) {
  const first = Array.isArray(value) ? value.find((v) => parseYield(v) != null) : value;
  if (typeof first === "number") return Number.isInteger(first) && first >= 1 && first <= 50 ? first : null;
  if (typeof first !== "string") return null;
  const m = /^\D{0,20}?(\d{1,2})(?![.,]\d)(?!\s*[-–]\s*\d)\b/.exec(first.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 50 ? n : null;
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function hasType(node, type) {
  const t = node["@type"];
  const is = (v) => typeof v === "string" && v.replace(/^.*[/:#]/, "") === type;
  return Array.isArray(t) ? t.some(is) : is(t);
}
function extractJsonLd(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const body = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/^<!--|-->$/g, "").trim();
    try {
      out.push(JSON.parse(body));
    } catch {
    }
  }
  return out;
}
function findRecipeNode(data, depth = 0) {
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
function instructionTexts(value, depth = 0) {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    return value.split(/<br\s*\/?>|<\/p>|<\/li>|\r?\n/i).map((s) => stripStepNumber(plainText(s))).filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((v) => instructionTexts(v, depth + 1));
  if (!isObject(value)) return [];
  if (hasType(value, "HowToSection") || value.itemListElement) return instructionTexts(value.itemListElement, depth + 1);
  const text = plainText(value.text) || plainText(value.name) || plainText(value.description);
  return text ? [stripStepNumber(text)].filter(Boolean) : [];
}
function stringList(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return list.map((v) => plainText(v)).filter(Boolean);
}
function draftFromJsonLd(node, sourceUrl = null) {
  const name = plainText(node.name) || plainText(node.headline);
  const ingredients = stringList(node.recipeIngredient ?? node.ingredients).map((s) => clip(s, MAX_INGREDIENT));
  const steps = instructionTexts(node.recipeInstructions).map((s) => clip(s, MAX_STEP));
  if (!name || ingredients.length === 0 && steps.length === 0) return null;
  return {
    name: clip(name, MAX_NAME),
    description: clip(plainText(node.description), MAX_DESCRIPTION),
    servings: parseYield(node.recipeYield),
    // Timpul total poate include dospirea sau odihna, deci nu se transformă în timp de gătit.
    prep_minutes: parseIsoDuration(node.prepTime),
    cook_minutes: parseIsoDuration(node.cookTime),
    ingredients,
    steps,
    source_url: sourceUrl ? cleanSourceUrl(sourceUrl) : null
  };
}
function draftFromHtml(html, sourceUrl = null) {
  for (const block of extractJsonLd(html)) {
    const node = findRecipeNode(block);
    const draft = node && draftFromJsonLd(node, sourceUrl);
    if (draft) return draft;
  }
  return null;
}
function stripStepNumber(line) {
  return line.replace(/^(?:(?:pasul|pas|step)\s*\d+\s*[:.)\-–]?|\d{1,2}\s*[.)](?!\d)|\d{1,2}\s*[-–:]\s(?!\d))\s*/i, "").trim();
}
var UNITS = [
  ["g", "g", 1],
  ["gr", "g", 1],
  ["grame", "g", 1],
  ["gram", "g", 1],
  ["grams", "g", 1],
  ["kg", "kg", 1],
  ["kilograme", "kg", 1],
  ["kilogram", "kg", 1],
  ["kilograms", "kg", 1],
  ["ml", "ml", 1],
  ["mililitri", "ml", 1],
  ["milliliters", "ml", 1],
  ["millilitres", "ml", 1],
  ["cl", "ml", 10],
  ["dl", "ml", 100],
  ["l", "l", 1],
  ["litri", "l", 1],
  ["litru", "l", 1],
  ["liter", "l", 1],
  ["liters", "l", 1],
  ["litre", "l", 1],
  ["litres", "l", 1],
  ["lb", "g", 453.59237],
  ["lbs", "g", 453.59237],
  ["pound", "g", 453.59237],
  ["pounds", "g", 453.59237],
  ["oz", "g", 28.349523125],
  ["ounce", "g", 28.349523125],
  ["ounces", "g", 28.349523125],
  ["lingura", "lingura", 1],
  ["linguri", "lingura", 1],
  ["lg", "lingura", 1],
  ["tbsp", "lingura", 1],
  ["tablespoon", "lingura", 1],
  ["tablespoons", "lingura", 1],
  ["lingurita", "lingurita", 1],
  ["lingurite", "lingurita", 1],
  ["lgt", "lingurita", 1],
  ["lgta", "lingurita", 1],
  ["tsp", "lingurita", 1],
  ["teaspoon", "lingurita", 1],
  ["teaspoons", "lingurita", 1],
  ["cana", "cana", 1],
  ["cani", "cana", 1],
  // Măsurile americane de volum, în ml (cana de 240 ml, ca pe etichetele din SUA).
  ["cup", "ml", 240],
  ["cups", "ml", 240],
  // Fără abrevieri („pt” e și „pentru” în română).
  ["pint", "ml", 473],
  ["pints", "ml", 473],
  ["quart", "ml", 946],
  ["quarts", "ml", 946],
  ["gallon", "ml", 3785],
  ["gallons", "ml", 3785],
  ["buc", "buc", 1],
  ["bucata", "buc", 1],
  ["bucati", "buc", 1],
  ["pcs", "buc", 1],
  ["piece", "buc", 1],
  ["pieces", "buc", 1],
  ["legatura", "legatura", 1],
  ["legaturi", "legatura", 1],
  ["bunch", "legatura", 1],
  ["bunches", "legatura", 1],
  ["catel", "catel", 1],
  ["catei", "catel", 1],
  ["clove", "catel", 1],
  ["cloves", "catel", 1],
  ["felie", "felie", 1],
  ["felii", "felie", 1],
  ["slice", "felie", 1],
  ["slices", "felie", 1],
  ["pachet", "pachet", 1],
  ["pachete", "pachet", 1],
  ["package", "pachet", 1],
  ["packages", "pachet", 1],
  ["plic", "plic", 1],
  ["plicuri", "plic", 1],
  ["sachet", "plic", 1],
  ["sachets", "plic", 1],
  ["conserva", "conserva", 1],
  ["conserve", "conserva", 1],
  ["can", "conserva", 1],
  ["cans", "conserva", 1],
  ["tin", "conserva", 1],
  ["tins", "conserva", 1],
  ["borcan", "borcan", 1],
  ["borcane", "borcan", 1],
  ["jar", "borcan", 1],
  ["jars", "borcan", 1],
  ["cutie", "cutie", 1],
  ["cutii", "cutie", 1],
  ["box", "cutie", 1],
  ["boxes", "cutie", 1],
  ["sticla", "sticla", 1],
  ["sticle", "sticla", 1],
  ["bottle", "sticla", 1],
  ["bottles", "sticla", 1],
  ["punga", "punga", 1],
  ["pungi", "punga", 1],
  ["bag", "punga", 1],
  ["bags", "punga", 1]
];
var UNIT_MAP = new Map(UNITS.map(([w, code, factor]) => [w, { code, factor }]));
var WORD_NUMBERS = new Map(Object.entries({ un: 1, o: 1, una: 1, unu: 1, a: 1, an: 1, one: 1, doua: 2, doi: 2, two: 2, trei: 3, three: 3, patru: 4, four: 4, cinci: 5, five: 5, sase: 6, six: 6, jumatate: 0.5, half: 0.5 }));
var FRACTIONS = new Map(Object.entries({ "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 }));
var FAHRENHEIT = String.raw`(?<!\d)(\d{2,3})\s*(?:[°º]\s*F|degrees?\s+(?:F|Fahrenheit)|F)(?!\p{L})`;
var CELSIUS = String.raw`(?<!\d)(\d{2,3})\s*[°º]\s*C(?!\p{L})`;
var PAIR = String.raw`\s*(?:\(\s*X\s*\)|\/\s*X|,?\s+(?:or|and|sau|ori|si|și)\s+X)`;
var RANGE = String.raw`\s*(?:-|–|to)\s*`;
var INCHES = String.raw`(?<![\d/])(\d+\s+\d\/\d|\d\/\d|\d+(?:\.\d+)?)`;
var INCH = String.raw`\s*-?\s*inch(?:es)?(?!\p{L})`;

// src/lib/server/import-recipe.ts
var IMPORT_LIMITS = {
  /** Timpul total pentru pagină, cu tot cu redirecționări. */
  timeoutMs: 1e4,
  maxBytes: 3e6,
  maxRedirects: 3,
  maxUrlLength: 500
};
var STATUS = {
  bad_request: 400,
  unauthorized: 401,
  rate_limited: 429,
  invalid_url: 400,
  blocked_address: 400,
  fetch_failed: 502,
  timeout: 504,
  too_large: 413,
  not_html: 422,
  no_recipe: 422
};
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info"
};
var ImportError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
function ipv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const n = parts.map(Number);
  return n.every((x) => x <= 255) ? n : null;
}
function ipv6(host) {
  let s = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!s.includes(":") || s.includes("%")) return null;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4) {
    const n = ipv4(v4[1]);
    if (!n) return null;
    s = s.slice(0, -v4[1].length) + (n[0] << 8 | n[1]).toString(16) + ":" + (n[2] << 8 | n[3]).toString(16);
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
function isPublicAddress(ip) {
  const v4 = ipv4(ip);
  if (v4) {
    const [a, b, c] = v4;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 192 && b === 0 && (c === 0 || c === 2) || a === 198 && (b === 18 || b === 19) || a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113);
  }
  const v6 = ipv6(ip);
  if (!v6) return false;
  const [g0, g1] = v6;
  if (g0 < 8192 || g0 > 16383) return false;
  if (g0 === 8194) return false;
  if (g0 === 8193 && (g1 === 0 || g1 === 3512)) return false;
  return true;
}
function parseImportUrl(input) {
  if (typeof input !== "string" || !input.trim() || input.length > IMPORT_LIMITS.maxUrlLength) return null;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !url.hostname.includes(".")) return null;
  return url;
}
function within(p, signal) {
  if (signal.aborted) return Promise.reject(new ImportError("timeout"));
  return new Promise((resolve, reject) => {
    const stop = () => reject(new ImportError("timeout"));
    signal.addEventListener("abort", stop, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
async function checkHost(url, deps, signal) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = ipv4(host) || ipv6(host);
  const addresses = literal ? [host] : await within(deps.resolveHost(host).catch(() => []), signal);
  if (addresses.length === 0) throw new ImportError("fetch_failed");
  if (!addresses.every(isPublicAddress)) throw new ImportError("blocked_address");
}
async function readLimited(res, maxBytes) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) {
    await res.body?.cancel().catch(() => {
    });
    throw new ImportError("too_large");
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {
      });
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
function charsetOf(bytes, contentType) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
}
function decode(bytes, contentType) {
  const charset = charsetOf(bytes, contentType);
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
async function fetchRecipePage(start, deps, limits = IMPORT_LIMITS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  try {
    let url = start;
    for (let hop = 0; ; hop++) {
      await checkHost(url, deps, controller.signal);
      const res = await deps.fetch(url.href, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "CamaraApp/0.1 (import retete)" }
      }).catch((e) => {
        throw new ImportError(controller.signal.aborted || e instanceof Error && e.name === "AbortError" ? "timeout" : "fetch_failed");
      });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {
        });
        const next = parseImportUrl(new URL(res.headers.get("location") ?? "", url).href);
        if (!next) throw new ImportError(res.headers.get("location") ? "invalid_url" : "fetch_failed");
        if (hop >= limits.maxRedirects) throw new ImportError("fetch_failed");
        url = next;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {
        });
        throw new ImportError("fetch_failed");
      }
      const type = res.headers.get("content-type") ?? "";
      if (type.trim() && !/^\s*(text\/html|application\/xhtml\+xml)/i.test(type)) {
        await res.body?.cancel().catch(() => {
        });
        throw new ImportError("not_html");
      }
      const bytes = await readLimited(res, limits.maxBytes).catch((e) => {
        if (e instanceof ImportError) throw e;
        throw new ImportError(controller.signal.aborted ? "timeout" : "fetch_failed");
      });
      return { html: decode(bytes, type), url };
    }
  } finally {
    clearTimeout(timer);
  }
}
function reply(body, status) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: body ? { ...CORS, "content-type": "application/json; charset=utf-8" } : CORS
  });
}
var fail = (code) => reply({ error: code }, STATUS[code]);
async function handleImportRequest(req, deps, limits = IMPORT_LIMITS) {
  if (req.method === "OPTIONS") return reply(null, 204);
  if (req.method !== "POST") return fail("bad_request");
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) return fail("unauthorized");
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const url = parseImportUrl(body?.url);
  if (!url) return fail("invalid_url");
  try {
    const quota = await deps.takeQuota(authorization);
    if (quota === null) return fail("unauthorized");
    if (!quota) return fail("rate_limited");
    const page = await fetchRecipePage(url, deps, limits);
    const draft = draftFromHtml(page.html, page.url.href);
    return draft ? reply({ draft }, 200) : fail("no_recipe");
  } catch (e) {
    return fail(e instanceof ImportError ? e.code : "fetch_failed");
  }
}
function quotaViaRest(fetchFn, supabaseUrl, anonKey, rpc = "take_recipe_import_quota") {
  return async (authorization) => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { apikey: anonKey, authorization, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5e3)
    }).catch(() => {
      throw new ImportError("fetch_failed");
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new ImportError("fetch_failed");
    return await res.json() === true;
  };
}
export {
  IMPORT_LIMITS,
  fetchRecipePage,
  handleImportRequest,
  isPublicAddress,
  parseImportUrl,
  quotaViaRest
};
