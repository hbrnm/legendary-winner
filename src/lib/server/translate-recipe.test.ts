import { describe, expect, it, vi } from "vitest";
import { TRANSLATE_LIMITS, checkTranslation, deeplTranslator, handleTranslateRequest, quotaViaRest, type RecipeText, type TranslateDeps } from "./translate-recipe";

// Funcția Edge translate-recipe, fără rețea: DeepL și limita de cereri sunt simulate.

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
    expect(await call({ recipe }, deps(new Error("DeepL 456")))).toMatchObject({ status: 502, json: { error: "failed" } });
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
});

describe("deeplTranslator", () => {
  const deepl = (...answers: Response[]) => {
    const fetchFn = vi.fn(async () => answers.shift()!);
    return fetchFn;
  };
  const ok = (texts: string[]) => new Response(JSON.stringify({ translations: texts.map((text) => ({ detected_source_language: "EN", text })) }), { status: 200 });

  it("cheia gratuită (:fx) merge la api-free, în română; câmpurile goale nu se trimit", async () => {
    const fetchFn = deepl(ok(["Chec cu banane", "Preîncălzește cuptorul la 175°C.", "Coace 60 de minute."]));
    const translate = deeplTranslator(fetchFn as unknown as typeof fetch, "cheie:fx");
    expect(await translate({ ...recipe, description: "" })).toEqual({ ...romanian, description: "" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(init.headers).toEqual({ authorization: "DeepL-Auth-Key cheie:fx", "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ text: ["Banana Bread", ...recipe.steps], target_lang: "RO", preserve_formatting: true });
  });

  it("cheia Pro merge la api.deepl.com; peste 50 de texte, în mai multe cereri", async () => {
    const steps = Array.from({ length: 55 }, (_, i) => `Step ${i}.`);
    const fetchFn = deepl(ok(["Nume", "Descriere", ...steps.slice(0, 48).map((_, i) => `Pas ${i}.`)]), ok(steps.slice(48).map((_, i) => `Pas ${48 + i}.`)));
    const out = (await deeplTranslator(fetchFn as unknown as typeof fetch, "cheie-pro")({ name: "Name", description: "Description", steps })) as RecipeText;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe("https://api.deepl.com/v2/translate");
    expect(out.steps[54]).toBe("Pas 54.");
  });

  it("limita lunară (456), cheia greșită sau un răspuns neașteptat sunt erori", async () => {
    await expect(deeplTranslator(deepl(new Response("", { status: 456 })) as unknown as typeof fetch, "k:fx")(recipe)).rejects.toThrow("456");
    await expect(deeplTranslator(deepl(new Response("", { status: 403 })) as unknown as typeof fetch, "k:fx")(recipe)).rejects.toThrow("403");
    await expect(deeplTranslator(deepl(ok(["Unul"])) as unknown as typeof fetch, "k:fx")(recipe)).rejects.toThrow("neașteptat");
  });
});

describe("quotaViaRest pentru traducere", () => {
  it("cheamă take_recipe_translate_quota", async () => {
    const fetchFn = vi.fn(async () => new Response("true", { status: 200 }));
    await quotaViaRest(fetchFn as unknown as typeof fetch, "https://proiect.supabase.co", "cheie-anon", "take_recipe_translate_quota")("Bearer token-ana");
    expect(fetchFn).toHaveBeenCalledWith("https://proiect.supabase.co/rest/v1/rpc/take_recipe_translate_quota", expect.objectContaining({ method: "POST" }));
  });
});
