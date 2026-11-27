import { createNutritionLookup } from "./core.js";

declare const Deno: {
  serve(handler: (request: Request) => Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

const url = Deno.env.get("SUPABASE_URL");
const apiKey = Deno.env.get("SUPABASE_ANON_KEY");

async function takeQuota(token: string): Promise<boolean | null> {
  if (!url || !apiKey) throw new Error("Missing Supabase configuration");
  const response = await fetch(`${url}/rest/v1/rpc/take_nutrition_lookup_quota`, {
    method: "POST",
    headers: { authorization: token, apikey: apiKey, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(4000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Nutrition quota unavailable");
  const allowed: unknown = await response.json();
  if (typeof allowed !== "boolean") throw new Error("Invalid nutrition quota response");
  return allowed;
}

Deno.serve(createNutritionLookup(fetch, Deno.env.get("OPEN_FOOD_FACTS_CONTACT") ?? "", takeQuota));
