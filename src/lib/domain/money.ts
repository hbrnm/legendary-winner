const RON = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" });

/** Rotunjire la bani (2 zecimale), fără erorile de virgulă mobilă. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumMoney(values: Iterable<number>): number {
  let cents = 0;
  for (const v of values) cents += Math.round(v * 100);
  return cents / 100;
}

export function formatRon(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return RON.format(value);
}

/** Citește o sumă scrisă de om: „12,50”, „12.5”, „12 lei”. Întoarce null dacă nu e validă. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/\s*(lei|ron)\s*$/i, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return roundMoney(Number(cleaned));
}
