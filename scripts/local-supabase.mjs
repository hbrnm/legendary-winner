// Supabase minimal, local, fără Docker: Postgres + Supabase Auth (GoTrue) +
// PostgREST + un Storage minimal (scripts/local-storage.mjs) + un proxy pe
// portul 54321 cu aceleași căi ca Supabase (/auth/v1, /rest/v1, /storage/v1). Folosit de testele E2E pentru modul cloud
// (conturi, gospodării, invitații, RLS prin API, sincronizare).
// Realtime nu e inclus: aplicația sincronizează și periodic/la revenire.
//
// Rulare: node scripts/local-supabase.mjs   (Ctrl+C oprește tot)
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { join } from "node:path";
import pg from "pg";
import { ANON_KEY, JWT_SECRET } from "./local-supabase-keys.mjs";
import { handleStorage } from "./local-storage.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = join(ROOT, ".local-supabase");
const BIN = join(DIR, "bin");
const PG_PORT = 54322;
const REST_PORT = 54330;
const AUTH_PORT = 54331;
const PROXY_PORT = 54321;
const PASSWORD = "local";
const SITE = process.env.SITE_URL ?? "http://localhost:3200";

function ensureBinaries() {
  if (existsSync(join(BIN, "postgrest")) && existsSync(join(BIN, "auth"))) return;
  mkdirSync(BIN, { recursive: true });
  execFileSync("sh", ["-c", `curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C '${BIN}'`], { stdio: "inherit" });
  execFileSync("sh", ["-c", `curl -sSL https://github.com/supabase/auth/releases/download/v2.169.0/auth-v2.169.0-x86.tar.gz | tar -xz -C '${BIN}'`], { stdio: "inherit" });
}

function pgBin(name) {
  for (const v of ["17", "16", "15"]) if (existsSync(`/usr/lib/postgresql/${v}/bin/${name}`)) return `/usr/lib/postgresql/${v}/bin/${name}`;
  return name;
}
const asPg = (cmd, args) => (process.getuid?.() === 0 ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]);

const children = [];
function run(cmd, args, env, label) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  p.stdout.on("data", (d) => process.env.DEBUG && process.stdout.write(`[${label}] ${d}`));
  p.stderr.on("data", (d) => process.env.DEBUG && process.stderr.write(`[${label}] ${d}`));
  children.push(p);
  return p;
}

