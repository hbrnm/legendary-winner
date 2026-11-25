import { expect, test } from "@playwright/test";
import { openBasket, start } from "./helpers";

const recipe = "Omletă cu spanac și brânză feta";

for (const purchase of [
  { grams: null, expected: "50 g" },
  { grams: 200, expected: "200 g" },
]) {
  test(`din fișa rețetei în cămară: ${purchase.expected} de feta`, async ({ page }) => {
    const stock = page.getByRole("listitem").filter({ hasText: "Brânză feta" });
    await start(page, "/camara/");
    await expect(page.getByRole("status").filter({ hasText: "0 produse afișate" })).toBeVisible();

    await page.goto("/retete/");
    await page.getByLabel("Caută rețete").fill("omletă cu spanac");
    await page.getByRole("link", { name: recipe }).click();
    await expect(page.getByRole("heading", { name: recipe })).toBeVisible();
    await page.getByRole("button", { name: "Planifică", exact: true }).click();
    await page.getByLabel("Ziua").fill("2026-03-09");
    await page.getByLabel("Masa", { exact: true }).selectOption({ label: "Mic dejun" });
    await page.getByRole("button", { name: "Pune în plan" }).click();
    await expect(page.getByText("Am pus rețeta în plan.")).toBeVisible();

    await page.goto("/plan/");
    await page.getByRole("button", { name: "Săptămâna viitoare" }).click();
    await expect(page.getByRole("region", { name: /^luni/i }).getByText(recipe, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Generează lista de cumpărături" }).click();
    await page.getByRole("button", { name: "Generează lista", exact: true }).click();
    await page.waitForURL(/\/cumparaturi\/lista\//);

    const checkbox = page.getByRole("checkbox", { name: "Bifează Brânză feta", exact: true });
    const row = page.getByRole("listitem").filter({ has: checkbox });
    await expect(row.getByText("50 g", { exact: true })).toBeVisible();
    if (purchase.grams !== null) {
      await row.getByRole("button", { name: /^Brânză feta/ }).click();
      await page.getByLabel("Cantitate").fill(String(purchase.grams));
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(row.getByText(purchase.expected, { exact: true })).toBeVisible();
    }

    await checkbox.click();
    await openBasket(page);
    const checked = page.getByRole("checkbox", { name: "Debifează Brânză feta", exact: true });
    const checkedRow = page.getByRole("listitem").filter({ has: checked });
    await expect(checkedRow.getByText(purchase.expected, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Am plătit", exact: true }).click();
    await page.getByRole("button", { name: "Finalizează cumpărăturile" }).click();
    await expect(page.getByRole("region", { name: "Cumpărături înregistrate" })).toContainText("Adăugate în cămară");

    await page.goto("/camara/");
    await page.getByRole("searchbox", { name: "Caută în cămară" }).fill("Brânză feta");
    await expect(stock.getByText(purchase.expected, { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("searchbox", { name: "Caută în cămară" }).fill("Brânză feta");
    await expect(stock.getByText(purchase.expected, { exact: true })).toBeVisible();
  });
}
