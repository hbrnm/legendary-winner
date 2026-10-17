// Funcția Edge `translate-recipe` (.tasks/012). Toată logica e în core.js,
// împachetat din src/lib/server/translate-recipe.ts (npm run build:functions);
// aici doar legăturile cu Deno: rețeaua și limita de cereri prin PostgREST.
// Supabase verifică tokenul (verify_jwt). DEEPL_API_KEY e un secret al
// funcțiilor, pus din panoul Supabase; SUPABASE_URL și SUPABASE_ANON_KEY le
// pune Supabase. Fără service_role.

import { deeplTranslator, handleTranslateRequest, quotaViaRest } from "./core.js";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

const translate = deeplTranslator(fetch, Deno.env.get("DEEPL_API_KEY") ?? "");
const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", "take_recipe_translate_quota");

Deno.serve((req) => handleTranslateRequest(req, { takeQuota, translate }));
