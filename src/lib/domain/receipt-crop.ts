// Încadrarea propusă a bonului în fotografie (.tasks/005, etapa 4): bonul e
// hârtia deschisă la culoare pe un fundal mai închis. Omul o poate corecta.
// Logică pură, pe o imagine mică în tonuri de gri (0–255, rând cu rând).

/** Dreptunghiul bonului, ca fracțiuni din lățimea și înălțimea fotografiei. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** Pragul care desparte hârtia de fundal (Otsu). */
function otsu(gray: Uint8Array | Uint8ClampedArray): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = gray.length - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Cea mai lungă porțiune continuă în care profilul trece de prag. */
function longestRun(profile: number[], min: number): [number, number] | null {
  let best: [number, number] | null = null;
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    if (i < profile.length && profile[i] >= min) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (!best || i - start > best[1] - best[0]) best = [start, i];
      start = -1;
    }
  }
  return best;
}

/**
 * Propune încadrarea: coloanele, apoi rândurile în care cel puțin jumătate din
 * pixeli sunt „hârtie”. Cu o margine mică, ca să nu taie textul. Fără un bon
 * clar (sub 5% din poză sau aproape toată poza), întoarce poza întreagă.
 */
export function detectReceipt(gray: Uint8Array | Uint8ClampedArray, width: number, height: number): Crop {
  if (width < 8 || height < 8 || gray.length !== width * height) return FULL_CROP;
  const t = otsu(gray);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (gray[y * width + x] > t) cols[x]++;
  const xr = longestRun(cols.map((c) => c / height), 0.5);
  if (!xr) return FULL_CROP;
  const rows = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) for (let x = xr[0]; x < xr[1]; x++) if (gray[y * width + x] > t) rows[y]++;
  const yr = longestRun(rows.map((r) => r / (xr[1] - xr[0])), 0.5);
  if (!yr) return FULL_CROP;
  const pad = 0.02;
  const x0 = Math.max(0, xr[0] / width - pad);
  const x1 = Math.min(1, xr[1] / width + pad);
  const y0 = Math.max(0, yr[0] / height - pad);
  const y1 = Math.min(1, yr[1] / height + pad);
  const area = (x1 - x0) * (y1 - y0);
  if (area < 0.05 || area > 0.95) return FULL_CROP;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Întinde contrastul: tonul de la 1% devine negru, cel de la 99% alb (hârtia
 * termică ștearsă, umbrele). Modifică tabloul primit.
 */
export function stretchContrast(gray: Uint8ClampedArray): void {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  const lowCount = gray.length * 0.01;
  const highCount = gray.length * 0.99;
  let acc = 0;
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (lo < 0 && acc > lowCount) lo = i;
    if (hi < 0 && acc >= highCount) hi = i;
  }
  if (hi - lo < 16) return;
  for (let i = 0; i < gray.length; i++) gray[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - lo) * 255) / (hi - lo))));
}

/**
 * Accentuează marginile literelor (nucleul 3×3 „unsharp”: centrul ×5, vecinii
 * ×−1). În probă, fără el sumele de pe bon ieșeau mai des greșit.
 */
export function sharpen(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      out[i] = 5 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
    }
  }
  return out;
}
