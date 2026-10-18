import { detectReceipt, sharpen, stretchContrast, type Crop } from "@/lib/domain/receipt-crop";

// Citirea bonului pe telefon (.tasks/005, etapa 4): tesseract.js cu limba
// română, din fișierele servite de aplicație (/ocr/<versiune>/, copiate la build
// de scripts/copy-ocr.mjs). Fotografia nu pleacă de pe telefon și nu se păstrează.

/** Versiunea tesseract.js din package.json; un test verifică potrivirea. */
export const OCR_VERSION = "7.0.0";
const BASE = `/ocr/${OCR_VERSION}`;
/** Lățimea la care se citește (în probă, 1800 px a dat cel mai bun rezultat). */
const READ_WIDTH = 1800;

export interface ReadProgress {
  /** 0–1 */
  progress: number;
  /** „pregatire” (descărcarea fișierelor, prima dată), apoi „citire”. */
  stage: "pregatire" | "citire";
}

/** Pentru testele end-to-end: un text OCR dat, fără motorul real. */
declare global {
  var __camaraOcrText: string | undefined;
}

export async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
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
  const w = READ_WIDTH;
  const h = Math.max(1, Math.round((sh / sw) * w));
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
