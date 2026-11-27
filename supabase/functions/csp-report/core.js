// Generat de scripts/build-functions.mjs din src/lib/server/. Nu edita de mână: npm run build:functions.

// src/lib/server/edge-body.ts
async function readJsonBody(req, maxBytes) {
  const clHeader = req.headers.get("content-length");
  if (clHeader !== null) {
    const cl = Number(clHeader);
    if (Number.isFinite(cl) && cl > maxBytes) {
      return { ok: false, status: 413, error: "too_large" };
    }
  }
  if (!req.body) {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const reader = req.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("too_large").catch(() => {
          });
          return { ok: false, status: 413, error: "too_large" };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
  if (chunks.length === 0) {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const total = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(total);
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
}

// src/lib/server/csp-report.ts
var MAX_BODY_BYTES = 16384;
var MAX_REPORTS_PER_REQUEST = 20;
var MAX_LOGS_PER_MINUTE = 30;
var LOG_WINDOW_MS = 6e4;
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store"
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function firstString(source, ...keys) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 2048);
  }
  return null;
}
function safeUri(value) {
  if (!value) return null;
  if (/^(?:inline|eval|wasm-eval|self|data|blob|about:blank|trusted-types-sink)$/i.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`.slice(0, 512);
  } catch {
    return null;
  }
}
function safeInteger(source, ...keys) {
  for (const key of keys) {
    const value = source[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isSafeInteger(number) && number >= 0 && number <= 1e7) return number;
  }
  return null;
}
function reportItems(payload) {
  if (Array.isArray(payload)) return payload.filter(isRecord).slice(0, MAX_REPORTS_PER_REQUEST);
  if (!isRecord(payload)) return [];
  const legacy = payload["csp-report"];
  return isRecord(legacy) ? [legacy] : [payload];
}
function sanitizeCspReports(payload) {
  const sanitized = [];
  for (const item of reportItems(payload)) {
    const body = isRecord(item.body) ? item.body : isRecord(item["csp-report"]) ? item["csp-report"] : item;
    if (typeof item.type === "string" && item.type !== "csp-violation") continue;
    const directive = firstString(body, "effectiveDirective", "effective-directive", "violatedDirective", "violated-directive");
    if (!directive) continue;
    const disposition = firstString(body, "disposition")?.toLowerCase();
    sanitized.push({
      directive: directive.slice(0, 100),
      disposition: disposition === "enforce" || disposition === "report" ? disposition : "unknown",
      blockedUri: safeUri(firstString(body, "blockedURL", "blocked-uri", "blockedUri")),
      documentUri: safeUri(firstString(body, "documentURL", "document-uri", "url") ?? firstString(item, "url")),
      sourceFile: safeUri(firstString(body, "sourceFile", "source-file")),
      line: safeInteger(body, "lineNumber", "line-number"),
      column: safeInteger(body, "columnNumber", "column-number"),
      statusCode: safeInteger(body, "statusCode", "status-code")
    });
  }
  return sanitized;
}
function reply(status) {
  return new Response(null, { status, headers: CORS });
}
function createCspReportHandler(log = (record) => console.info(JSON.stringify(record)), now = Date.now) {
  let windowStartedAt = now();
  let logsInWindow = 0;
  const lastLogBySignature = /* @__PURE__ */ new Map();
  return async (request) => {
    if (request.method === "OPTIONS") return reply(204);
    if (request.method !== "POST") return reply(405);
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/reports+json" && contentType !== "application/csp-report" && contentType !== "application/json") {
      return reply(415);
    }
    const parsed = await readJsonBody(request, MAX_BODY_BYTES);
    if (!parsed.ok) return reply(parsed.status);
    const reports = sanitizeCspReports(parsed.data);
    const time = now();
    if (time - windowStartedAt >= LOG_WINDOW_MS) {
      windowStartedAt = time;
      logsInWindow = 0;
    }
    for (const report of reports) {
      const signature = JSON.stringify(report);
      const previous = lastLogBySignature.get(signature);
      if (previous && time - previous.loggedAt < LOG_WINDOW_MS) {
        previous.repeats += 1;
        continue;
      }
      if (logsInWindow >= MAX_LOGS_PER_MINUTE) continue;
      log({ event: "csp-report", ...report, repeatCount: (previous?.repeats ?? 0) + 1 });
      logsInWindow += 1;
      lastLogBySignature.set(signature, { loggedAt: time, repeats: 0 });
      if (lastLogBySignature.size > 256) {
        const oldest = lastLogBySignature.keys().next().value;
        if (oldest !== void 0) lastLogBySignature.delete(oldest);
      }
    }
    return reply(204);
  };
}
export {
  createCspReportHandler,
  sanitizeCspReports
};
