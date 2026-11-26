import { FULL_CROP, type Crop } from "@/lib/domain/receipt-crop";
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

async function readCrop(image: ImageBitmap, crop: Crop): Promise<string> {
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

export async function readPaddleReceipt(image: ImageBitmap, crop: Crop, automaticCrop: boolean): Promise<ParsedReceipt> {
  // The brightness-based crop can cut through the text on a wrinkled receipt.
  const first = parsePaddleReceipt(await readCrop(image, automaticCrop ? FULL_CROP : crop));
  if (first.total_matches || (crop.width === 1 && crop.height === 1)) return first;
  try {
    const second = parsePaddleReceipt(await readCrop(image, automaticCrop ? crop : FULL_CROP));
    if (second.total_matches || !first.lines.length) return second;
  } catch (error) {
    if (!first.lines.length) throw error;
  }
  return first;
}

const QUANTITY = /^(\d+(?:[.,:]\d{1,3})?)\s*[.~]?\s*(BUC|BUE|BIC|BC|KG|K6)\s*\.?\s*(?:[x×]\s*)?[.,]?(\d{1,5})[.,: ](\d{2})(?!\d)/i;
const AMOUNT = /^(\d{1,5}[.,:]\d{2})(?:\s*(?:LEI|RON))?$/i;
const SUMMARY = /^(TOTAL|OTAL|SUB\s*TOTAL|[JUI]B\s*TOTAL|UB\s*TOTAL)\b(.*)$/i;
const SUBTOTAL = /^(?:SUB|[JUI]B|UB)\s*TOTAL\b/i;
const DISCOUNT_LABEL = /^(?:D[I1]SCOUNT|[I1]SCOUNT|REDUCERE\s+\d+\s*%)\s*$/i;
const DISCOUNT_AMOUNT = /^(?:D[I1]SCOUNT|[I1]SCOUNT|REDUCERE\s+\d+\s*%)\s+(-?\d{1,5}[.,:]\d{2})(?:\s*-?\s*[A-H])?\s*-?\s*$/i;

function normalizeRows(text: string): string[] {
  const rows = text.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  let discountRead = false;
  return rows.flatMap((row, i) => {
    const qty = QUANTITY.exec(row);
    if (qty) {
      discountRead = false;
      return `${qty[1]} ${qty[2].toUpperCase()} x ${qty[3]},${qty[4]}${row.slice(qty[0].length)}`;
    }
    const discount = DISCOUNT_AMOUNT.exec(row);
    if (discount) {
      discountRead = true;
      return `DISCOUNT ${discount[1]}`;
    }
    if (discountRead && DISCOUNT_LABEL.test(row)) return [];
    discountRead = false;
    const summary = SUMMARY.exec(row);
    if (summary) {
      const [, label, rest] = summary;
      if (/^\s*(?:TVA|TUR)\b/i.test(rest)) return row;
      const total = /^T?OTAL$/i.test(label);
      const afterSubtotal = SUBTOTAL.test(rows[i - 2] ?? "");
      // On slanted photos the amount on the right can be read before its label.
      const preceding = afterSubtotal ? AMOUNT.exec(rows[i - 1] ?? "")?.[1] : null;
      return `${total ? "TOTAL" : "SUBTOTAL"}${rest || (total && preceding ? ` ${preceding}` : "")}`;
    }
    // Common letter confusion in the retailer's printed legal name.
    if (i < 3) return row.replace(/^LI[O0]L(?=\s+DISCOUNT\b)/i, "LIDL");
    return row;
  });
}

/** Some receipts print only a name and a price. Offer those rows only when
 * every candidate together matches the printed total, and flag each for review. */
export function parsePaddleReceipt(text: string): ParsedReceipt {
  const rows = normalizeRows(text);
  const receipt = parseReceipt(rows.join("\n"));
  if (receipt.lines.length || receipt.total === null) return receipt;

  const lines: ReceiptLine[] = [];
  let cents = 0;
  for (const row of rows) {
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
