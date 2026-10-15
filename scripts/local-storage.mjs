// Storage minimal pentru Supabase-ul local (scripts/local-supabase.mjs), cu
// căile folosite de supabase-js: încărcare (POST/PUT /object/{bucket}/{cale}),
// descărcare (GET /object/{bucket}/{cale}) și ștergere (DELETE /object/{bucket}).
// Drepturile le decide Postgres: rândul din storage.objects se scrie ca
// utilizatorul din JWT, cu RLS activ, ca în Supabase. Fișierele stau în memorie.
import { createHmac, timingSafeEqual } from "node:crypto";

const files = new Map();

function claimsOf(req, secret) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Rulează `fn` ca utilizatorul din JWT, cu RLS, într-o tranzacție. */
async function asUser(pool, claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${claims.role === "authenticated" ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub ?? ""]);
    const r = await fn((sql, params) => c.query(sql, params));
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function send(res, cors, status, json) {
  res.writeHead(status, { ...cors, "content-type": "application/json" });
  res.end(JSON.stringify(json));
}

// Ca Storage API: HTTP 400, codul real în `statusCode`.
const fail = (res, cors, statusCode, message) => send(res, cors, 400, { statusCode: String(statusCode), error: "Error", message });

export async function handleStorage(req, res, cors, { pool, secret }) {
  const claims = claimsOf(req, secret);
  if (!claims) return fail(res, cors, 400, "jwt malformed");
  const url = new URL(req.url, "http://local");
  const m = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)(?:\/(.+))?$/);
  if (!m) return fail(res, cors, 404, "Not found");
  const bucket = decodeURIComponent(m[1]);
  const name = m[2] ? decodeURIComponent(m[2]) : null;
  const key = (n) => `${bucket}/${n}`;
  try {
    if ((req.method === "POST" || req.method === "PUT") && name) {
      const data = await body(req);
      const type = req.headers["content-type"] ?? "application/octet-stream";
      const upsert = req.method === "PUT" || req.headers["x-upsert"] === "true";
      const limits = (await pool.query("select file_size_limit, allowed_mime_types from storage.buckets where id = $1", [bucket])).rows[0];
      if (!limits) return fail(res, cors, 404, "Bucket not found");
      if (limits.file_size_limit && data.length > Number(limits.file_size_limit)) return fail(res, cors, 413, "The object exceeded the maximum allowed size");
      if (limits.allowed_mime_types && !limits.allowed_mime_types.includes(type)) return fail(res, cors, 415, `mime type ${type} is not supported`);
      await asUser(pool, claims, async (q) => {
        const existing = await q("select id from storage.objects where bucket_id = $1 and name = $2", [bucket, name]);
        if (existing.rowCount && !upsert) throw Object.assign(new Error("The resource already exists"), { http: 409 });
        if (existing.rowCount) {
          const updated = await q("update storage.objects set owner = auth.uid() where bucket_id = $1 and name = $2", [bucket, name]);
          if (!updated.rowCount) throw new Error("new row violates row-level security policy");
        }
        else await q("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
      });
      files.set(key(name), { data, type });
      return send(res, cors, 200, { Key: key(name), path: name });
    }
    if (req.method === "GET" && name) {
      const seen = await asUser(pool, claims, async (q) => (await q("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucket, name])).rowCount);
      const file = files.get(key(name));
      if (!seen || !file) return fail(res, cors, 404, "Object not found");
      res.writeHead(200, { ...cors, "content-type": file.type });
      return res.end(file.data);
    }
    if (req.method === "DELETE" && !name) {
      const { prefixes = [] } = JSON.parse((await body(req)).toString() || "{}");
      const removed = await asUser(pool, claims, async (q) => (await q("delete from storage.objects where bucket_id = $1 and name = any($2) returning name", [bucket, prefixes])).rows);
      for (const r of removed) files.delete(key(r.name));
      return send(res, cors, 200, removed.map((r) => ({ name: r.name })));
    }
    return fail(res, cors, 404, "Not found");
  } catch (e) {
    if (e.http === 409) return fail(res, cors, 409, e.message);
    // RLS: „new row violates row-level security policy”.
    return fail(res, cors, 403, e.message);
  }
}
