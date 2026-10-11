import { expect, type Page } from "@playwright/test";

/** Data fixă pentru teste (duminică), ca rezultatele să nu depindă de ziua rulării. */
export const FIXED_NOW = new Date("2026-03-08T09:00:00+02:00");

export async function start(page: Page, path = "/") {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(path);
  await expect(page.getByText("Mod demonstrativ")).toBeVisible();
}

export async function quickAdd(page: Page, text: string) {
  const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await box.fill(text);
  await expect(page.getByRole("listbox")).toBeVisible();
  await box.press("Enter");
  await expect(box).toHaveValue("");
}

export async function createList(page: Page, name: string) {
  await page.goto("/cumparaturi/");
  await page.getByRole("button", { name: "Listă nouă" }).click();
  await page.getByLabel("Numele listei").fill(name);
  await page.getByRole("button", { name: "Creează lista" }).click();
  await page.waitForURL(/\/cumparaturi\/lista\//);
  await expect(page.getByRole("heading", { name })).toBeVisible();
}
