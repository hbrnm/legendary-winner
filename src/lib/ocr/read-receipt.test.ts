import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { OCR_VERSION, readWithFallback, serverReceiptReader, toBase64 } from "./read-receipt";

describe("fișierele OCR", () => {
  it("calea /ocr/<versiune>/ are versiunea instalată a tesseract.js (o copiază scripts/copy-ocr.mjs)", () => {
    const pkg = JSON.parse(readFileSync("node_modules/tesseract.js/package.json", "utf8"));
    expect(OCR_VERSION).toBe(pkg.version);
  });
});

// Citirea pe server (.tasks/015), cu funcția Edge simulată.
describe("citirea pe server, cu telefonul de rezervă", () => {
  it("toBase64 dă același rezultat ca Node, și peste o bucată (32 KB)", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("trimite JPEG-ul și întoarce bonul citit ca JSON; un răspuns fără bon e o eroare", async () => {
    const receipt = { error: null, store: "Lidl", date: "2026-10-13", total: "11.19", lines: [{ label: "Iaurt grecesc", amount: "11.19", quantity: 1, unit: "buc", unitAmount: "11.19", discount: null }], discounts: [] };
    const call = vi.fn(async () => new Response(JSON.stringify({ receipt }), { status: 200 }));
    expect(await serverReceiptReader(call)("/9j/AA==")).toMatchObject({ chain: "lidl", total: 11.19, total_matches: true, lines: [{ name: "Iaurt grecesc", amount: 11.19 }] });
    expect(call).toHaveBeenCalledWith({ image: { mimeType: "image/jpeg", data: "/9j/AA==" } });
    // Funcția veche, cu textul transcris: trece prin parseReceipt.
    const old = async () => new Response(JSON.stringify({ text: "KAUFLAND\n1,000 BUC x 5,29\nVDR.LAP 5,29 C\nTOTAL 5,29" }), { status: 200 });
    expect(await serverReceiptReader(old)("/9j/AA==")).toMatchObject({ chain: "kaufland", total: 5.29 });
    const err = (res: Response) => serverReceiptReader(async () => res)("/9j/AA==");
    await expect(err(new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }))).rejects.toThrow("429");
    await expect(err(new Response("nu e json", { status: 200 }))).rejects.toThrow();
    await expect(err(new Response(JSON.stringify({ text: "  " }), { status: 200 }))).rejects.toThrow();
    await expect(err(new Response(JSON.stringify({ receipt: { ...receipt, lines: [] } }), { status: 200 }))).rejects.toThrow();
    await expect(err(new Response(JSON.stringify({ receipt: { ...receipt, error: "Not a receipt." } }), { status: 200 }))).rejects.toThrow();
    await expect(err(new Response(JSON.stringify({ receipt: "nu e obiect" }), { status: 200 }))).rejects.toThrow();
    // Un bon JSON fără linii, dar cu text: textul trece prin parseReceipt.
    expect(await err(new Response(JSON.stringify({ receipt: { ...receipt, lines: [] }, text: "LIDL\nTOTAL 1,00" }), { status: 200 }))).toMatchObject({ chain: "lidl", total: 1 });
  });

  it("cu server: textul lui, telefonul nu se pornește", async () => {
    const phone = vi.fn(async () => "telefon");
    expect(await readWithFallback(async () => "server", phone)).toEqual({ result: "server", fallback: false });
    expect(phone).not.toHaveBeenCalled();
  });

  it("serverul nu merge: citește telefonul și spune asta", async () => {
    expect(await readWithFallback(async () => Promise.reject(new Error("read-receipt 502")), async () => "telefon")).toEqual({ result: "telefon", fallback: true });
  });

  it("fără server (fără cont, fără internet): doar telefonul, fără atenționare", async () => {
    expect(await readWithFallback(null, async () => "telefon")).toEqual({ result: "telefon", fallback: false });
  });
});
