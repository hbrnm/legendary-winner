// Server static minimal pentru out/ (testele E2E și verificarea locală a build-ului).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(`../${process.env.OUT_DIR ?? "out"}/`, import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };

createServer(async (req, res) => {
  let file;
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const path = decodeURIComponent(url.pathname);
    if (path.includes("\0")) throw new Error("Invalid path");
    file = resolve(ROOT, "." + path);
    const fromRoot = relative(ROOT, file);
    if (fromRoot === ".." || fromRoot.startsWith(".." + sep) || isAbsolute(fromRoot)) throw new Error("Invalid path");
  } catch {
    res.statusCode = 400;
    res.end("Cerere nevalidă");
    return;
  }
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
}).listen(PORT, "localhost", () => console.log(`Cămara: http://localhost:${PORT}`));
