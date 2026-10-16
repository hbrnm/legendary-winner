// Funcția Edge `import-recipe` (.tasks/009, etapa 2). Toată logica e în
// core.js, împachetat din src/lib/server/import-recipe.ts (npm run build:functions);
// aici doar legăturile cu Deno: rețeaua, DNS-ul și limita de cereri prin PostgREST.
// Supabase verifică tokenul (verify_jwt implicit); SUPABASE_URL și
// SUPABASE_ANON_KEY le pune Supabase în mediul funcției. Fără service_role.

import { handleImportRequest, quotaViaRest } from "./core.js";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  resolveDns(host: string, type: "A" | "AAAA"): Promise<string[]>;
  env: { get(name: string): string | undefined };
};

async function resolveHost(host: string): Promise<string[]> {
  const found = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
  return found.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

Deno.serve((req) => handleImportRequest(req, { fetch, resolveHost, takeQuota }));
