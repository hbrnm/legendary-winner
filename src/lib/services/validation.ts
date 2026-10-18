import { z } from "zod";
import { UNIT_CODES } from "@/lib/domain/units";
import type { UnitCode } from "@/lib/domain/types";
import { UserError } from "./context";

export const zName = (max: number, what = "Numele") =>
  z
    .string()
    .trim()
    .min(1, `${what} nu poate fi gol.`)
    .max(max, `${what} poate avea cel mult ${max} caractere.`);

export const zUnit = z.enum(UNIT_CODES as [UnitCode, ...UnitCode[]]);
export const zQuantity = z.number().positive("Cantitatea trebuie să fie mai mare decât zero.").max(100000, "Cantitatea e prea mare.");
export const zMoney = z.number().min(0, "Suma nu poate fi negativă.").max(1_000_000, "Suma e prea mare.");
export const zSource = z.enum(["supermarket", "piata", "producator", "alta"]);
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data nu e validă.");
export const zEan = z.string().regex(/^(\d{8}|\d{12,14})$/, "Codul de bare are 8, 12, 13 sau 14 cifre.");
export const zNote = z.string().trim().max(500, "Observația poate avea cel mult 500 de caractere.");

/** Validează și întoarce datele, sau aruncă o eroare cu primul mesaj, pe înțelesul utilizatorului. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserError(r.error.issues[0]?.message ?? "Datele introduse nu sunt valide.");
  return r.data;
}

/**
 * Validează o modificare parțială și întoarce doar câmpurile trimise. Cu
 * zod 4, `.partial()` aplică și valorile implicite (`.default(...)`), deci
 * câmpurile netrimise s-ar reseta (ex. lista redenumită n-ar mai fi recurentă).
 */
export function parsePatch<T extends z.ZodObject>(schema: T, patch: object): Partial<z.output<T>> {
  const v = parse(schema.partial(), patch) as Record<string, unknown>;
  const sent = patch as Record<string, unknown>;
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== undefined && Object.hasOwn(sent, k) && sent[k] !== undefined)) as Partial<z.output<T>>;
}
