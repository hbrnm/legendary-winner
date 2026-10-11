/**
 * Număr + substantiv, cu acordul din română: 1 produs, 2 produse, 20 de produse,
 * 101 produse, 120 de produse.
 */
export function count(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = Math.abs(n) % 100;
  const de = n !== 0 && (rest === 0 || rest >= 20) ? " de" : "";
  return `${n}${de} ${many}`;
}

/** Prima literă mare (pentru început de frază), restul neschimbat. */
export function capitalizeFirst(s: string): string {
  return s ? s[0].toLocaleUpperCase("ro-RO") + s.slice(1) : s;
}
