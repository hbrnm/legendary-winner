import { expect, type Page } from "@playwright/test";

/** Data fixă pentru teste (duminică), ca rezultatele să nu depindă de ziua rulării. */
export const FIXED_NOW = new Date("2026-03-08T09:00:00+02:00");

/** Pornește aplicația în modul demonstrativ gol (fără gospodăria model), ca testele să plece de la zero. */
export async function start(page: Page, path = "/") {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => window.localStorage.setItem("camara-demo-gol", "1"));
  await page.goto(path);
  await expect(page.getByText("Mod demonstrativ")).toBeVisible();
}

export async function quickAdd(page: Page, text: string, product?: string) {
  const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await box.fill(text);
  await expect(page.getByRole("listbox")).toBeVisible();
  if (product) await page.getByRole("option", { name: product, exact: true }).click();
  else await box.press("Enter");
  await expect(box).toHaveValue("");
}

export async function createList(page: Page, name: string) {
  await page.goto("/cumparaturi/?toate=1");
  await page.getByRole("button", { name: "Acțiuni cumpărături" }).click();
  await page.getByRole("dialog", { name: "Cumpărături" }).getByRole("button", { name: "Listă nouă" }).click();
  await page.waitForURL(/\/cumparaturi\/lista\//);
  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Schimbă numele", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Schimbă numele listei" });
  await sheet.getByRole("textbox", { name: "Numele listei" }).fill(name);
  await sheet.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Deschide „În coș”, unde coboară produsele bifate (strâns la început). */
export async function openBasket(page: Page) {
  const basket = page.getByRole("button", { name: /^În coș \(\d+\)$/ });
  if ((await basket.getAttribute("aria-expanded")) !== "true") await basket.click();
}
