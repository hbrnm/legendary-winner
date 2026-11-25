import { expect, test } from "@playwright/test";
import { FIXED_NOW, quickAdd, start } from "./helpers";

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

test("sumele din cardul de buget încap pe telefon și pe desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "/buget/");
  await page.getByRole("button", { name: "Setează bugetul lunar", exact: true }).click();
  const budget = page.getByRole("dialog", { name: "Buget nou" });
  await budget.getByLabel("Suma (lei)").fill("8300");
  await budget.getByRole("button", { name: "Salvează", exact: true }).click();

  await page.getByRole("button", { name: "Acțiuni buget", exact: true }).click();
  await page.getByRole("dialog", { name: "Buget", exact: true }).getByRole("button", { name: "Adaugă cheltuială", exact: true }).click();
  const expense = page.getByRole("dialog", { name: "Cheltuială", exact: true });
  await expense.getByLabel("Sumă (RON)").fill("5443,24");
  await expense.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(expense).not.toBeVisible();

  const balance = page.getByText("Rămas", { exact: true }).locator("+ dd");
  const spent = page.getByText("Cheltuit în lună", { exact: true }).locator("+ dd");
  await expect(balance).toContainText(/2\.856,76\s+RON/);
  await expect(spent).toContainText(/5\.443,24\s+RON/);

  for (const width of [360, 390, 960]) {
    await page.setViewportSize({ width, height: 844 });
    for (const value of [balance, spent]) {
      expect(await value.evaluate((element) => {
        const range = document.createRange();
        range.selectNode(element.firstChild!);
        const text = range.getBoundingClientRect();
        const column = element.getBoundingClientRect();
        return text.left >= column.left - 1 && text.right <= column.right + 1;
      })).toBe(true);
    }
    const first = (await balance.boundingBox())!;
    const second = (await spent.boundingBox())!;
    if (width < 640) expect(first.y + first.height).toBeLessThan(second.y);
    else expect(first.x + first.width).toBeLessThan(second.x);
  }
});