async function waitPg(url) {
  for (let i = 0; i < 100; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Postgres nu a pornit");
}

async function waitHttp(url) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Nu răspunde: ${url}`);
}

async function main() {
  ensureBinaries();
  const data = join(DIR, "pgdata");
  // Procesele rămase de la o rulare oprită brusc (ex. de Playwright) țin porturile ocupate.
  for (const pattern of [`postgres -D ${data}`, `^${join(BIN, "auth")}`, `^${join(BIN, "postgrest")}`]) {
    try {
      execFileSync("pkill", ["-KILL", "-f", pattern], { stdio: "ignore" });
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 500));
  rmSync(data, { recursive: true, force: true });
  mkdirSync(data, { recursive: true });
  if (process.getuid?.() === 0) execFileSync("chown", ["postgres:postgres", data]);
  const [c1, a1] = asPg(pgBin("initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C.UTF-8"]);
  execFileSync(c1, a1, { stdio: "ignore" });
  const [c2, a2] = asPg(pgBin("postgres"), ["-D", data, "-p", String(PG_PORT), "-k", data, "-c", "listen_addresses=127.0.0.1", "-c", "fsync=off"]);
  run(c2, a2, {}, "postgres");
  const admin = `postgres://postgres@127.0.0.1:${PG_PORT}/postgres`;
  await waitPg(admin);

  const db = new pg.Client({ connectionString: admin });
  await db.connect();
  await db.query(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role service_role nologin noinherit bypassrls;
    create role authenticator login noinherit password '${PASSWORD}';
    grant anon, authenticated, service_role to authenticator;
    create role supabase_auth_admin login createrole password '${PASSWORD}';
    create schema auth authorization supabase_auth_admin;
    grant create on database postgres to supabase_auth_admin;
    alter role supabase_auth_admin set search_path = auth;
  `);

  // Migrațiile serverului de autentificare (creează auth.users etc.).
  const authEnv = {
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: `postgres://supabase_auth_admin:${PASSWORD}@127.0.0.1:${PG_PORT}/postgres?search_path=auth`,
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_SITE_URL: SITE,
    GOTRUE_URI_ALLOW_LIST: `${SITE}/**`,
    API_EXTERNAL_URL: `http://localhost:${PROXY_PORT}/auth/v1`,
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(AUTH_PORT),
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_SMTP_ADMIN_EMAIL: "local@camara.test",
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_LOG_LEVEL: "error",
  };
  execFileSync(join(BIN, "auth"), ["migrate"], { env: { ...process.env, ...authEnv }, cwd: BIN, stdio: process.env.DEBUG ? "inherit" : "ignore" });

  // Funcțiile auth.uid()/auth.jwt() ca în Supabase, apoi schema aplicației și catalogul.
  await db.query(readFileSync(join(ROOT, "supabase/tests/supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(join(ROOT, "supabase/migrations")).sort()) await db.query(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
  await db.query(readFileSync(join(ROOT, "supabase/seed.sql"), "utf8"));
  await db.query("grant usage on schema public to anon, authenticated, service_role; grant all on all tables in schema public to service_role; notify pgrst, 'reload schema';");
  await db.end();

  run(join(BIN, "auth"), ["serve"], authEnv, "auth");
  run(
    join(BIN, "postgrest"),
    [],
    {
      PGRST_DB_URI: `postgres://authenticator:${PASSWORD}@127.0.0.1:${PG_PORT}/postgres`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_PORT: String(REST_PORT),
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_LOG_LEVEL: "error",
    },
    "rest",
  );
  await waitHttp(`http://127.0.0.1:${AUTH_PORT}/health`);
  await waitHttp(`http://127.0.0.1:${REST_PORT}/`);

  // Storage: rândurile din storage.objects se scriu ca utilizatorul, cu RLS.
  const storagePool = new pg.Pool({ connectionString: admin, max: 4 });

  // Proxy cu căile Supabase.
  const routes = [
    ["/auth/v1", AUTH_PORT],
    ["/rest/v1", REST_PORT],
  ];
  createServer((req, res) => {
    // CORS-ul îl face proxy-ul, ca Kong în Supabase (GoTrue refuză antetul `apikey`).
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
      "access-control-expose-headers": "Content-Range, X-Total-Count, Link, X-Supabase-Api-Version",
      vary: "Origin",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (req.url.startsWith("/storage/v1/")) {
      void handleStorage(req, res, cors, { pool: storagePool, secret: JWT_SECRET });
      return;
    }
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.statusCode = req.url.startsWith("/realtime") ? 404 : 404;
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end();
    }
    const upstream = request(
      { host: "127.0.0.1", port: route[1], path: req.url.slice(route[0].length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${route[1]}` } },
      (up) => {
        const headers = Object.fromEntries(Object.entries(up.headers).filter(([k]) => !k.startsWith("access-control-") && k !== "vary"));
        res.writeHead(up.statusCode ?? 502, { ...headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.statusCode = 502;
      res.end();
    });
    req.pipe(upstream);
  }).listen(PROXY_PORT, "127.0.0.1");

  writeFileSync(join(DIR, "env"), `NEXT_PUBLIC_SUPABASE_URL=http://localhost:${PROXY_PORT}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}\n`);
  console.log(`Supabase local pornit: http://localhost:${PROXY_PORT}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=http://localhost:${PROXY_PORT}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
}

function stop() {
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGINT");
    } catch {}
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

main().catch((e) => {
  console.error(e);
  stop();
});
