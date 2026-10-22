import { describe, expect, it, vi } from "vitest";
import { GEMINI_DEFAULT_MODEL, TRANSLATE_LIMITS, TRANSLATION_SCHEMA, checkTranslation, geminiTranslator, handleTranslateRequest, quotaViaRest, type RecipeText, type TranslateDeps } from "./translate-recipe";

// Funcția Edge translate-recipe, fără rețea: Gemini și limita de cereri sunt simulate.

const recipe: RecipeText = {
  name: "Banana Bread",
  description: "Moist and easy.",
  steps: ["Preheat oven to 175°C.", "Bake for 60 minutes."],
};
const romanian: RecipeText = {
  name: "Chec cu banane",
  description: "Pufos și ușor de făcut.",
  steps: ["Preîncălzește cuptorul la 175°C.", "Coace 60 de minute."],
};

function deps(answer: unknown = romanian, quota: boolean | null = true) {
  const d: TranslateDeps = {
    takeQuota: vi.fn(async () => quota),
    translate: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  return d;
}

const post = (body: unknown, auth: string | null = "Bearer token-ana") =>
  new Request("https://proiect.supabase.co/functions/v1/translate-recipe", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function call(body: unknown, d: TranslateDeps, auth?: string | null) {
  const res = await handleTranslateRequest(post(body, auth), d);
  return { status: res.status, json: await res.json(), cors: res.headers.get("access-control-allow-origin") };
}

describe("translate-recipe", () => {
  it("trimite la traducere doar rețeta și întoarce traducerea", async () => {
    const d = deps();
    expect(await call({ recipe }, d)).toEqual({ status: 200, json: { recipe: romanian }, cors: "*" });
    expect(d.takeQuota).toHaveBeenCalledWith("Bearer token-ana");
    expect(d.translate).toHaveBeenCalledWith(recipe);
  });

  it("fără token, cu o cerere greșită sau prea mare nu cheamă modelul și nu consumă din limită", async () => {
    const d = deps();
    expect((await call({ recipe }, d, null)).json).toEqual({ error: "unauthorized" });
    expect((await call("nu e json", d)).json).toEqual({ error: "bad_request" });
    expect((await call({ recipe: { name: "x", description: "", steps: [1] } }, d)).json).toEqual({ error: "bad_request" });
    expect((await call({ recipe: { ...recipe, steps: Array(TRANSLATE_LIMITS.maxSteps + 1).fill("Pas.") } }, d)).json).toEqual({ error: "too_large" });
    expect((await call({ recipe: { ...recipe, description: "x".repeat(TRANSLATE_LIMITS.maxDescription + 1) } }, d)).json).toEqual({ error: "too_large" });
    const big = new Request("https://f.ro/x", { method: "POST", headers: { authorization: "Bearer t", "content-length": String(TRANSLATE_LIMITS.maxBody + 1) }, body: "{}" });
    expect((await handleTranslateRequest(big, d)).status).toBe(413);
    expect(d.takeQuota).not.toHaveBeenCalled();
    expect(d.translate).not.toHaveBeenCalled();
    const pre = await handleTranslateRequest(new Request("https://f.ro/x", { method: "OPTIONS" }), d);
    expect(pre.status).toBe(204);
  });

  it("limita de cereri și tokenul nevalid", async () => {
    const over = deps(romanian, false);
    expect(await call({ recipe }, over)).toMatchObject({ status: 429, json: { error: "rate_limited" } });
    expect(over.translate).not.toHaveBeenCalled();
    expect((await call({ recipe }, deps(romanian, null))).json).toEqual({ error: "unauthorized" });
  });

  it("o eroare a traducerii sau un răspuns greșit dă „failed”", async () => {
    expect(await call({ recipe }, deps(new Error("Gemini 429")))).toMatchObject({ status: 502, json: { error: "failed" } });
    expect((await call({ recipe }, deps({ ...romanian, steps: ["Un singur pas."] }))).json).toEqual({ error: "failed" });
  });
});

describe("checkTranslation", () => {
  it("curăță spațiile; un câmp gol în original rămâne gol (fără descriere inventată)", () => {
    expect(checkTranslation({ ...recipe, description: "" }, { ...romanian, name: "  Chec   cu banane " })).toEqual({ ...romanian, description: "" });
  });

  it("textele mai lungi după traducere se taie la limită, nu pică", () => {
    const t = checkTranslation(recipe, { ...romanian, name: "x".repeat(TRANSLATE_LIMITS.maxName + 5) });
    expect(t?.name).toHaveLength(TRANSLATE_LIMITS.maxName);
    expect(t?.name.endsWith("…")).toBe(true);
  });

  it("refuză pașii lipsă și câmpurile golite", () => {
    expect(checkTranslation(recipe, { ...romanian, steps: [] })).toBeNull();
    expect(checkTranslation(recipe, { ...romanian, steps: ["", "Coace."] })).toBeNull();
    expect(checkTranslation(recipe, { ...romanian, name: " " })).toBeNull();
    expect(checkTranslation(recipe, "nu e obiect")).toBeNull();
  });

  it("observațiile ingredientelor: același număr, goale rămân goale; o aplicație veche nu le trimite", () => {
    const withNotes = { ...recipe, notes: ["minced", "", "cut into 1-inch pieces"] };
    expect(checkTranslation(withNotes, { ...romanian, notes: ["tocat", "", "tăiat în bucăți de 1-inch"] })).toEqual({ ...romanian, notes: ["tocat", "", "tăiat în bucăți de 1-inch"] });
    // Observații greșite: traducerea pașilor rămâne, fără observații.
    expect(checkTranslation(withNotes, { ...romanian, notes: ["tocat"] })).toEqual(romanian);
    expect(checkTranslation(withNotes, { ...romanian, notes: ["tocat", "", " "] })).toEqual(romanian);
    expect(checkTranslation(withNotes, romanian)).toEqual(romanian);
    expect(checkTranslation(recipe, { ...romanian, notes: ["în plus"] })).toEqual(romanian);
  });
});

describe("geminiTranslator", () => {
  const answer = (text: string, finishReason = "STOP", status = 200) =>
    new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }), { status });

  it("cere JSON după schemă, cu cheia în antet (nu în adresă), și întoarce traducerea", async () => {
    const fetchFn = vi.fn(async () => answer(JSON.stringify(romanian)));
    expect(await geminiTranslator(fetchFn as unknown as typeof fetch, "cheie-secreta")(recipe)).toEqual(romanian);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(url).not.toContain("cheie-secreta");
    expect(init.headers).toEqual({ "x-goog-api-key": "cheie-secreta", "content-type": "application/json" });
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toBe(JSON.stringify(recipe));
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: TRANSLATION_SCHEMA });
    expect(body.systemInstruction.parts[0].text).toContain("not word by word");
  });

  it("modelul se poate alege", async () => {
    const fetchFn = vi.fn(async () => answer(JSON.stringify(romanian)));
    await geminiTranslator(fetchFn as unknown as typeof fetch, "k", "gemini-alt-model")(recipe);
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain("/models/gemini-alt-model:generateContent");
  });

  it("fără gândire, după seria modelului: bugetul 0 pentru seria 2, nivelul „low” pentru seria 3", async () => {
    const body = async (model: string) => {
      const fetchFn = vi.fn(async () => answer(JSON.stringify(romanian)));
      await geminiTranslator(fetchFn as unknown as typeof fetch, "k", model)(recipe);
      return JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    };
    expect((await body("gemini-2.5-flash")).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect((await body("gemini-3.5-flash-lite")).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("limita gratuită (429), cheia greșită, blocarea sau textul tăiat sunt erori", async () => {
    const t = (r: Response) => geminiTranslator((async () => r) as unknown as typeof fetch, "k")(recipe);
    await expect(t(new Response("{}", { status: 429 }))).rejects.toThrow("429");
    await expect(t(new Response("{}", { status: 403 }))).rejects.toThrow("403");
    // Motivul scris de Google intră în jurnal.
    await expect(t(new Response(JSON.stringify({ error: { message: "models/x is not found" } }), { status: 404 }))).rejects.toThrow("Gemini 404: models/x is not found");
    await expect(t(answer("", "SAFETY"))).rejects.toThrow("SAFETY");
    await expect(t(answer('{"name":"Ch', "MAX_TOKENS"))).rejects.toThrow("MAX_TOKENS");
    await expect(t(new Response(JSON.stringify({ candidates: [] })))).rejects.toThrow();
  });
});

describe("quotaViaRest pentru traducere", () => {
  it("cheamă take_recipe_translate_quota", async () => {
    const fetchFn = vi.fn(async () => new Response("true", { status: 200 }));
    await quotaViaRest(fetchFn as unknown as typeof fetch, "https://proiect.supabase.co", "cheie-anon", "take_recipe_translate_quota")("Bearer token-ana");
    expect(fetchFn).toHaveBeenCalledWith("https://proiect.supabase.co/rest/v1/rpc/take_recipe_translate_quota", expect.objectContaining({ method: "POST" }));
  });
});
