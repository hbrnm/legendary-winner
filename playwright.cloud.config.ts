import { defineConfig, devices } from "@playwright/test";

// E2E pentru modul cloud: conturi, gospodărie, invitații, sincronizare între
// membri, izolarea gospodăriilor. Rulează pe Supabase-ul local
// (scripts/local-supabase.mjs) și pe build-ul din out-cloud/
// (scripts/build-cloud-e2e.sh).
export default defineConfig({
  testDir: "./e2e-cloud",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: { ...devices["Pixel 7"], baseURL: "http://localhost:3200", locale: "ro-RO", timezoneId: "Europe/Bucharest", trace: "retain-on-failure" },
  webServer: [
    { command: "node scripts/local-supabase.mjs", url: "http://localhost:54321/auth/v1/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "node scripts/serve-static.mjs", env: { OUT_DIR: "out-cloud", PORT: "3200" }, url: "http://localhost:3200/", reuseExistingServer: true },
  ],
});
