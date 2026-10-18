import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { learnReceiptAlias, proposeReceiptMatches } from "./receipts";
import { exportHouseholdData, importHouseholdData } from "./backup";
import { owned } from "./queries";
import { receiptKey } from "@/lib/domain/receipt-match";

// Potrivirea care învață, cu catalogul real (.tasks/005, etapa 3).

async function newCtx(householdId: string): Promise<AppCtx> {
  const db = new CamaraDB(`bon-${Math.random()}`);
  await seedCatalog(db);
  return { db, householdId, userId: "u1", sync: true };
}

let ctx: AppCtx;
beforeEach(async () => {
  setClock("2026-10-18T09:00:00.000Z");
  ctx = await newCtx("h1");
});
afterEach(() => setClock(null));

describe("potrivirea liniilor de pe bon", () => {
  it("prima dată propune din catalog, chiar cu abrevieri și resturi OCR", async () => {
    const [ceapa, dovleac, nimic] = await proposeReceiptMatches(ctx, ["CEAPA GALBENA KG", "Dovleac Hokkaido", "XQZW 410G"], "kaufland");
    expect(ceapa).toEqual({ product_id: "ceapa-galbena", source: "catalog" });
    expect(dovleac?.source).toBe("catalog");
    expect(nimic).toBeNull();
  });

  it("după confirmare, propune ce a învățat, la același magazin; altă confirmare îl schimbă", async () => {
    await learnReceiptAlias(ctx, { retailer_id: "kaufland", receipt_text: "VDR.LAP.3,5%1L", product_id: "lapte-integral" });
    expect(await proposeReceiptMatches(ctx, ["VDR.LAP.3,5%1L"], "kaufland")).toEqual([{ product_id: "lapte-integral", source: "invatat" }]);
    // La alt magazin, același text învățat tot ajută.
    expect((await proposeReceiptMatches(ctx, ["vdr lap 3 5 1l"], "lidl"))[0]).toEqual({ product_id: "lapte-integral", source: "invatat" });
    await learnReceiptAlias(ctx, { retailer_id: "kaufland", receipt_text: "VDR.LAP.3,5%1L", product_id: "lapte-semidegresat" });
    expect((await proposeReceiptMatches(ctx, ["VDR.LAP.3,5%1L"], "kaufland"))[0]?.product_id).toBe("lapte-semidegresat");
    // Același text, același magazin: un singur rând (id determinist), pus la trimis.
    const rows = await owned(ctx.db, "receipt_aliases", "h1");
    expect(rows).toHaveLength(1);
    expect(rows[0].receipt_text).toBe(receiptKey("VDR.LAP.3,5%1L"));
    expect((await ctx.db.outbox.toArray()).some((e) => e.table === "receipt_aliases")).toBe(true);
  });

  it("refuză textul gol și produsul inexistent", async () => {
    await expect(learnReceiptAlias(ctx, { retailer_id: null, receipt_text: " .. ", product_id: "lapte-integral" })).rejects.toThrow(/gol/);
    await expect(learnReceiptAlias(ctx, { retailer_id: null, receipt_text: "lapte", product_id: "nu-exista" })).rejects.toThrow(/nu există/);
  });

  it("intră în copia de siguranță și se mută în altă gospodărie cu id-ul ei determinist", async () => {
    await learnReceiptAlias(ctx, { retailer_id: "lidl", receipt_text: "Iaurt in stil grecesc", product_id: "lapte-integral" });
    const other = await newCtx("h2");
    await importHouseholdData(other, await exportHouseholdData(ctx));
    expect((await proposeReceiptMatches(other, ["IAURT IN STIL GRECESC"], "lidl"))[0]).toEqual({ product_id: "lapte-integral", source: "invatat" });
    await importHouseholdData(other, await exportHouseholdData(ctx));
    expect(await owned(other.db, "receipt_aliases", "h2")).toHaveLength(1);
  });
});
