import { expect, test } from "@playwright/test";
import { start } from "./helpers";

const PAGES = ["/", "/cumparaturi/", "/retete/", "/plan/", "/buget/", "/buget/preturi/", "/camara/", "/gospodarie/", "/admin/", "/cumparaturi/istoric/"];

for (const width of [360, 1280]) {
  test(`fără derulare orizontală la ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await start(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("navigația principală are cele cinci secțiuni", async ({ page }) => {
  await start(page);
  const nav = page.getByRole("navigation", { name: "Navigare principală" }).last();
  for (const label of ["Acasă", "Cumpărături", "Rețete", "Buget", "Cămară"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
});
