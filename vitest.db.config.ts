import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testele bazei de date: migrațiile, RLS și funcțiile, pe un Postgres real.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["supabase/tests/**/*.test.ts"],
    globalSetup: ["./supabase/tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
