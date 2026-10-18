import { expect, test } from "@playwright/test";
import { start } from "./helpers";

// Fonturile vin din fișiere locale (src/app/fonts.ts). Pe Acasă apar ă, ș, ț,
// deci se încarcă și subsetul latin-ext, nu doar cel latin.
test("fonturile Cămarei se încarcă, cu diacriticele românești", async ({ page }) => {
  await start(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/['"]/g, "")));
  expect(loaded).toEqual(expect.arrayContaining(["dmSans", "dmSansExt", "fraunces", "frauncesExt"]));
  const h1 = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1).toMatch(/^"?fraunces/);
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(body).toMatch(/^"?dmSans/);
});
