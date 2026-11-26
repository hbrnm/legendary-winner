import type { Crop } from "@/lib/domain/receipt-crop";
import { parseReceipt, type ParsedReceipt, type ReceiptLine } from "@/lib/domain/receipt";

type PaddleReader = (canvas: HTMLCanvasElement) => Promise<string>;

declare global {
  var __camaraReadPaddle: PaddleReader | undefined;
}

let loading: Promise<PaddleReader> | undefined;
let attempts = 0;

function reader(): Promise<PaddleReader> {
  if (globalThis.__camaraReadPaddle) return Promise.resolve(globalThis.__camaraReadPaddle);
  loading ??= new Promise<PaddleReader>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    const retry = attempts++ ? `?retry=${attempts}` : "";
    script.src = `/ocr/paddle-0.4.2/reader.js${retry}`;
    const finish = (loaded: boolean) => {
      clearTimeout(timeout);
      script.remove();
      if (loaded && globalThis.__camaraReadPaddle) resolve(globalThis.__camaraReadPaddle);
      else reject(new Error("PaddleOCR is unavailable"));
    };
    const timeout = setTimeout(() => finish(false), 20_000);
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.append(script);
  }).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export async function readPaddleReceipt(image: ImageBitmap, crop: Crop): Promise<string> {
  const x = Math.round(crop.x * image.width);
  const y = Math.round(crop.y * image.height);
  const width = Math.max(1, Math.round(crop.width * image.width));
  const height = Math.max(1, Math.round(crop.height * image.height));
  const scale = Math.min(1, 2400 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return (await reader())(canvas);
}

/** Some receipts print only a name and a price. Offer those rows only when
 * every candidate together matches the printed total, and flag each for review. */
export function parsePaddleReceipt(text: string): ParsedReceipt {
  const receipt = parseReceipt(text);
  if (receipt.lines.length || receipt.total === null) return receipt;

  const lines: ReceiptLine[] = [];
  let cents = 0;
  for (const row of text.split(/\r?\n/)) {
    if (/^\s*(?:sub\s*)?total\b/i.test(row)) break;
    const match = /^\s*(\p{L}[\p{L}\d .'-]*?)\s+(\d{1,5})[,.](\d{2})(?:\s+[A-H])?\s*$/iu.exec(row);
    if (!match) continue;
    const amountCents = Number(match[2]) * 100 + Number(match[3]);
    cents += amountCents;
    lines.push({
      name: match[1].trim(), quantity: null, unit: null, unit_price: null,
      amount: amountCents / 100, printed_amount: amountCents / 100, discount: 0, check: "de_verificat",
    });
  }
  if (!lines.length || cents !== Math.round(receipt.total * 100)) return receipt;
  return { ...receipt, lines, lines_total: cents / 100, total_matches: true };
}
