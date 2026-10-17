// Funcția Edge `translate-recipe` (.tasks/012, etapa 1). Toată logica e în
// core.js, împachetat din src/lib/server/translate-recipe.ts (npm run build:functions);
// aici doar legăturile cu Deno: modelul (SDK-ul Anthropic, versiunea din
// deno.json) și limita de cereri prin PostgREST. Supabase verifică tokenul
// (verify_jwt). ANTHROPIC_API_KEY e un secret al funcțiilor, pus din panoul
// Supabase; SUPABASE_URL și SUPABASE_ANON_KEY le pune Supabase. Fără service_role.

import Anthropic from "@anthropic-ai/sdk";
import { handleTranslateRequest, modelTranslator, quotaViaRest } from "./core.js";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

// Fără reîncercare după timeout: cel mult 25 s, cât așteaptă și aplicația.
const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), timeout: 25_000, maxRetries: 0 });
const translate = modelTranslator((params: Anthropic.MessageCreateParamsNonStreaming) => client.messages.create(params));

const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", "take_recipe_translate_quota");

Deno.serve((req) => handleTranslateRequest(req, { takeQuota, translate }));
