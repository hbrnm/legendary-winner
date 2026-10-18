import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build-ul pentru E2E cloud și binarele Supabase local.
    "out-cloud/**",
    // Fișierele OCR copiate la build (scripts/copy-ocr.mjs).
    "public/ocr/**",
    ".local-supabase/**",
    // Codul funcțiilor Edge, generat de scripts/build-functions.mjs.
    "supabase/functions/*/core.js",
  ]),
]);

export default eslintConfig;
