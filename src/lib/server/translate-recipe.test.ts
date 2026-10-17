import { describe, expect, it, vi } from "vitest";
import { TRANSLATE_LIMITS, checkTranslation, handleTranslateRequest, quotaViaRest, type RecipeText, type TranslateDeps } from "./translate-recipe";

// Funcția Edge translate-recipe, fără rețea: modelul și limita de cereri sunt simulate.

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
  it("trimite modelului doar rețeta și întoarce traducerea", async () => {
    const d = deps();
    expect(await call({ recipe }, d)).toEqual({ status: 200, json: { recipe: romanian }, cors: "*" });
    expect(d.takeQuota).toHaveBeenCalledWith("Bearer token-ana");
    expect(d.translate).toHaveBeenCalledWith(JSON.stringify(recipe));
  });

  it("fără token, cu o cerere greșită sau prea mare nu cheamă modelul și nu consumă din limită", async () => {
    const d = deps();
    expect((await call({ recipe }, d, null)).json).toEqual({ error: "unauthorized" });
    expect((await call("nu e json", d)).json).toEqual({ error: "bad_request" });
    expect((await call({ recipe: { name: "x", description: "", steps: [1] } }, d)).json).toEqual({ error: "bad_request" });
    expect((await call({ recipe: { ...recipe, steps: Array(TRANSLATE_LIMITS.maxSteps + 1).fill("Pas.") } }, d)).json).toEqual({ error: "too_large" });
    expect((await call({ recipe: { ...recipe, description: "x".repeat(TRANSLATE_LIMITS.maxDescription + 1) } }, d)).json).toEqual({ error: "too_large" });
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

  it("o eroare a modelului sau un răspuns greșit dă „failed”", async () => {
    expect(await call({ recipe }, deps(new Error("refusal")))).toMatchObject({ status: 502, json: { error: "failed" } });
    expect((await call({ recipe }, deps({ ...romanian, steps: ["Un singur pas."] }))).json).toEqual({ error: "failed" });
  });
});

describe("checkTranslation", () => {
  it("curăță spațiile și păstrează un câmp gol dacă și originalul era gol", () => {
    expect(checkTranslation({ ...recipe, description: "" }, { ...romanian, name: "  Chec   cu banane ", description: "" })).toEqual({ ...romanian, description: "" });
  });

  it("refuză pașii lipsă, câmpurile golite și textele peste limită", () => {
    expect(checkTranslation(recipe, { ...romanian, steps: [] })).toBeNull();
    expect(checkTranslation(recipe, { ...romanian, steps: ["", "Coace."] })).toBeNull();
    expect(checkTranslation(recipe, { ...romanian, name: "" })).toBeNull();
    expect(checkTranslation(recipe, { ...romanian, name: "x".repeat(TRANSLATE_LIMITS.maxName + 1) })).toBeNull();
    expect(checkTranslation(recipe, "nu e obiect")).toBeNull();
  });
});

describe("quotaViaRest pentru traducere", () => {
  it("cheamă take_recipe_translate_quota", async () => {
    const fetchFn = vi.fn(async () => new Response("true", { status: 200 }));
    await quotaViaRest(fetchFn as unknown as typeof fetch, "https://proiect.supabase.co", "cheie-anon", "take_recipe_translate_quota")("Bearer token-ana");
    expect(fetchFn).toHaveBeenCalledWith("https://proiect.supabase.co/rest/v1/rpc/take_recipe_translate_quota", expect.objectContaining({ method: "POST" }));
  });
});
