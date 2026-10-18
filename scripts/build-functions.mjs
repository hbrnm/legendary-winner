// Împachetează logica funcțiilor Edge pentru Deno: un singur fișier JS, fără
// importuri, în supabase/functions/<nume>/core.js (generat; nu se editează de mână).
// Rulare: npm run build:functions. Testul build-functions.test.ts verifică
// că fișierele din repo sunt la zi.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;

export const FUNCTIONS = [
  { entry: "src/lib/server/import-recipe.ts", out: "supabase/functions/import-recipe/core.js" },
  { entry: "src/lib/server/translate-recipe.ts", out: "supabase/functions/translate-recipe/core.js" },
  { entry: "src/lib/server/read-receipt.ts", out: "supabase/functions/read-receipt/core.js" },
];

const BANNER = "// Generat de scripts/build-functions.mjs din src/lib/server/. Nu edita de mână: npm run build:functions.";

/** Codul împachetat al unei funcții, ca text. */
export async function bundle(entry) {
  const result = await build({
    entryPoints: [ROOT + entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    charset: "utf8",
    legalComments: "none",
    banner: { js: BANNER },
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

export const current = (out) => readFileSync(ROOT + out, "utf8");

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  for (const f of FUNCTIONS) {
    writeFileSync(ROOT + f.out, await bundle(f.entry));
    console.log(`${f.out} actualizat`);
  }
}
