import { describe, expect, it, vi } from "vitest";
import { GEMINI_DEFAULT_MODEL, RECEIPT_LIMITS, checkReceiptText, geminiReceiptReader, handleReceiptRequest, noThinking, quotaViaRest, readReceiptImage, type ReceiptDeps, type ReceiptImage } from "./read-receipt";

// Funcția Edge read-receipt, fără rețea: Gemini și limita de cereri sunt simulate.

const image: ReceiptImage = { mimeType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQ==" };
const TEXT = "KAUFLAND ROMANIA SCS\n1,000 BUC x 5,29\nVDR.LAP.3,5%1L 5,29 C\nTOTAL 5,29";

function deps(answer: unknown = TEXT, quota: boolean | null = true) {
  const d: ReceiptDeps = {
    takeQuota: vi.fn(async () => quota),
    read: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  return d;
}

const post = (body: unknown, auth: string | null = "Bearer token-ana") =>
  new Request("https://proiect.supabase.co/functions/v1/read-receipt", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function call(body: unknown, d: ReceiptDeps, auth?: string | null) {
  const res = await handleReceiptRequest(post(body, auth), d);
  return { status: res.status, json: await res.json(), cors: res.headers.get("access-control-allow-origin") };
}

describe("read-receipt", () => {
  it("trimite la citire doar imaginea și întoarce textul bonului", async () => {
    const d = deps();
    expect(await call({ image }, d)).toEqual({ status: 200, json: { text: TEXT }, cors: "*" });
    expect(d.takeQuota).toHaveBeenCalledWith("Bearer token-ana");
    expect(d.read).toHaveBeenCalledWith(image);
  });

  it("fără token, cu o cerere greșită sau prea mare nu cheamă modelul și nu consumă din limită", async () => {
    const d = deps();
    expect((await call({ image }, d, null)).json).toEqual({ error: "unauthorized" });
    expect((await call("nu e json", d)).json).toEqual({ error: "bad_request" });
    expect((await call({ image: { mimeType: "image/gif", data: image.data } }, d)).json).toEqual({ error: "bad_request" });
    expect((await call({ image: { mimeType: "image/jpeg", data: "nu e base64!" } }, d)).json).toEqual({ error: "bad_request" });
    expect((await call({ image: { ...image, data: "A".repeat(RECEIPT_LIMITS.maxImage + 4) } }, d)).json).toEqual({ error: "too_large" });
    const big = new Request("https://f.ro/x", { method: "POST", headers: { authorization: "Bearer t", "content-length": String(RECEIPT_LIMITS.maxBody + 1) }, body: "{}" });
    expect((await handleReceiptRequest(big, d)).status).toBe(413);
    expect(d.takeQuota).not.toHaveBeenCalled();
    expect(d.read).not.toHaveBeenCalled();
    expect((await handleReceiptRequest(new Request("https://f.ro/x", { method: "OPTIONS" }), d)).status).toBe(204);
  });

  it("limita de cereri și tokenul nevalid", async () => {
    const over = deps(TEXT, false);
    expect(await call({ image }, over)).toMatchObject({ status: 429, json: { error: "rate_limited" } });
    expect(over.read).not.toHaveBeenCalled();
    expect((await call({ image }, deps(TEXT, null))).json).toEqual({ error: "unauthorized" });
  });

  it("o eroare a modelului sau un răspuns fără bon dă „failed”, fără imagine sau text în jurnal", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await call({ image }, deps(new Error("Gemini 429")))).toMatchObject({ status: 502, json: { error: "failed" } });
    expect((await call({ image }, deps("Nu văd niciun bon în imagine."))).json).toEqual({ error: "failed" });
    for (const [line] of log.mock.calls) expect(String(line)).not.toMatch(/KAUFLAND|\/9j\//);
    log.mockRestore();
  });
});

describe("readReceiptImage și checkReceiptText", () => {
  it("acceptă JPEG, PNG și WebP în base64", () => {
    expect(readReceiptImage(image)).toEqual(image);
    expect(readReceiptImage({ mimeType: "image/png", data: "iVBORw0KGgo=" })).not.toBeNull();
    expect(readReceiptImage({ mimeType: "image/jpeg", data: "" })).toBeNull();
    expect(readReceiptImage(null)).toBeNull();
  });

  it("scoate blocul de cod și rândurile Windows; tăie la limită", () => {
    expect(checkReceiptText("```text\r\nTOTAL 7,61\r\n```")).toBe("TOTAL 7,61");
    expect(checkReceiptText("1".repeat(RECEIPT_LIMITS.maxText + 10))).toHaveLength(RECEIPT_LIMITS.maxText);
    expect(checkReceiptText("   ")).toBeNull();
    expect(checkReceiptText({ text: TEXT })).toBeNull();
  });
});

describe("geminiReceiptReader", () => {
  const answer = (text: string, finishReason = "STOP", status = 200) =>
    new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }), { status });

  it("trimite imaginea ca date, cu cheia în antet (nu în adresă), și întoarce textul", async () => {
    const fetchFn = vi.fn(async () => answer(TEXT));
    expect(await geminiReceiptReader(fetchFn as unknown as typeof fetch, "cheie-secreta")(image)).toBe(TEXT);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(url).not.toContain("cheie-secreta");
    expect(init.headers).toEqual({ "x-goog-api-key": "cheie-secreta", "content-type": "application/json" });
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts).toEqual([{ inlineData: image }]);
    expect(body.generationConfig).toEqual({ responseMimeType: "text/plain", temperature: 0, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } });
    expect(body.systemInstruction.parts[0].text).toContain("never guess a number");
  });

  it("modelul se poate alege", async () => {
    const fetchFn = vi.fn(async () => answer(TEXT));
    await geminiReceiptReader(fetchFn as unknown as typeof fetch, "k", "gemini-alt-model")(image);
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain("/models/gemini-alt-model:generateContent");
  });

  it("fără gândire: bugetul 0 pentru seria 2, nivelul minim pentru seria 3", async () => {
    expect(noThinking("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(noThinking("gemini-3.8-flash")).toEqual({ thinkingLevel: "minimal" });
    const fetchFn = vi.fn(async () => answer(TEXT));
    await geminiReceiptReader(fetchFn as unknown as typeof fetch, "k", "gemini-3.8-flash")(image);
    const body = JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("limita gratuită (429), cheia greșită, blocarea sau textul tăiat sunt erori", async () => {
    const r = (res: Response) => geminiReceiptReader((async () => res) as unknown as typeof fetch, "k")(image);
    await expect(r(new Response("{}", { status: 429 }))).rejects.toThrow("429");
    await expect(r(new Response("{}", { status: 403 }))).rejects.toThrow("403");
    await expect(r(answer("", "SAFETY"))).rejects.toThrow("SAFETY");
    await expect(r(answer("KAUFLAND\n1,000 BUC", "MAX_TOKENS"))).rejects.toThrow("MAX_TOKENS");
    await expect(r(new Response(JSON.stringify({ candidates: [] })))).rejects.toThrow();
  });
});

describe("quotaViaRest pentru bonuri", () => {
  it("cheamă take_receipt_read_quota", async () => {
    const fetchFn = vi.fn(async () => new Response("true", { status: 200 }));
    await quotaViaRest(fetchFn as unknown as typeof fetch, "https://proiect.supabase.co", "cheie-anon", "take_receipt_read_quota")("Bearer token-ana");
    expect(fetchFn).toHaveBeenCalledWith("https://proiect.supabase.co/rest/v1/rpc/take_receipt_read_quota", expect.objectContaining({ method: "POST" }));
  });
});
