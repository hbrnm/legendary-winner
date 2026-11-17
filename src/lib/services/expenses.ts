import { z } from "zod";
import { getMeta } from "@/lib/db/database";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { now } from "@/lib/clock";
import { parseISODate, toISODate } from "@/lib/domain/dates";
import { EXPENSE_CATEGORY_IDS } from "@/lib/domain/expense-categories";
import { type AppCtx, UserError, w } from "./context";
import { parse, parsePatch, zDate, zName, zNote, zSource } from "./validation";

export const expenseInput = z.object({
  place_name: zName(120, "Locul").nullable().optional(),
  retailer_id: z.string().min(1).nullable().optional(),
  source: zSource.nullable().optional(),
  note: zNote.nullable().optional(),
  description: zName(120, "Descrierea"),
  amount: z.number().positive("Suma trebuie să fie mai mare decât zero.").max(9_999_999.99, "Suma e prea mare.")
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Scrie suma cu cel mult două zecimale."),
  category_id: z.enum(EXPENSE_CATEGORY_IDS, { error: "Alege categoria cheltuielii." }),
  spent_on: zDate.refine((v) => toISODate(parseISODate(v)) === v, "Data nu e validă.")
    .refine((v) => v <= toISODate(now()), "Alege data plății de azi sau din trecut."),
});

async function requireRetailer(ctx: AppCtx, retailerId?: string | null) {
  if (!retailerId) return;
  const retailer = await ctx.db.retailers.get(retailerId);
  if (!retailer || retailer.deleted_at || (retailer.household_id !== null && retailer.household_id !== ctx.householdId)) throw new UserError("Locul nu este disponibil în această gospodărie.");
}

/** Evită scrieri pe un server care încă nu acceptă tabela/scopurile noi. */
export async function requireFamilyBudget(ctx: AppCtx): Promise<void> {
  if (ctx.sync && (await getMeta<boolean>(ctx.db, "server_missing:manual_expenses")) !== false) {
    throw new UserError("Cheltuielile familiei nu sunt încă disponibile. Verifică internetul și încearcă din nou după actualizare.");
  }
}

export async function createExpense(ctx: AppCtx, input: z.input<typeof expenseInput>): Promise<string> {
  const value = parse(expenseInput, input);
  await requireFamilyBudget(ctx);
  await requireRetailer(ctx, value.retailer_id);
  const id = newId();
  await insertRow(ctx.db, "manual_expenses", { id, household_id: ctx.householdId, ...value }, w(ctx));
  return id;
}

async function requireOwnedExpense(ctx: AppCtx, id: string) {
  const current = await ctx.db.manual_expenses.get(id);
  if (!current || current.deleted_at || current.household_id !== ctx.householdId) throw new UserError("Cheltuiala nu mai este disponibilă în această gospodărie.");
}

export async function updateExpense(ctx: AppCtx, id: string, patch: Partial<z.input<typeof expenseInput>>): Promise<void> {
  const value = parsePatch(expenseInput, patch);
  await requireFamilyBudget(ctx);
  await requireRetailer(ctx, value.retailer_id);
  await ctx.db.transaction("rw", [ctx.db.manual_expenses, ctx.db.outbox], async () => {
    await requireOwnedExpense(ctx, id);
    await updateRow(ctx.db, "manual_expenses", id, value, w(ctx));
  });
}

export async function deleteExpense(ctx: AppCtx, id: string): Promise<void> {
  await requireFamilyBudget(ctx);
  await ctx.db.transaction("rw", [ctx.db.manual_expenses, ctx.db.outbox], async () => {
    await requireOwnedExpense(ctx, id);
    await softDelete(ctx.db, "manual_expenses", id, w(ctx));
  });
}
