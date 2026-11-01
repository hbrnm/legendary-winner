import { describe, expect, it } from "vitest";
import { readJsonBody } from "./edge-body";

describe("readJsonBody (F11)", () => {
  it("citește cu succes un JSON valid sub limită", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world", count: 42 }),
    });
    const result = await readJsonBody<{ hello: string; count: number }>(req, 1024);
    expect(result).toEqual({ ok: true, data: { hello: "world", count: 42 } });
  });

  it("respinge cererea dacă antetul Content-Length depășește limita", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2000" },
      body: JSON.stringify({ a: 1 }),
    });
    const result = await readJsonBody(req, 1000);
    expect(result).toEqual({ ok: false, status: 413, error: "too_large" });
  });

  it("oprește citirea stream-ului și respinge dacă fluxul depășește limita fără Content-Length", async () => {
    // Simulăm un flux generat bucată cu bucată fără Content-Length prestabilit
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"large": "'));
        controller.enqueue(encoder.encode("x".repeat(1500)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });

    const req = new Request("https://example.com", {
      method: "POST",
      // @ts-expect-error duplex e necesar pentru ReadableStream body în Node / runtime-uri moderne
      duplex: "half",
      headers: { "content-type": "application/json" },
      body: stream,
    });

    const result = await readJsonBody(req, 500);
    expect(result).toEqual({ ok: false, status: 413, error: "too_large" });
  });

  it("returnează bad_request pentru JSON malformat", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json ...",
    });
    const result = await readJsonBody(req, 1000);
    expect(result).toEqual({ ok: false, status: 400, error: "bad_request" });
  });

  it("returnează bad_request pentru cerere fără corp", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
    });
    const result = await readJsonBody(req, 1000);
    expect(result).toEqual({ ok: false, status: 400, error: "bad_request" });
  });
});

