import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { handleImportRequest, isPublicAddress, parseImportUrl, quotaViaRest, type ImportDeps } from "./import-recipe";

// Funcția Edge import-recipe, fără rețea: paginile vin din fixturile etapei 1,
// DNS-ul și limita de cereri sunt simulate.

const fixture = (name: string) => readFileSync(new URL(`../domain/__fixtures__/recipe-import/${name}`, import.meta.url), "utf8");

type Page = { status?: number; type?: string; body?: string | Uint8Array; location?: string; length?: number };

function deps(pages: Record<string, Page>, dns: Record<string, string[]> = {}, quota: boolean | null = true) {
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const href = String(input);
    const page = pages[href];
    if (!page) throw new TypeError("network error");
    expect(init?.redirect).toBe("manual");
    const headers = new Headers({ "content-type": page.type ?? "text/html; charset=utf-8" });
    if (page.location) headers.set("location", page.location);
    if (page.length) headers.set("content-length", String(page.length));
    return new Response((page.body ?? "") as BodyInit, { status: page.status ?? 200, headers });
  });
  const d: ImportDeps = {
    fetch: fetchFn as unknown as typeof fetch,
    resolveHost: async (host) => dns[host] ?? ["93.184.215.14"],
    takeQuota: vi.fn(async () => quota),
  };
  return { d, fetchFn };
}

