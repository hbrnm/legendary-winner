import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OCR_VERSION } from "./read-receipt";

describe("fișierele OCR", () => {
  it("calea /ocr/<versiune>/ are versiunea instalată a tesseract.js (o copiază scripts/copy-ocr.mjs)", () => {
    const pkg = JSON.parse(readFileSync("node_modules/tesseract.js/package.json", "utf8"));
    expect(OCR_VERSION).toBe(pkg.version);
  });
});
