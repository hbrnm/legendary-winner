/**
 * Citirea în siguranță a corpului JSON din cererile primite de funcțiile Edge (F11).
 * Limitează dimensiunea fluxului (stream) pe octeți chiar și când antetul Content-Length
 * lipsește sau cererea e transferată prin bucăți (chunked transfer).
 */

export type ReadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: "bad_request" | "too_large" };

export async function readJsonBody<T = unknown>(req: Request, maxBytes: number): Promise<ReadJsonResult<T>> {
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
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("too_large").catch(() => {});
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
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
}
