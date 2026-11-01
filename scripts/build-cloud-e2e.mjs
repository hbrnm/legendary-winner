// Construiește aplicația conectată la Supabase-ul local (scripts/local-supabase.mjs)
// în out-cloud/, pentru testele E2E ale modului cloud. Build-ul obișnuit (out/) rămâne în mod demonstrativ.
import { execFileSync } from "node:child_process";
import { rmSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ANON_KEY } from "./local-supabase-keys.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const outCloud = join(ROOT, "out-cloud");
const out = join(ROOT, "out");

if (existsSync(outCloud)) rmSync(outCloud, { recursive: true, force: true });

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["next", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  },
});

execFileSync(process.execPath, [join(ROOT, "scripts", "build-sw.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});

if (existsSync(out)) {
  renameSync(out, outCloud);
}
