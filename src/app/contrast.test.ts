import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Textul trebuie să se poată citi în ambele moduri de culoare: contrastul
// perechilor folosite în aplicație, calculat direct din tokenii din globals.css.

const CSS = readFileSync(join(__dirname, "globals.css"), "utf8");

/** Tokenii dintr-un bloc CSS, după selectorul lui. */
function tokens(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`Lipsește blocul ${selector}`);
  const body = CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text, fundal, prag]: 4,5 pentru text obișnuit, 3 pentru metadate mari și pictograme.
const PAIRS: [string, string, number][] = [
  ...["bg", "surface", "surface-2"].flatMap((bg): [string, string, number][] => [
    ["ink", bg, 4.5],
    ["ink-2", bg, 4.5],
    ["ink-3", bg, 3],
    ["brand", bg, 4.5],
    ["warn", bg, 4.5],
  ]),
  // Terracotta apare ca text pe pagină, pe foi și pe fondul lui, nu pe kraft (surface-2).
  ["accent", "bg", 4.5],
  ["accent", "surface", 4.5],
  ["brand-ink", "brand", 4.5],
  ["brand", "brand-soft", 4.5],
  ["accent", "accent-soft", 4.5],
  ["warn", "warn-soft", 4.5],
  ["info", "info-soft", 4.5],
  // Verde crud (bifa, progresul, „Ai tot!”) și lemnul (titlurile raioanelor), .tasks/017.
  ["sprout", "bg", 4.5],
  ["sprout", "surface", 4.5],
  ["sprout-ink", "sprout", 4.5],
  ["wood", "bg", 4.5],
  ["wood", "surface", 4.5],
  ["wood", "surface-2", 4.5],
];

const LIGHT = tokens(":root,\n::backdrop");
const DARK = tokens(':root:not([data-theme="luminos"]),');

describe("contrastul tokenilor", () => {
  for (const [name, t] of [
    ["luminos", LIGHT],
    ["întunecat", DARK],
  ] as const) {
    it(`în modul ${name}, textul se citește pe fundalurile lui`, () => {
      const weak = PAIRS.filter(([fg, bg, min]) => contrast(t[fg], t[bg]) < min).map(([fg, bg, min]) => `${fg} pe ${bg}: ${contrast(t[fg], t[bg]).toFixed(2)} < ${min}`);
      expect(weak).toEqual([]);
    });
  }

  it("modul întunecat ales din aplicație are aceleași valori ca cel al sistemului", () => {
    expect(tokens(':root[data-theme="intunecat"],')).toEqual(DARK);
  });
});
