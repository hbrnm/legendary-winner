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
export const zNote = z.string().trim().max(500, "Observația poate avea cel mult 500 de caractere.");

/** Validează și întoarce datele, sau aruncă o eroare cu primul mesaj, pe înțelesul utilizatorului. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserError(r.error.issues[0]?.message ?? "Datele introduse nu sunt valide.");
  return r.data;
}
