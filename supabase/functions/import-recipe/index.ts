// Funcția Edge `import-recipe` (.tasks/009, etapa 2). Toată logica e în
// core.js, împachetat din src/lib/server/import-recipe.ts (npm run build:functions);
// aici doar legăturile cu Deno: rețeaua, DNS-ul și limita de cereri prin PostgREST.
// Supabase verifică tokenul (verify_jwt implicit); SUPABASE_URL și
// SUPABASE_ANON_KEY le pune Supabase în mediul funcției. Fără service_role.

import { createProxiedFetch, egressProxyUnavailableResponse, handleImportRequest, quotaViaRest } from "./core.js";

type HttpClient = { close(): void };

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  resolveDns(host: string, type: "A" | "AAAA"): Promise<string[]>;
  createHttpClient(options: { proxy: { url: string } }): HttpClient;
  env: { get(name: string): string | undefined };
};

async function resolveHost(host: string): Promise<string[]> {
  const found = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
  return found.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

const takeQuota = quotaViaRest(fetch, Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

const proxyUrl = Deno.env.get("RECIPE_IMPORT_EGRESS_PROXY");
let proxyClient: HttpClient | undefined;
if (proxyUrl) {
  try {
    proxyClient = Deno.createHttpClient({ proxy: { url: proxyUrl } });
  } catch {
    console.error("Invalid egress proxy configuration for import-recipe.");
  }
}

const fetchThroughProxy = createProxiedFetch(fetch, proxyClient);

Deno.serve((req) => {
  const unavailable = egressProxyUnavailableResponse(req, Boolean(proxyClient));
  if (unavailable) return unavailable;
  return handleImportRequest(req, { fetch: fetchThroughProxy, resolveHost, takeQuota });
});
