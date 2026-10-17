import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CamaraDB } from "@/lib/db/database";
import { setClock } from "@/lib/clock";
import { seedCatalog } from "./bootstrap";
import type { AppCtx } from "./context";
import { saveRecipe } from "./kitchen";
import { IMPORT_ERROR_MESSAGES, draftFromLink, draftFromPastedText, myMemoryTranslator, prepareImport, sharedImport, translateDraft } from "./recipe-import";
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

  it("o rețetă americană ajunge în metric: cănile în ml, °F în °C, inch în cm", async () => {
    const us: RecipeDraft = { ...draft, description: "Bake at 350°F.", ingredients: ["1 1/2 cups milk", "1 stick butter"], steps: ["Preheat oven to 350°F.", "Grease a 9x13 inch pan."] };
    const { draft: d, ingredients } = await prepareImport(ctx, us);
    expect(ingredients.map((i) => [i.quantity, i.unit, i.text])).toEqual([
      [360, "ml", "1 1/2 cups milk"],
      [113, "g", "1 stick butter"],
    ]);
    expect(d.steps).toEqual(["Preheat oven to 175°C.", "Grease a 23×33 cm pan."]);
    expect(d.description).toBe("Bake at 175°C.");
  });

  it("o rețetă americană tipică are ingredientele potrivite cu catalogul din dicționar", async () => {
    const lines = [
      "3 ripe bananas, mashed", "1/3 cup unsalted butter, melted", "3/4 cup sugar", "1 large egg, beaten", "1 tsp vanilla extract",
      "1 tsp baking soda", "pinch of salt", "1 1/2 cups all-purpose flour", "1/2 cup chopped walnuts", "1 tbsp peanut butter",
    ];
    const { ingredients } = await prepareImport(ctx, { ...draft, ingredients: lines });
    expect(ingredients.map((i) => i.product_id)).toEqual([
      "banane", "unt", "zahar", "oua", "esenta-vanilie", "bicarbonat", "sare", "faina-alba", "nuci-miez", null,
    ]);
  });

  it("un produs din dicționar care lipsește din catalogul gospodăriei rămâne de ales", async () => {
    await ctx.db.products.delete("zahar");
    const { ingredients } = await prepareImport(ctx, { ...draft, ingredients: ["1 cup sugar"] });
    expect(ingredients[0].product_id).toBeNull();
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

describe("translateDraft (.tasks/012)", () => {
  const english: RecipeDraft = { ...draft, name: "Banana Bread", description: "Moist and easy.", steps: ["Preheat the oven.", "Bake for 60 minutes."] };
  const romanian = { name: "Chec cu banane", description: "Pufos și ușor de făcut.", steps: ["Preîncălzește cuptorul.", "Coace 60 de minute."] };
  const answer = (out: unknown) => vi.fn(async () => out as { name: string; description: string; steps: string[] });

  it("traduce numele, descrierea și pașii din limba ghicită; restul ciornei rămâne", async () => {
    const translate = answer(romanian);
    const { draft: d, translation } = await translateDraft(english, translate);
    expect(translation).toBe("done");
    expect(d).toEqual({ ...english, ...romanian });
    expect(translate).toHaveBeenCalledWith({ name: english.name, description: english.description, steps: english.steps }, "en");
  });

  it("o rețetă în română nu se trimite la tradus", async () => {
    const translate = answer(romanian);
    const ro = { ...draft, steps: ["Fierbe carnea și apoi adaugă legumele."] };
    expect(await translateDraft(ro, translate)).toEqual({ draft: ro });
    expect(translate).not.toHaveBeenCalled();
  });

  it("fără internet, cu limita atinsă sau cu un răspuns greșit rămâne originalul", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    for (const translate of [
      offline,
      answer({ ...romanian, steps: ["Unul."] }),
      answer({ ...romanian, steps: [null, "Coace."] }),
      answer({ ...romanian, steps: ["", "Coace."] }),
      answer({ ...romanian, name: " " }),
      answer(null),
    ]) {
      expect(await translateDraft(english, translate)).toEqual({ draft: english, translation: "failed" });
    }
  });
});

describe("myMemoryTranslator", () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const ok = (text: string) => reply({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: text } });

  it("trimite fiecare text (pe bucăți) din limba dată în română și le pune la loc", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const q = new URL(String(url)).searchParams.get("q")!;
      return ok(`RO(${q}) &amp; gata`);
    });
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const out = await myMemoryTranslator(fetchFn as unknown as typeof fetch)({ name: "Banana Bread", description: "", steps: [long] }, "en");
    expect(out.name).toBe("RO(Banana Bread) & gata");
    expect(out.description).toBe("");
    const urls = fetchFn.mock.calls.map(([u]) => new URL(String(u)));
    expect(urls[0].origin + urls[0].pathname).toBe("https://api.mymemory.translated.net/get");
    expect(urls.every((u) => u.searchParams.get("langpair") === "en|ro")).toBe(true);
    expect(urls.every((u) => new TextEncoder().encode(u.searchParams.get("q")!).length <= 500)).toBe(true);
    expect(urls.length).toBeGreaterThan(2);
    expect(out.steps[0]).toContain("RO(Sentence number 0 is here.");
  });

  it("limita zilnică sau un răspuns ciudat sunt erori", async () => {
    const t = (r: Response) => myMemoryTranslator((async () => r) as unknown as typeof fetch)({ name: "Bread", description: "", steps: [] }, "en");
    await expect(t(reply({ responseStatus: 429, quotaFinished: true, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" } }))).rejects.toThrow();
    await expect(t(reply({ responseStatus: 200, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" } }))).rejects.toThrow();
    await expect(t(reply({ responseStatus: "403", responseData: { translatedText: "INVALID LANGUAGE PAIR" } }))).rejects.toThrow();
    await expect(t(new Response("<html>", { status: 500 }))).rejects.toThrow();
  });
});
