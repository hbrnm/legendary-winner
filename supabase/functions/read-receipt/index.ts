// Funcția Edge `read-receipt` (.tasks/015). Toată logica e în core.js,
// împachetat din src/lib/server/read-receipt.ts (npm run build:functions);
// aici doar legăturile cu Deno: rețeaua și limita de cereri prin PostgREST.
// Supabase verifică tokenul (verify_jwt). GEMINI_API_KEY (și, opțional,
// GEMINI_MODEL) sunt secretele puse pentru traducere (.tasks/012), comune
// funcțiilor; SUPABASE_URL și SUPABASE_ANON_KEY le pune Supabase. Fără service_role.

import { geminiReceiptReader, handleReceiptRequest, quotaViaRest } from "./core.js";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  env: { get(name: string): string | undefined };
};

const read = geminiReceiptReader(fetch, Deno.env.get("GEMINI_API_KEY") ?? "", Deno.env.get("GEMINI_MODEL") || undefined);
const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", "take_receipt_read_quota");

Deno.serve((req) => handleReceiptRequest(req, { takeQuota, read }));
