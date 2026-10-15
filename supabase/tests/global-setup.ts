// Pornește un Postgres temporar (dacă TEST_DATABASE_URL nu e dat), aplică
// shim-ul Supabase, migrațiile și seed-ul. În CI se folosește un serviciu
// Postgres și TEST_DATABASE_URL.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
  }
}

const ROOT = new URL("../..", import.meta.url).pathname;
let server: ChildProcess | null = null;
let dataDir: string | null = null;

function pgBin(name: string): string {
  for (const v of ["17", "16", "15"]) {
    const p = `/usr/lib/postgresql/${v}/bin/${name}`;
    try {
      execFileSync("test", ["-x", p]);
      return p;
    } catch {}
  }
  return name;
}

function asPostgresUser(cmd: string, args: string[]): string[] {
  // initdb refuză să ruleze ca root.
  return process.getuid?.() === 0 ? ["runuser", "-u", "postgres", "--", cmd, ...args] : [cmd, ...args];
}

async function waitFor(url: string) {
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

export async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    dataDir = mkdtempSync(join(tmpdir(), "camara-pg-"));
    if (process.getuid?.() === 0) execFileSync("chown", ["postgres:postgres", dataDir]);
    const port = 54000 + Math.floor(Math.random() * 1000);
    const [c1, ...a1] = asPostgresUser(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C.UTF-8"]);
    execFileSync(c1, a1, { stdio: "ignore" });
    const [c2, ...a2] = asPostgresUser(pgBin("postgres"), ["-D", dataDir, "-p", String(port), "-k", dataDir, "-c", "listen_addresses=127.0.0.1", "-c", "fsync=off"]);
    server = spawn(c2, a2, { stdio: "ignore", detached: true });
    url = `postgres://postgres@127.0.0.1:${port}/postgres`;
    await waitFor(url);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
  await client.query("drop schema if exists public cascade; drop schema if exists storage cascade; create schema public; grant all on schema public to public;");
  await client.query(readFileSync(join(ROOT, "supabase/tests/supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(join(ROOT, "supabase/migrations")).sort()) {
    await client.query(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
  }
  await client.query(readFileSync(join(ROOT, "supabase/seed.sql"), "utf8"));
  } catch (e) {
    await client.end();
    await teardown();
    throw e;
  }
  await client.end();
  project.provide("dbUrl", url);
}

export async function teardown() {
  if (server) {
    const exited = new Promise((r) => server!.once("exit", r));
    // runuser nu transmite semnalul; oprim tot grupul de procese.
    process.kill(-server.pid!, "SIGINT");
    await exited;
    server = null;
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
}
