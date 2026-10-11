// Ceasul aplicației. Testele îl fixează, ca rezultatele să nu depindă de data de azi.
let fixed: Date | null = null;

export function now(): Date {
  return fixed ? new Date(fixed) : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

export function setClock(date: Date | string | null): void {
  fixed = date == null ? null : new Date(date);
}
