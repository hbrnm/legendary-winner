import type { ISODate } from "./types";

// Toate calculele pe zile folosesc data locală, nu UTC: o cumpărătură
// făcută la 00:30 ora României aparține zilei respective.

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from).getTime();
  const b = parseISODate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Luni ca prima zi a săptămânii. */
export function startOfWeek(date: ISODate): ISODate {
  const d = parseISODate(date);
  const dow = (d.getDay() + 6) % 7;
  return addDays(date, -dow);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const d = parseISODate(startOfMonth(date));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISODate(d);
}

export interface Period {
  from: ISODate;
  to: ISODate; // inclusiv
}

export function weekPeriod(date: ISODate): Period {
  const from = startOfWeek(date);
  return { from, to: addDays(from, 6) };
}

export function monthPeriod(date: ISODate): Period {
  return { from: startOfMonth(date), to: endOfMonth(date) };
}

export function inPeriod(date: ISODate, p: Period): boolean {
  return date >= p.from && date <= p.to;
}

/** Data locală a unui moment ISO (ex. checked_at). */
export function localDateOf(iso: string): ISODate {
  return toISODate(new Date(iso));
}

const LONG = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });
const MONTH = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("ro-RO", { weekday: "short" });

export const formatLongDate = (d: ISODate) => LONG.format(parseISODate(d));
export const formatShortDate = (d: ISODate) => SHORT.format(parseISODate(d));
export const formatMonth = (d: ISODate) => MONTH.format(parseISODate(d));
export const formatWeekdayShort = (d: ISODate) => WEEKDAY_SHORT.format(parseISODate(d));
