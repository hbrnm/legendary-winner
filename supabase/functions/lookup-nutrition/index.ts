import { createNutritionLookup } from "./core.js";

declare const Deno: {
  serve(handler: (request: Request) => Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

const url = Deno.env.get("SUPABASE_URL");
const apiKey = Deno.env.get("SUPABASE_ANON_KEY");

async function authorize(token: string): Promise<boolean | string> {
  if (!url || !apiKey) return false;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: token, apikey: apiKey },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return false;
  const user = await response.json().catch(() => null) as { id?: unknown } | null;
  return typeof user?.id === "string" && user.id ? user.id : true;
}

Deno.serve(createNutritionLookup(fetch, Deno.env.get("OPEN_FOOD_FACTS_CONTACT") ?? "", authorize));
