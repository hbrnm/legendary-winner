import { fitArea, sharpen, stretchContrast, type Crop } from "@/lib/domain/receipt-crop";
const READ_WIDTH = 1800;
function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const g = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  return g;
}

/** Bonul decupat, în gri, cu contrastul întins și accentuat, la lățimea de citire. */
export function prepareCanvas(image: ImageBitmap, crop: Crop): OffscreenCanvas {
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

