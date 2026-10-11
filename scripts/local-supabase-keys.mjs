// Cheile publice ale Supabase-ului local de test (vezi local-supabase.mjs). Nu sunt secrete de producție.
import { createHmac } from "node:crypto";

export const JWT_SECRET = "camara-local-doar-pentru-teste-0123456789abcdef";

function b64url(s) {
  return Buffer.from(s).toString("base64url");
}

export function sign(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}

export const ANON_KEY = sign({ iss: "supabase-local", role: "anon", iat: 1700000000, exp: 2100000000 });
