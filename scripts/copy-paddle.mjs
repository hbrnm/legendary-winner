import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sdk = dirname(fileURLToPath(import.meta.resolve("@paddleocr/paddleocr-js")));
const ort = dirname(fileURLToPath(import.meta.resolve("onnxruntime-web")));
const version = "paddle-0.4.2";
const output = fileURLToPath(new URL(`../public/ocr/${version}/`, import.meta.url));
const bundledModels = fileURLToPath(new URL("../assets/paddle/", import.meta.url));
const models = process.env.CAMARA_PADDLE_MODEL_DIR ?? bundledModels;
const hashes = {
  "PP-OCRv6_tiny_det_onnx_infer.tar": "ff6ab415b0a6e0c488550f2fb5d5046f1719848df220b2dc21b56402a65bc05d",
  "PP-OCRv6_tiny_rec_onnx_infer.tar": "1e13b22717b1edd89d4cde4fda272b6c17d5b505c97c2baea99da1a3a2d54b29",
};

await mkdir(output, { recursive: true });
await Promise.all(Object.entries(hashes).map(async ([file, hash]) => {
  const bytes = await readFile(join(models, file));
  if (createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error(`Invalid PaddleOCR model: ${file}`);
  await writeFile(join(output, file), bytes);
}));
for (const file of ["LICENSE", "NOTICE"]) await copyFile(join(bundledModels, file), join(output, file));

await mkdir(join(output, "assets"), { recursive: true });
for (const file of await readdir(join(sdk, "assets"))) {
  if (file.startsWith("worker-entry-") && file.endsWith(".js")) await copyFile(join(sdk, "assets", file), join(output, "assets", file));
}
for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  await copyFile(join(ort, file), join(output, file));
}
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/ocr/paddle-browser.mjs", import.meta.url))],
  outfile: join(output, "reader.js"),
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  external: ["fs", "path"],
});
