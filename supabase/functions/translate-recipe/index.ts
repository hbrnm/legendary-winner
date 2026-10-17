// Funcția Edge `translate-recipe` (.tasks/012, etapa 1). Toată logica e în
// core.js, împachetat din src/lib/server/translate-recipe.ts (npm run build:functions);
// aici doar legăturile cu Deno: modelul (SDK-ul Anthropic, versiunea din
// deno.json) și limita de cereri prin PostgREST. Supabase verifică tokenul
// (verify_jwt). ANTHROPIC_API_KEY e un secret al funcțiilor, pus din panoul
// Supabase; SUPABASE_URL și SUPABASE_ANON_KEY le pune Supabase. Fără service_role.

import Anthropic from "@anthropic-ai/sdk";
import { TRANSLATION_SCHEMA, TRANSLATION_SYSTEM, handleTranslateRequest, quotaViaRest } from "./core.js";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), timeout: 25_000, maxRetries: 1 });

/** Traducerea cu Claude Haiku 5.5 (decizia proprietarului), ca JSON după TRANSLATION_SCHEMA. */
async function translate(input: string): Promise<unknown> {
  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 16000,
    system: TRANSLATION_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: TRANSLATION_SCHEMA } },
    messages: [{ role: "user", content: input }],
  });
  // Refuz, text tăiat sau altă oprire: fără traducere (rețeta rămâne în limba ei).
  if (response.stop_reason !== "end_turn") throw new Error(`stop_reason: ${response.stop_reason}`);
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("fără text");
  return JSON.parse(text.text);
}

const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", "take_recipe_translate_quota");

Deno.serve((req) => handleTranslateRequest(req, { takeQuota, translate }));
