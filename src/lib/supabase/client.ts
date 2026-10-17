import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Doar cheile publice ajung în aplicație. Accesul la date e controlat de RLS.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isCloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isCloudConfigured) throw new Error("Supabase nu este configurat (vezi ENVIRONMENT_VARIABLES.md)");
  client ??= createClient(url!, anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

/** Traducerea în română a unei rețete importate (funcția Edge translate-recipe, .tasks/012), cu tokenul sesiunii. */
export async function callTranslateRecipe(body: { recipe: { name: string; description: string; steps: string[] } }): Promise<Response> {
  const { data } = await supabase().auth.getSession();
  return fetch(`${url}/functions/v1/translate-recipe`, {
    method: "POST",
    headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: anonKey!, "content-type": "application/json" },
    body: JSON.stringify(body),
    // Fără răspuns în 30 s: rețeta rămâne în limba ei, iar butonul nu rămâne blocat.
    signal: AbortSignal.timeout(30_000),
  });
}

/** Cererea către funcția Edge `import-recipe`, cu tokenul sesiunii (.tasks/009). */
export async function callImportRecipe(body: { url: string }): Promise<Response> {
  const { data } = await supabase().auth.getSession();
  return fetch(`${url}/functions/v1/import-recipe`, {
    method: "POST",
    headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: anonKey!, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
