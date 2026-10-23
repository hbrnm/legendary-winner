// Server static minimal pentru out/ (testele E2E și verificarea locală a build-ului).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL(`../${process.env.OUT_DIR ?? "out"}/`, import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 3100);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    try {
      await stat(file + ".html");
      file += ".html";
    } catch {
      file = join(ROOT, "404.html");
      res.statusCode = 404;
    }
  }
  try {
    let body = await readFile(file);
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    if (file.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
      // Doar pentru teste: cookie-ul `sw-versiune` simulează publicarea unei versiuni noi (e2e/offline-pwa.spec.ts).
      const fake = /(?:^|;\s*)sw-versiune=([a-z0-9]+)/.exec(req.headers.cookie ?? "")?.[1];
      if (fake) body = Buffer.from(body.toString("utf8").replace(/const VERSION = "([^"]+)"/, `const VERSION = "$1-${fake}"`));
    }
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("Nu există");
  }
}).listen(PORT, () => console.log(`Cămara: http://localhost:${PORT}`));
