import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { saveRecipe } from "./kitchen";
import { IMPORT_ERROR_MESSAGES, draftFromLink, draftFromPastedText, prepareImport, sharedImport } from "./recipe-import";
import type { RecipeDraft } from "@/lib/domain/recipe-import";

let ctx: AppCtx;

beforeEach(async () => {
  setClock("2026-10-16T09:00:00.000Z");
  const db = new CamaraDB(`import-${Math.random()}`);
  await seedCatalog(db);
  ctx = { db, householdId: "h1", userId: "u1", sync: false };
});
afterEach(() => setClock(null));

const draft: RecipeDraft = {
  name: "Ciorbă de perișoare",
  description: "",
  servings: 6,
  prep_minutes: 30,
  cook_minutes: 75,
  ingredients: ["500 g carne tocată de porc", "2 linguri ulei", "sare după gust", "1 lingură pastă de chipotle", "1 ceapă"],
  steps: ["Fierbe."],
  source_url: "https://exemplu.ro/ciorba",
};

describe("prepareImport", () => {
  it("potrivește ingredientele cu catalogul; ce nu se găsește rămâne de ales, cu rândul original", async () => {
    const { ingredients } = await prepareImport(ctx, draft);
    expect(ingredients.map((i) => [i.product_id, i.quantity, i.unit])).toEqual([
      ["carne-tocata-porc", 500, "g"],
      ["ulei-floarea-soarelui", 2, "lingura"],
      ["sare", null, null],
      [null, 1, "lingura"],
      ["ceapa-galbena", 1, "buc"],
    ]);
    expect(ingredients[3].text).toBe("1 lingură pastă de chipotle");
    expect(ingredients[0].candidates[0]).toEqual({ id: "carne-tocata-porc", name: expect.any(String) });
    // Doar alimente printre variante (nu „pastă de dinți”).
    expect(ingredients[3].candidates.map((c) => c.id)).not.toContain("pasta-dinti");
    expect(ingredients[3].candidates.length).toBeGreaterThan(0);
  });

  it("rețeta importată se salvează cu sursa, iar o modificare fără sursă o păstrează doar dacă formularul o trimite", async () => {
    const base = { name: "Ciorbă", categories: ["supe_ciorbe" as const], servings: 6, prep_minutes: 30, cook_minutes: 75, difficulty: "mediu" as const, ingredients: [{ product_id: "sare", quantity: null, unit: null }], steps: ["Fierbe."] };
    const id = await saveRecipe(ctx, { ...base, source_url: "https://exemplu.ro/ciorba" });
    expect((await ctx.db.recipes.get(id))?.source_url).toBe("https://exemplu.ro/ciorba");
    await expect(saveRecipe(ctx, { ...base, source_url: "http://exemplu.ro/ciorba" })).rejects.toThrow("Adresa sursei nu e validă.");
    await expect(saveRecipe(ctx, { ...base, source_url: "javascript:alert(1)" })).rejects.toThrow();
  });
});

describe("draftFromPastedText", () => {
  it("face ciorna din text sau spune ce să faci", () => {
    expect(draftFromPastedText("Mici\nIngrediente\n1 kg carne\nMod de preparare\nFă-i.").name).toBe("Mici");
    expect(() => draftFromPastedText("   ")).toThrow(/Nu am găsit o rețetă în text/);
  });
});

describe("draftFromLink", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("trimite linkul la server și întoarce ciorna", async () => {
    const call = vi.fn(async () => json({ draft }));
    expect(await draftFromLink("  https://exemplu.ro/ciorba ", call)).toEqual(draft);
    expect(call).toHaveBeenCalledWith({ url: "https://exemplu.ro/ciorba" });
  });

  it("erorile serverului devin mesaje pentru om; fără internet sau cu link greșit, nici nu întreabă serverul", async () => {
    await expect(draftFromLink("https://x.ro/r", async () => json({ error: "no_recipe" }, 422))).rejects.toThrow(IMPORT_ERROR_MESSAGES.no_recipe);
    await expect(draftFromLink("https://x.ro/r", async () => json({ error: "rate_limited" }, 429))).rejects.toThrow(IMPORT_ERROR_MESSAGES.rate_limited);
    await expect(draftFromLink("https://x.ro/r", async () => new Response("<html>eroare</html>", { status: 500 }))).rejects.toThrow(IMPORT_ERROR_MESSAGES.fetch_failed);
    await expect(draftFromLink("https://x.ro/r", async () => Promise.reject(new TypeError("Failed to fetch")))).rejects.toThrow(/Verifică internetul/);
    const call = vi.fn();
    await expect(draftFromLink("exemplu.ro/reteta", call)).rejects.toThrow(IMPORT_ERROR_MESSAGES.invalid_url);
    expect(call).not.toHaveBeenCalled();
  });
});

describe("sharedImport (Partajează pe Android)", () => {
  const p = (q: Record<string, string>) => new URLSearchParams(q);

  it("linkul vine în url sau în text, singur ori lângă titlul paginii", () => {
    expect(sharedImport(p({ url: "https://exemplu.ro/ciorba" }))).toEqual({ mode: "link", link: "https://exemplu.ro/ciorba" });
    expect(sharedImport(p({ text: "https://exemplu.ro/ciorba" }))).toEqual({ mode: "link", link: "https://exemplu.ro/ciorba" });
    expect(sharedImport(p({ title: "Ciorbă de perișoare", text: "Ciorbă de perișoare https://exemplu.ro/ciorba" }))).toEqual({ mode: "link", link: "https://exemplu.ro/ciorba" });
    expect(sharedImport(p({ text: "(https://exemplu.ro/ciorba)." }))).toEqual({ mode: "link", link: "https://exemplu.ro/ciorba" });
  });

  it("descrierea unei rețete (chiar cu un link în ea) ajunge la „Text”, cu titlul în față", () => {
    const text = "Mici\nIngrediente\n1 kg carne tocată\n2 lingurițe bicarbonat\nMod de preparare\nAmestecă totul și lasă la frigider o noapte.\nMai multe pe https://exemplu.ro";
    expect(sharedImport(p({ text }))).toEqual({ mode: "text", text });
    expect(sharedImport(p({ title: "Rețeta mea", text: "1 kg carne" }))).toEqual({ mode: "text", text: "Rețeta mea\n1 kg carne" });
    // O descriere scurtă cu un link în ea rămâne text (nu se pierde).
    expect(sharedImport(p({ text: "Mici fără ou: 1 kg carne, usturoi https://exemplu.ro/mici" }))).toEqual({ mode: "text", text: "Mici fără ou: 1 kg carne, usturoi https://exemplu.ro/mici" });
  });

  it("fără nimic de folosit (sau cu un link http) nu face nimic", () => {
    expect(sharedImport(p({}))).toBeNull();
    expect(sharedImport(p({ url: "http://exemplu.ro/r", title: "Ciorbă" }))).toBeNull();
  });
});