const post = (body: unknown, auth: string | null = "Bearer token-ana") =>
  new Request("https://proiect.supabase.co/functions/v1/import-recipe", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function call(body: unknown, d: ImportDeps, auth?: string | null, limits?: Parameters<typeof handleImportRequest>[2]) {
  const res = await handleImportRequest(post(body, auth), d, limits);
  return { status: res.status, json: await res.json(), cors: res.headers.get("access-control-allow-origin") };
}

describe("adresele permise", () => {
  it("acceptă doar adresele publice", () => {
    for (const ip of ["93.184.215.14", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4001:80b::2004"]) expect(isPublicAddress(ip), ip).toBe(true);
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "224.0.0.1", "255.255.255.255", "192.0.2.10", "198.18.0.1", "203.0.113.5",
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
      "2002:7f00:1::", "2001:0:4136:e378::1", "2001:db8::1", "ff02::1", "nu-e-ip",
    ]) expect(isPublicAddress(ip), ip).toBe(false);
  });

  it("linkul: doar https, fără port, utilizator sau parolă, cu domeniu", () => {
    expect(parseImportUrl("  https://www.exemplu.ro/reteta?id=3 ")?.href).toBe("https://www.exemplu.ro/reteta?id=3");
    for (const u of ["http://exemplu.ro/r", "https://exemplu.ro:8443/r", "https://ana:parola@exemplu.ro/r", "https://localhost/r", "file:///etc/passwd", "", 42, "https://exemplu.ro/" + "a".repeat(500)]) {
      expect(parseImportUrl(u), String(u)).toBeNull();
    }
  });
});

describe("handleImportRequest", () => {
  it("întoarce ciorna din JSON-LD, cu adresa finală ca sursă", async () => {
    const { d } = deps({ "https://exemplu.ro/ciorba": { body: fixture("graph-wordpress.html") } });
    const r = await call({ url: "https://exemplu.ro/ciorba" }, d);
    expect(r.status).toBe(200);
    expect(r.cors).toBe("*");
    expect(r.json.draft.name).toBe("Ciorbă de perișoare & leuștean");
    expect(r.json.draft.ingredients).toHaveLength(7);
    expect(r.json.draft.source_url).toBe("https://exemplu.ro/ciorba");
    expect(d.takeQuota).toHaveBeenCalledWith("Bearer token-ana");
  });

  it("urmează redirecționările, verificând fiecare adresă", async () => {
    const { d } = deps({
      "https://exemplu.ro/r/1": { status: 301, location: "/ciorba" },
      "https://exemplu.ro/ciorba": { status: 302, location: "https://www.exemplu.ro/ciorba" },
      "https://www.exemplu.ro/ciorba": { body: fixture("graph-wordpress.html") },
    });
    const r = await call({ url: "https://exemplu.ro/r/1" }, d);
    expect(r.status).toBe(200);
    expect(r.json.draft.source_url).toBe("https://www.exemplu.ro/ciorba");
  });

  it("refuză adresele interne, și când vin dintr-o redirecționare sau dintr-un nume", async () => {
    const internal = deps(
      {
        "https://exemplu.ro/r": { status: 302, location: "https://metadata.intern.ro/latest" },
        "https://metadata.intern.ro/latest": { body: "secret" },
      },
      { "metadata.intern.ro": ["169.254.169.254"], "amestec.ro": ["93.184.215.14", "10.0.0.5"] },
    );
    expect((await call({ url: "https://exemplu.ro/r" }, internal.d)).json).toEqual({ error: "blocked_address" });
    expect((await call({ url: "https://amestec.ro/r" }, internal.d)).json).toEqual({ error: "blocked_address" });
    expect((await call({ url: "https://127.0.0.1/r" }, internal.d)).json).toEqual({ error: "blocked_address" });
    expect((await call({ url: "https://[::1]/r" }, internal.d)).status).toBe(400);
    expect(internal.fetchFn).toHaveBeenCalledTimes(1);
    expect(internal.fetchFn.mock.calls[0][0]).toBe("https://exemplu.ro/r");
  });

  it("refuză redirecționările spre http și pe cele prea multe", async () => {
    const http = deps({ "https://exemplu.ro/r": { status: 301, location: "http://exemplu.ro/r" } });
    expect((await call({ url: "https://exemplu.ro/r" }, http.d)).json).toEqual({ error: "invalid_url" });
    const loop = deps({ "https://exemplu.ro/a": { status: 302, location: "/b" }, "https://exemplu.ro/b": { status: 302, location: "/a" } });
    expect((await call({ url: "https://exemplu.ro/a" }, loop.d)).json).toEqual({ error: "fetch_failed" });
    expect(loop.fetchFn).toHaveBeenCalledTimes(4);
  });

  it("limitează mărimea paginii, după antet și după ce sosește", async () => {
    const big = "x".repeat(2000);
    const { d } = deps({
      "https://exemplu.ro/antet": { body: "mic", length: 5000 },
      "https://exemplu.ro/flux": { body: big },
    });
    const limits = { timeoutMs: 1000, maxBytes: 1000, maxRedirects: 3, maxUrlLength: 500 };
    expect(await call({ url: "https://exemplu.ro/antet" }, d, undefined, limits)).toMatchObject({ status: 413, json: { error: "too_large" } });
    expect(await call({ url: "https://exemplu.ro/flux" }, d, undefined, limits)).toMatchObject({ status: 413, json: { error: "too_large" } });
  });

  it("se oprește după timpul maxim", async () => {
    const d: ImportDeps = {
      fetch: ((_: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("oprit", "AbortError"))))) as typeof fetch,
      resolveHost: async () => ["93.184.215.14"],
      takeQuota: async () => true,
    };
    const r = await call({ url: "https://exemplu.ro/lent" }, d, undefined, { timeoutMs: 20, maxBytes: 1000, maxRedirects: 3, maxUrlLength: 500 });
    expect(r).toMatchObject({ status: 504, json: { error: "timeout" } });
  });

  it("paginile fără rețetă, care nu sunt HTML sau nu se pot descărca", async () => {
    const { d } = deps({
      "https://exemplu.ro/fara": { body: fixture("fara-reteta.html") },
      "https://exemplu.ro/poza.jpg": { type: "image/jpeg", body: new Uint8Array([0xff, 0xd8]) },
      "https://exemplu.ro/lipsa": { status: 404, body: "nu există" },
    });
    expect(await call({ url: "https://exemplu.ro/fara" }, d)).toMatchObject({ status: 422, json: { error: "no_recipe" } });
    expect(await call({ url: "https://exemplu.ro/poza.jpg" }, d)).toMatchObject({ status: 422, json: { error: "not_html" } });
    expect(await call({ url: "https://exemplu.ro/lipsa" }, d)).toMatchObject({ status: 502, json: { error: "fetch_failed" } });
    expect(await call({ url: "https://nu-exista.ro/r" }, deps({}, { "nu-exista.ro": [] }).d)).toMatchObject({ status: 502, json: { error: "fetch_failed" } });
  });

  it("se oprește după timpul maxim și când DNS-ul nu răspunde", async () => {
    const d: ImportDeps = { fetch: vi.fn() as unknown as typeof fetch, resolveHost: () => new Promise(() => {}), takeQuota: async () => true };
    const r = await call({ url: "https://exemplu.ro/lent" }, d, undefined, { timeoutMs: 20, maxBytes: 1000, maxRedirects: 3, maxUrlLength: 500 });
    expect(r).toMatchObject({ status: 504, json: { error: "timeout" } });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("codarea din <meta charset>, când antetul nu o spune; fără Content-Type, pagina e HTML", async () => {
    // În windows-1250, „ă” e 0xE3 și „ș” (cu sedilă) e 0xBA.
    const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));
    const old = new Uint8Array([
      ...ascii('<html><head><meta charset="windows-1250"></head><script type="application/ld+json">{"@type":"Recipe","name":"Ciorb'), 0xe3,
      ...ascii(" de pe"), 0xba, ...ascii('te","recipeIngredient":["1 crap"],"recipeInstructions":["Fierbe."]}</script>'),
    ]);
    const { d } = deps({ "https://exemplu.ro/vechi": { type: "text/html", body: old } });
    expect((await call({ url: "https://exemplu.ro/vechi" }, d)).json.draft.name).toBe("Ciorbă de peşte");
    const fara = deps({ "https://exemplu.ro/r": { type: "", body: fixture("graph-wordpress.html") } });
    expect((await call({ url: "https://exemplu.ro/r" }, fara.d)).status).toBe(200);
  });

  it("citește pagina în codarea din antet", async () => {
    // În ISO-8859-2, „ă” e 0xE3 și „ş” e 0xBA.
    const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));
    const latin = new Uint8Array([
      ...ascii('<script type="application/ld+json">{"@type":"Recipe","name":"Ciorb'), 0xe3, ...ascii(" de pe"), 0xba,
      ...ascii('te","recipeIngredient":["1 crap"],"recipeInstructions":["Fierbe."]}</script>'),
    ]);
    const { d } = deps({ "https://exemplu.ro/vechi": { type: "text/html; charset=iso-8859-2", body: latin } });
    expect((await call({ url: "https://exemplu.ro/vechi" }, d)).json.draft.name).toBe("Ciorbă de peşte");
  });

  it("cere token și respectă limita de cereri, înainte să descarce ceva", async () => {
    const page = { "https://exemplu.ro/ciorba": { body: fixture("graph-wordpress.html") } };
    const fara = deps(page);
    expect(await call({ url: "https://exemplu.ro/ciorba" }, fara.d, null)).toMatchObject({ status: 401, json: { error: "unauthorized" } });
    const nevalid = deps(page, {}, null);
    expect(await call({ url: "https://exemplu.ro/ciorba" }, nevalid.d)).toMatchObject({ status: 401, json: { error: "unauthorized" } });
    const prea = deps(page, {}, false);
    expect(await call({ url: "https://exemplu.ro/ciorba" }, prea.d)).toMatchObject({ status: 429, json: { error: "rate_limited" } });
    for (const x of [fara, nevalid, prea]) expect(x.fetchFn).not.toHaveBeenCalled();
  });

  it("cererile greșite: alt verb, corp care nu e JSON, link nevalid; OPTIONS pentru browser", async () => {
    const { d } = deps({});
    expect((await handleImportRequest(new Request("https://f.ro/x", { method: "GET", headers: { authorization: "Bearer t" } }), d)).status).toBe(400);
    expect(await call("nu e json", d)).toMatchObject({ status: 400, json: { error: "bad_request" } });
    expect(await call({ url: "http://exemplu.ro/r" }, d)).toMatchObject({ status: 400, json: { error: "invalid_url" } });
    expect(d.takeQuota).not.toHaveBeenCalled();
    const pre = await handleImportRequest(new Request("https://f.ro/x", { method: "OPTIONS" }), d);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toContain("authorization");
  });
});

describe("quotaViaRest", () => {
  it("cheamă take_recipe_import_quota cu tokenul omului și cheia publică", async () => {
    const fetchFn = vi.fn(async () => new Response("true", { status: 200 }));
    const take = quotaViaRest(fetchFn as unknown as typeof fetch, "https://proiect.supabase.co", "cheie-anon");
    expect(await take("Bearer token-ana")).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://proiect.supabase.co/rest/v1/rpc/take_recipe_import_quota",
      expect.objectContaining({
        method: "POST",
        headers: { apikey: "cheie-anon", authorization: "Bearer token-ana", "content-type": "application/json" },
        body: "{}",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await quotaViaRest((async () => new Response("false")) as unknown as typeof fetch, "u", "k")("Bearer x")).toBe(false);
    expect(await quotaViaRest((async () => new Response("{}", { status: 401 })) as unknown as typeof fetch, "u", "k")("Bearer x")).toBeNull();
  });
});
