// Identificatori. Rândurile noi primesc UUID v4. Rândurile care trebuie să
// fie unice logic (o tură de cumpărături, o rețetă favorită) primesc un UUID
// v5 derivat din cheia lor, ca două dispozitive offline să producă același
// id și să nu apară dubluri după sincronizare.

const NAMESPACE = "6f1c8f0e-6d1a-4c4b-9a52-7f3d2b6c9e10";

export function newId(): string {
  return crypto.randomUUID();
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function stableId(...parts: string[]): Promise<string> {
  const name = new TextEncoder().encode(parts.join("|"));
  const ns = hexToBytes(NAMESPACE);
  const data = new Uint8Array(ns.length + name.length);
  data.set(ns);
  data.set(name, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", data)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
