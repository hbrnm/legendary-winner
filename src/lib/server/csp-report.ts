import { readJsonBody } from "./edge-body";

const MAX_BODY_BYTES = 16_384;
const MAX_REPORTS_PER_REQUEST = 20;
const MAX_LOGS_PER_MINUTE = 30;
const LOG_WINDOW_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

export type SanitizedCspReport = {
  directive: string;
  disposition: "enforce" | "report" | "unknown";
  blockedUri: string | null;
  documentUri: string | null;
  sourceFile: string | null;
  line: number | null;
  column: number | null;
  statusCode: number | null;
};

type JsonRecord = Record<string, unknown>;
type LogRecord = SanitizedCspReport & { event: "csp-report"; repeatCount: number };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(source: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 2048);
  }
  return null;
}

function safeUri(value: string | null): string | null {
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

function safeInteger(source: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isSafeInteger(number) && number >= 0 && number <= 10_000_000) return number;
  }
  return null;
}

function reportItems(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord).slice(0, MAX_REPORTS_PER_REQUEST);
  if (!isRecord(payload)) return [];
  const legacy = payload["csp-report"];
  return isRecord(legacy) ? [legacy] : [payload];
}

export function sanitizeCspReports(payload: unknown): SanitizedCspReport[] {
  const sanitized: SanitizedCspReport[] = [];
  for (const item of reportItems(payload)) {
    const body = isRecord(item.body) ? item.body : isRecord(item["csp-report"]) ? item["csp-report"] as JsonRecord : item;
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
      statusCode: safeInteger(body, "statusCode", "status-code"),
    });
  }
  return sanitized;
}

function reply(status: number): Response {
  return new Response(null, { status, headers: CORS });
}

/** Acceptă rapoarte CSP anonime, dar loghează doar câmpuri normalizate și fără query-uri. */
export function createCspReportHandler(
  log: (record: LogRecord) => void = (record) => console.info(JSON.stringify(record)),
  now: () => number = Date.now,
) {
  let windowStartedAt = now();
  let logsInWindow = 0;
  const lastLogBySignature = new Map<string, { loggedAt: number; repeats: number }>();

  return async (request: Request): Promise<Response> => {
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
        if (oldest !== undefined) lastLogBySignature.delete(oldest);
      }
    }

    return reply(204);
  };
}
