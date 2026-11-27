// Generat de scripts/build-functions.mjs din src/lib/server/. Nu edita de mână: npm run build:functions.

// src/lib/domain/barcode.ts
function isGtin(code) {
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) return false;
  return [...code].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
}

// src/lib/server/edge-body.ts
async function readJsonBody(req, maxBytes) {
  const clHeader = req.headers.get("content-length");
  if (clHeader !== null) {
    const cl = Number(clHeader);
    if (Number.isFinite(cl) && cl > maxBytes) {
      return { ok: false, status: 413, error: "too_large" };
    }
  }
  if (!req.body) {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const reader = req.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("too_large").catch(() => {
          });
          return { ok: false, status: 413, error: "too_large" };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
  if (chunks.length === 0) {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const total = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(total);
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
}

// src/lib/server/lookup-nutrition.ts
function amount(nutrient, unit) {
  const value = nutrient?.value;
  return nutrient?.unit === unit && (!nutrient.modifier || nutrient.modifier === "=") && typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function extractNutrition(product, code) {
  if (typeof product.code !== "string" || product.code.padStart(14, "0") !== code.padStart(14, "0")) return null;
  const safeText = (value) => typeof value === "string" ? value.trim().slice(0, 160) : "";
  const name = safeText(product.product_name);
  const result = { code: product.code, name, brand: safeText(product.brands), quantity: safeText(product.quantity), nutrition: null };
  if (!name || !Array.isArray(product.nutrition?.input_sets)) return result;
  for (const set of product.nutrition.input_sets) {
    if (set?.preparation !== "as_sold" || set.per !== "100g" && set.per !== "100ml") continue;
    const kcal = amount(set.nutrients?.["energy-kcal"], "kcal");
    const protein_g = amount(set.nutrients?.proteins, "g");
    const carbs_g = amount(set.nutrients?.carbohydrates, "g");
    const fat_g = amount(set.nutrients?.fat, "g");
    if (kcal == null || protein_g == null || carbs_g == null || fat_g == null) continue;
    result.nutrition = { basis: set.per === "100ml" ? "ml" : "g", values: { kcal, protein_g, carbs_g, fat_g } };
    break;
  }
  return result;
}
var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function createNutritionLookup(fetchProduct, contact, takeQuota) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: cors });
  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "method" }, 405);
    const token = request.headers.get("authorization");
    if (!token?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
    const body = await readJsonBody(request, 100);
    if (!body.ok) return reply({ error: body.error }, body.status);
    const code = body.data?.code;
    if (typeof code !== "string" || !isGtin(code)) return reply({ error: "invalid_code" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return reply({ error: "unavailable" }, 503);
    const quota = await takeQuota(token).catch(() => void 0);
    if (quota === void 0) return reply({ error: "unavailable" }, 503);
    if (quota === null) return reply({ error: "unauthorized" }, 401);
    if (!quota) return reply({ error: "rate_limit" }, 429);
    const significantDigits = code.replace(/^0+/, "");
    const normalizedCode = significantDigits.padStart(significantDigits.length <= 8 ? 8 : 13, "0");
    const endpoint = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${normalizedCode}.json`);
    endpoint.searchParams.set("fields", "code,product_name,brands,quantity,nutrition");
    try {
      const response = await fetchProduct(endpoint, {
        headers: { "User-Agent": `Camara/0.1 (${contact})` },
        signal: AbortSignal.timeout(7e3),
        redirect: "error"
      });
      if (response.status === 404) return reply({ product: null });
      if (response.status === 429) return reply({ error: "rate_limit" }, 429);
      if (!response.ok) return reply({ error: "unavailable" }, 502);
      const data = await response.json();
      return reply({ product: data?.product ? extractNutrition(data.product, code) : null });
    } catch {
      return reply({ error: "unavailable" }, 502);
    }
  };
}
export {
  createNutritionLookup,
  extractNutrition
};
