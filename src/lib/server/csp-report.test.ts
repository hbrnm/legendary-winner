import { describe, expect, it, vi } from "vitest";
import { createCspReportHandler, sanitizeCspReports } from "./csp-report";

const reportRequest = (body: unknown, contentType = "application/reports+json") =>
  new Request("https://appcamara.vercel.app/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });

describe("rapoarte CSP", () => {
  it("acceptă formatul Reporting API și elimină query-ul, fragmentul și sample-ul inline", () => {
    const reports = sanitizeCspReports([{
      type: "csp-violation",
      url: "https://appcamara.vercel.app/buget/?user=secret#section",
      body: {
        effectiveDirective: "script-src-elem",
        disposition: "report",
        blockedURL: "https://cdn.example.test/script.js?token=secret#top",
        sourceFile: "https://appcamara.vercel.app/_next/app.js?session=secret",
        lineNumber: 17,
        columnNumber: 4,
        sample: "secret inline script",
      },
    }]);

    expect(reports).toEqual([{
      directive: "script-src-elem",
      disposition: "report",
      blockedUri: "https://cdn.example.test/script.js",
      documentUri: "https://appcamara.vercel.app/buget/",
      sourceFile: "https://appcamara.vercel.app/_next/app.js",
      line: 17,
      column: 4,
      statusCode: null,
    }]);
    expect(JSON.stringify(reports)).not.toContain("secret");
  });

  it("acceptă raportul CSP legacy și păstrează doar URL-uri http(s) fără credențiale", () => {
    expect(sanitizeCspReports({ "csp-report": {
      "effective-directive": "style-src-attr",
      "blocked-uri": "inline",
      "document-uri": "https://appcamara.vercel.app/?email=test@example.com",
      "source-file": "javascript:alert(1)",
      "line-number": 9,
    } })).toEqual([{
      directive: "style-src-attr",
      disposition: "unknown",
      blockedUri: "inline",
      documentUri: "https://appcamara.vercel.app/",
      sourceFile: null,
      line: 9,
      column: null,
      statusCode: null,
    }]);
  });

  it("preia cererile de raportare, respinge formate greșite și răspunde la preflight", async () => {
    const log = vi.fn();
    const handler = createCspReportHandler(log);
    const request = reportRequest([{ type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline" } }]);

    const response = await handler(request);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "csp-report", directive: "script-src" }));
    expect((await handler(reportRequest({}, "text/plain"))).status).toBe(415);
    expect((await handler(new Request("https://appcamara.vercel.app/csp-report", { method: "OPTIONS" }))).status).toBe(204);
  });

  it("reduce zgomotul repetat și limitează numărul de evenimente logate", async () => {
    let time = 0;
    const log = vi.fn();
    const handler = createCspReportHandler(log, () => time);
    const body = [{ type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline" } }];

    await handler(reportRequest(body));
    await handler(reportRequest(body));
    expect(log).toHaveBeenCalledTimes(1);

    time = 60_001;
    await handler(reportRequest(body));
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1][0].repeatCount).toBe(2);
  });
});
