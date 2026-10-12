// După `next build` (static export în out/): scrie out/sw.js cu lista
// paginilor și resurselor de pus în cache, ca aplicația să pornească offline.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const OUT = new URL("../out/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push("/" + relative(OUT, p).split("\\").join("/"));
  }
})(OUT);

const precache = files
  .filter((f) => !f.endsWith(".map") && !f.endsWith(".txt") && f !== "/sw.js" && !f.startsWith("/_next/static/media/"))
  .filter((f) => f.endsWith("/index.html") || f.startsWith("/_next/static/") || f.startsWith("/icons/") || f === "/manifest.webmanifest" || f === "/favicon.ico")
  .map((f) => (f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f))
  .sort();

const hash = createHash("sha1");
for (const f of files.filter((x) => x.startsWith("/_next/static/") || x.endsWith(".html") || /^\/retete\/[a-z0-9-]+\.webp$/.test(x)).sort()) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

const template = readFileSync(new URL("../src/sw/sw.template.js", import.meta.url), "utf8");
writeFileSync(join(OUT, "sw.js"), template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache, null, 0)));
console.log(`sw.js: ${precache.length} fișiere în cache, versiunea ${version}`);
