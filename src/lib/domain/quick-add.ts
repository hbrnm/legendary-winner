import type { UnitCode } from "./types";
import { normalize } from "./search";

const UNIT_WORDS: [string, UnitCode][] = [
  ["kg", "kg"],
  ["kilograme", "kg"],
  ["kilogram", "kg"],
  ["kile", "kg"],
  ["g", "g"],
  ["gr", "g"],
  ["grame", "g"],
  ["l", "l"],
  ["litri", "l"],
  ["litru", "l"],
  ["ml", "ml"],
  ["buc", "buc"],
  ["bucati", "buc"],
  ["bucata", "buc"],
  ["legaturi", "legatura"],
  ["legatura", "legatura"],
  ["borcane", "borcan"],
  ["borcan", "borcan"],
  ["caserole", "caserola"],
  ["caserola", "caserola"],
  ["pungi", "punga"],
  ["punga", "punga"],
  ["pachete", "pachet"],
  ["pachet", "pachet"],
  ["sticle", "sticla"],
  ["sticla", "sticla"],
  ["cutii", "cutie"],
  ["cutie", "cutie"],
  ["role", "rola"],
  ["rola", "rola"],
];
const UNIT_MAP = new Map(UNIT_WORDS);

export interface QuickAdd {
  text: string;
  quantity: number | null;
  unit: UnitCode | null;
}

function num(s: string): number | null {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Înțelege ce scrie omul în câmpul de adăugare rapidă:
 * „2 kg roșii”, „roșii 2kg”, „6 ouă”, „lapte 2 l”, „1,5 kg cartofi”, „pâine”.
 */
export function parseQuickAdd(input: string): QuickAdd {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return { text: "", quantity: null, unit: null };

  // Lipite: „2kg”, „500g”, „1,5l”.
  const tokens = raw.split(" ").flatMap((t) => {
    const m = /^(\d+(?:[.,]\d+)?)([a-zA-Zăâîșțşţ]+)$/.exec(t);
    return m && UNIT_MAP.has(normalize(m[2])) ? [m[1], m[2]] : [t];
  });

  const isNum = (t: string | undefined) => t !== undefined && /^\d+(?:[.,]\d+)?$/.test(t);
  const unitOf = (t: string | undefined) => (t === undefined ? undefined : UNIT_MAP.get(normalize(t)));

  // La început: „2 kg roșii” sau „6 ouă”.
  if (isNum(tokens[0])) {
    const q = num(tokens[0]);
    const u = unitOf(tokens[1]);
    const rest = tokens.slice(u ? 2 : 1).join(" ");
    if (rest) return { text: rest, quantity: q, unit: u ?? null };
  }
  // La final: „roșii 2 kg” sau „ouă 10”.
  const n = tokens.length;
  if (n >= 3 && isNum(tokens[n - 2]) && unitOf(tokens[n - 1])) {
    return { text: tokens.slice(0, n - 2).join(" "), quantity: num(tokens[n - 2]), unit: unitOf(tokens[n - 1])! };
  }
  if (n >= 2 && isNum(tokens[n - 1])) {
    return { text: tokens.slice(0, n - 1).join(" "), quantity: num(tokens[n - 1]), unit: null };
  }
  return { text: raw, quantity: null, unit: null };
}
