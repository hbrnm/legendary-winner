import { isGtin } from "../domain/barcode";
import type { ProductNutritionSuggestion } from "../domain/calories";
import { readJsonBody } from "./edge-body";

type Nutrient = { value?: unknown; unit?: string; modifier?: string };
type NutritionSet = {
  per?: string;
  preparation?: string;
  nutrients?: Record<string, Nutrient | undefined>;
};
type ProductResult = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutrition?: { input_sets?: NutritionSet[] };
};

function amount(nutrient: Nutrient | undefined, unit: string): number | null {
  const value = nutrient?.value;
  return nutrient?.unit === unit && (!nutrient.modifier || nutrient.modifier === "=")
    && typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function extractNutrition(product: ProductResult, code: string): ProductNutritionSuggestion | null {
  if (typeof product.code !== "string" || product.code.padStart(14, "0") !== code.padStart(14, "0")) return null;
  const safeText = (value?: string) => typeof value === "string" ? value.trim().slice(0, 160) : "";
  const name = safeText(product.product_name);
  const result: ProductNutritionSuggestion = { code: product.code, name, brand: safeText(product.brands), quantity: safeText(product.quantity), nutrition: null };
  if (!name || !Array.isArray(product.nutrition?.input_sets)) return result;
  for (const set of product.nutrition.input_sets) {
    if (set?.preparation !== "as_sold" || (set.per !== "100g" && set.per !== "100ml")) continue;
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function createNutritionLookup(
  fetchProduct: typeof fetch,
  contact: string,
  takeQuota: (token: string) => Promise<boolean | null>,
) {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "method" }, 405);
    const token = request.headers.get("authorization");
    if (!token?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
    const body = await readJsonBody<{ code?: unknown }>(request, 100);
    if (!body.ok) return reply({ error: body.error }, body.status);
    const code = body.data?.code;
    if (typeof code !== "string" || !isGtin(code)) return reply({ error: "invalid_code" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return reply({ error: "unavailable" }, 503);
    const quota = await takeQuota(token).catch(() => undefined);
    if (quota === undefined) return reply({ error: "unavailable" }, 503);
    if (quota === null) return reply({ error: "unauthorized" }, 401);
    if (!quota) return reply({ error: "rate_limit" }, 429);

    const significantDigits = code.replace(/^0+/, "");
    const normalizedCode = significantDigits.padStart(significantDigits.length <= 8 ? 8 : 13, "0");
    const endpoint = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${normalizedCode}.json`);
    endpoint.searchParams.set("fields", "code,product_name,brands,quantity,nutrition");
    try {
      const response = await fetchProduct(endpoint, {
        headers: { "User-Agent": `Camara/0.1 (${contact})` },
        signal: AbortSignal.timeout(7000),
        redirect: "error",
      });
      if (response.status === 404) return reply({ product: null });
      if (response.status === 429) return reply({ error: "rate_limit" }, 429);
      if (!response.ok) return reply({ error: "unavailable" }, 502);
      const data = await response.json() as { product?: ProductResult };
      return reply({ product: data?.product ? extractNutrition(data.product, code) : null });
    } catch {
      return reply({ error: "unavailable" }, 502);
    }
  };
}
