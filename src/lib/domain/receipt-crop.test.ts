import { describe, expect, it } from "vitest";
import { detectReceipt, FULL_CROP, sharpen, stretchContrast } from "./receipt-crop";

/** O poză sintetică: fundal închis, bonul deschis în dreptunghiul dat (în pixeli). */
function photo(w: number, h: number, rect: [number, number, number, number], paper = 220, background = 60): Uint8ClampedArray {
  const g = new Uint8ClampedArray(w * h).fill(background);
  const [x0, y0, x1, y1] = rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = paper;
  // Rândurile de text: pixeli închiși pe hârtie, ca pe un bon.
  for (let y = y0 + 5; y < y1 - 5; y += 6) for (let x = x0 + 4; x < x1 - 4; x += 3) g[y * w + x] = 30;
  return g;
}

describe("încadrarea propusă a bonului", () => {
  it("găsește bonul îngust și lung pe fundal închis, cu o margine mică", () => {
    const c = detectReceipt(photo(200, 260, [70, 10, 130, 245]), 200, 260);
    expect(c.x).toBeCloseTo(0.33, 2);
    expect(c.width).toBeCloseTo(0.34, 2);
    expect(c.y).toBeCloseTo(0.018, 2);
    expect(c.y + c.height).toBeCloseTo(0.96, 2);
  });

  it("fără bon clar sau cu bonul pe toată poza: poza întreagă", () => {
    expect(detectReceipt(new Uint8ClampedArray(100 * 100).fill(128), 100, 100)).toEqual(FULL_CROP);
    expect(detectReceipt(photo(100, 100, [0, 0, 100, 100]), 100, 100)).toEqual(FULL_CROP);
    expect(detectReceipt(photo(100, 100, [40, 40, 50, 50]), 100, 100)).toEqual(FULL_CROP);
    expect(detectReceipt(new Uint8ClampedArray(10), 5, 2)).toEqual(FULL_CROP);
  });
});

describe("contrastul", () => {
  it("întinde tonurile între 1% și 99%", () => {
    const g = new Uint8ClampedArray(1000);
    for (let i = 0; i < 1000; i++) g[i] = 100 + (i % 50);
    stretchContrast(g);
    expect(Math.min(...g)).toBe(0);
    expect(Math.max(...g)).toBe(255);
  });

  it("o imagine aproape uniformă rămâne neschimbată", () => {
    const g = new Uint8ClampedArray(100).fill(120);
    stretchContrast(g);
    expect([...new Set(g)]).toEqual([120]);
  });
});

describe("accentuarea", () => {
  it("o margine devine mai tranșantă; zonele uniforme rămân la fel", () => {
    // 6×3: stânga gri închis (80), dreapta deschis (200).
    const g = new Uint8ClampedArray([80, 80, 80, 200, 200, 200, 80, 80, 80, 200, 200, 200, 80, 80, 80, 200, 200, 200]);
    const s = sharpen(g, 6, 3);
    expect(s[7]).toBe(80);
    expect(s[8]).toBeLessThan(80);
    expect(s[9]).toBeGreaterThan(200);
    expect(s[0]).toBe(80);
  });
});
