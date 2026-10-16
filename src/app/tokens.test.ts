import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Culorile vin doar din tokenii din globals.css (CLAUDE.md, „UI”). Testul caută
// în componente culorile Tailwind standard, umbrele standard și culorile scrise direct.

const ROOT = join(__dirname, "..");
// Metadatele (culoarea barei de sus a telefonului, manifestul) cer culori scrise direct.
const ALLOWED = new Set(["app/manifest.ts", "app/layout.tsx"]);

const PALETTE = "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const FORBIDDEN = [
  { what: "culoare Tailwind standard", re: new RegExp(`\\b(?:[a-z-]+:)*(?:text|bg|border|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow|accent|caret|placeholder)-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?\\b`) },
  { what: "umbră Tailwind standard", re: /(?<![-\w])shadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?=["'\s`])/ },
  { what: "culoare scrisă direct", re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|-\[#/ },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("tokenii de culoare", () => {
  it("componentele folosesc doar tokenii din globals.css", () => {
    const problems: string[] = [];
    for (const file of files(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWED.has(rel) || rel.startsWith("data/")) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const f of FORBIDDEN) {
            const m = line.match(f.re);
            if (m) problems.push(`${rel}:${i + 1} ${f.what}: ${m[0]}`);
          }
        });
    }
    expect(problems).toEqual([]);
  });
});
