import { expect, test } from "@playwright/test";
import { FIXED_NOW, quickAdd } from "./helpers";

test("bugetul evidențiază costurile cunoscute și păstrează graficele în luna selectată", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/buget/");
  await expect(page.getByRole("heading", { name: "Martie 2026" })).toBeVisible();
  await expect(page.getByText(/Sold după (costurile cunoscute|cumpărăturile planificate)/)).toBeVisible();
  await page.getByRole("link", { name: "Deschide cumpărăturile" }).click();
  await quickAdd(page, "Zz produs de probă");
  const unchecked = page.getByRole("checkbox", { name: /^Bifează Zz produs de probă$/i });
  await expect(unchecked).toBeVisible();
  await unchecked.click();
  await expect(page.getByRole("checkbox", { name: /^Debifează Zz produs de probă$/i })).toBeVisible();

  await page.goto("/buget/");
  await expect(page.getByText("Sold după costurile cunoscute", { exact: true })).toBeVisible();
  await expect(page.getByText(/Estimare parțială · .* fără preț cunoscut/)).toBeVisible();
  await expect(page.getByText(/pe zi până la finalul lunii/)).toHaveCount(0);
  await page.getByRole("radio", { name: "Săptămâni", exact: true }).click();
  const weeklyChart = page.getByRole("img", { name: /^Cheltuieli pe săptămână/ });
  await expect(weeklyChart).toBeVisible();
  await expect(page.getByRole("img", { name: /^Cheltuieli pe lună/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Luna anterioară", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Februarie 2026" })).toBeVisible();
  await expect(weeklyChart).toBeVisible();
  await expect(page.getByRole("link", { name: "Deschide cumpărăturile" })).toHaveCount(0);
  await expect(page.getByText("Calculat cu plafonul configurat acum.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
