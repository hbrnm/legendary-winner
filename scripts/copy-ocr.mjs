// Înainte de `next build`: copiază în public/ocr/ fișierele OCR (tesseract.js),
// ca aplicația să le servească ea, nu un CDN: fotografia bonului nu atinge alte
// servere, iar după prima folosire citirea merge și fără internet (.tasks/005).
// Calea are versiunea, ca service worker-ul să le țină în cache între versiunile aplicației.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const version = require("tesseract.js/package.json").version;
const OUT = new URL(`../public/ocr/${version}/`, import.meta.url).pathname;
rmSync(new URL("../public/ocr/", import.meta.url).pathname, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const core = dirname(require.resolve("tesseract.js-core/package.json"));
const files = [
  [join(dirname(require.resolve("tesseract.js/package.json")), "dist/worker.min.js"), "worker.min.js"],
  // Variantele LSTM (singurul motor folosit); tesseract.js o alege pe cea suportată de telefon.
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [join(core, f), f]),
  [join(dirname(require.resolve("@tesseract.js-data/ron/package.json")), "4.0.0_best_int/ron.traineddata.gz"), "ron.traineddata.gz"],
];
for (const [from, to] of files) copyFileSync(from, join(OUT, to));
console.log(`ocr: ${files.length} fișiere în public/ocr/${version}/`);
