import { z } from "zod";
import type { Budget, BudgetScope, PriceConfidence, PriceType, PurchaseSource } from "@/lib/domain/types";
import { insertRow, softDelete, updateRow } from "@/lib/db/write";
import { newId } from "@/lib/db/ids";
import { type AppCtx, w } from "./context";
import { parse, zDate, zMoney, zName, zQuantity, zSource, zUnit } from "./validation";

// Bugete și prețuri introduse de gospodărie.

const scopeSchema: z.ZodType<BudgetScope> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("total") }),
  z.object({ kind: z.literal("alimente") }),
  z.object({ kind: z.literal("nealimentare") }),
  z.object({ kind: z.literal("sursa"), source: zSource }),
  z.object({ kind: z.literal("categorie"), category_id: z.string().min(1) }),
  z.object({ kind: z.literal("magazin"), retailer_id: z.string().min(1) }),
]);

const budgetInput = z.object({
  name: zName(60, "Numele bugetului"),
  period: z.enum(["lunar", "saptamanal"]),
  scope: scopeSchema,
  amount: z.number().positive("Bugetul trebuie să fie mai mare decât zero.").max(9_999_999),
  active: z.boolean().default(true),
});

export async function createBudget(ctx: AppCtx, input: z.input<typeof budgetInput>): Promise<string> {
  const v = parse(budgetInput, input);
  const id = newId();
  await insertRow(ctx.db, "budgets", { id, household_id: ctx.householdId, ...v }, w(ctx));
  return id;
}

export async function updateBudget(ctx: AppCtx, id: string, patch: Partial<z.input<typeof budgetInput>>) {
  const v = parse(budgetInput.partial(), patch);
  await updateRow(ctx.db, "budgets", id, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Partial<Budget>, w(ctx));
}

export async function deleteBudget(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "budgets", id, w(ctx));
}

const priceInput = z.object({
  product_id: z.string().min(1),
  amount: zMoney,
  quantity: zQuantity,
  unit: zUnit,
  source: zSource,
  retailer_id: z.string().nullable().default(null),
  price_type: z.enum(["platit", "observat", "promotie", "estimat"]).default("observat"),
  confidence: z.enum(["ridicata", "medie", "scazuta"]).default("ridicata"),
  observed_on: zDate,
});

/** Un preț văzut sau plătit (ex. la piață: 8 lei/kg roșii de la producător). */
export async function recordPrice(ctx: AppCtx, input: z.input<typeof priceInput>): Promise<string> {
  const v = parse(priceInput, input);
  const id = newId();
  await insertRow(
    ctx.db,
    "product_prices",
    {
      id,
      household_id: ctx.householdId,
      product_id: v.product_id,
      retailer_id: v.retailer_id,
      source: v.source as PurchaseSource,
      amount: v.amount,
      currency: "RON",
      quantity: v.quantity,
      unit: v.unit,
      price_type: v.price_type as PriceType,
      confidence: v.confidence as PriceConfidence,
      observed_on: v.observed_on,
      transaction_item_id: null,
    },
    w(ctx),
  );
  return id;
}

export async function deletePrice(ctx: AppCtx, id: string) {
  await softDelete(ctx.db, "product_prices", id, w(ctx));
}
