import { defineConfig, devices } from "@playwright/test";

// Testele end-to-end rulează pe build-ul static (npm run build), în modul
// demonstrativ (fără Supabase), ca să nu depindă de rețea.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3100",
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "telefon", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /responsive|desktop/ },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://localhost:3100/",
    reuseExistingServer: !process.env.CI,
  },
});
