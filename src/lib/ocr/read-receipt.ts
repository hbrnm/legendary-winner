import { detectReceipt, fitArea, sharpen, stretchContrast, type Crop } from "@/lib/domain/receipt-crop";
import { parseReceipt, type ParsedReceipt } from "@/lib/domain/receipt";
import { readReceiptJson, receiptFromJson } from "@/lib/domain/receipt-json";

// Citirea bonului pe telefon (.tasks/005, etapa 4): tesseract.js cu limba
// română, din fișierele servite de aplicație (/ocr/<versiune>/, copiate la build
// de scripts/copy-ocr.mjs). Pe această cale fotografia nu pleacă de pe telefon; cu
// cont, bonul decupat se citește întâi pe server (mai jos, .tasks/015). Nu se păstrează.

/** Versiunea tesseract.js din package.json; un test verifică potrivirea. */
export const OCR_VERSION = "7.0.0";
const BASE = `/ocr/${OCR_VERSION}`;
/** Lățimea la care se citește (în probă, 1800 px a dat cel mai bun rezultat). */
const READ_WIDTH = 1800;

export interface ReadProgress {
  /** 0–1 */
  progress: number;
  /** „server” (citirea cu Gemini, fără procent); pe telefon „pregatire” (descărcarea fișierelor, prima dată), apoi „citire”. */
  stage: "server" | "pregatire" | "citire";
}

/** Pentru testele end-to-end: un text OCR dat, fără motorul real. */
declare global {
  var __camaraOcrText: string | undefined;
}

/**
 * Fotografia, întoarsă cum a fost făcută și sub limita de pânză a Safari.
 * Trecem prin <img>, ca în fereastra de încadrare: pe iPhone, orientarea din
 * EXIF se aplică sigur la desenarea imaginii, nu și la createImageBitmap(blob).
 */
export async function loadImage(file: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { width, height } = fitArea(img.naturalWidth, img.naturalHeight);
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return canvas.transferToImageBitmap();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Încadrarea propusă, dintr-o copie mică a fotografiei. */
export function proposeCrop(image: ImageBitmap): Crop {
  const w = 200;
  const h = Math.max(1, Math.round((image.height / image.width) * w));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);
  return detectReceipt(toGray(ctx.getImageData(0, 0, w, h).data), w, h);
}

function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const g = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  return g;
}

/** Bonul decupat, în gri, cu contrastul întins și accentuat, la lățimea de citire. */
function prepare(image: ImageBitmap, crop: Crop): OffscreenCanvas {
  const sx = Math.round(crop.x * image.width);
  const sy = Math.round(crop.y * image.height);
  const sw = Math.max(1, Math.round(crop.width * image.width));
  const sh = Math.max(1, Math.round(crop.height * image.height));
  const { width: w, height: h } = fitArea(READ_WIDTH, Math.max(1, Math.round((sh / sw) * READ_WIDTH)));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const flat = toGray(data.data);
  stretchContrast(flat);
  const gray = sharpen(flat, w, h);
  for (let i = 0; i < gray.length; i++) data.data.set([gray[i], gray[i], gray[i], 255], i * 4);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Textul bonului. Prima dată descarcă fișierele OCR (câțiva MB); apoi merge și fără internet. */
export async function readReceipt(image: ImageBitmap, crop: Crop, onProgress: (p: ReadProgress) => void = () => {}): Promise<string> {
  if (globalThis.__camaraOcrText != null) {
    onProgress({ progress: 1, stage: "citire" });
    return globalThis.__camaraOcrText;
  }
  const canvas = prepare(image, crop);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ron", 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: BASE,
    langPath: BASE,
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => onProgress({ progress: m.progress, stage: m.status === "recognizing text" ? "citire" : "pregatire" }),
  });
  try {
    const { data } = await worker.recognize(blob);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Citirea pe server (.tasks/015): cu cont și internet, bonul decupat merge la
// funcția Edge `read-receipt` (Gemini), care nu păstrează nimic. Dacă nu merge,
// citește telefonul, ca mai sus.

/** Latura mare a bonului trimis la server: destul pentru Gemini, puțin de trimis. */
const SERVER_MAX_SIDE = 2400;

/** Cererea către funcția Edge `read-receipt`. */
export type ReceiptCall = (body: { image: { mimeType: "image/jpeg"; data: string } }) => Promise<Response>;

/** Octeții în base64, pe bucăți (un apel cu toți octeții depășește stiva la câțiva MB). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Bonul decupat, color, ca JPEG în base64 (latura mare cel mult 2400 px, fără mărire). */
export async function receiptJpeg(image: ImageBitmap, crop: Crop): Promise<string> {
  const sx = Math.round(crop.x * image.width);
  const sy = Math.round(crop.y * image.height);
  const sw = Math.max(1, Math.round(crop.width * image.width));
  const sh = Math.max(1, Math.round(crop.height * image.height));
  const k = Math.min(1, SERVER_MAX_SIDE / Math.max(sw, sh));
  const { width, height } = fitArea(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

/**
 * Citirea prin server: bonul citit ca JSON (`receipt`). Răspunsul vechi, cu textul
 * transcris (`text`), trece încă prin `parseReceipt`, cât timp funcția de pe
 * server nu e la zi. Un răspuns fără bon e o eroare.
 */
export function serverReceiptReader(call: ReceiptCall): (jpeg: string) => Promise<ParsedReceipt> {
  return async (jpeg) => {
    const res = await call({ image: { mimeType: "image/jpeg", data: jpeg } });
    const body = (await res.json().catch(() => null)) as { receipt?: unknown; text?: unknown } | null;
    const json = res.ok ? readReceiptJson(body?.receipt) : null;
    if (json && !json.error && json.lines.length > 0) return receiptFromJson(json);
    if (res.ok && typeof body?.text === "string" && body.text.trim()) return parseReceipt(body.text);
    throw new Error(`read-receipt ${res.status}`);
  };
}

/** Întâi serverul (când e), iar dacă nu merge (fără internet, limita, eroare), telefonul. `fallback` = serverul n-a mers. */
export async function readWithFallback<T>(server: (() => Promise<T>) | null, phone: () => Promise<T>): Promise<{ result: T; fallback: boolean }> {
  if (!server) return { result: await phone(), fallback: false };
  try {
    return { result: await server(), fallback: false };
  } catch {
    return { result: await phone(), fallback: true };
  }
}
