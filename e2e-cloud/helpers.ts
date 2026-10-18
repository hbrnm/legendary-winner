import { expect, type Browser, type Page } from "@playwright/test";

const run = Math.random().toString(36).slice(2, 8);

export async function signUp(browser: Browser, name: string, path = "/"): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  // Pagina invitației explică întâi ce urmează, apoi duce la autentificare.
  if (path.startsWith("/invitatie")) await page.getByRole("link", { name: "Continuă" }).click();
  await page.waitForURL(/autentificare/);
  await page.getByRole("radio", { name: "Cont nou" }).click();
  await page.getByLabel("Numele tău").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase()}-${run}@exemplu.ro`);
  await page.getByLabel("Parola").fill("o-parola-buna-123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  return page;
}

export async function quickAdd(page: Page, text: string, product: string) {
  const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await box.fill(text);
  await expect(page.getByRole("option").first()).toContainText(product);
  await box.press("Enter");
  await expect(box).toHaveValue("");
}

export async function syncNow(page: Page) {
  // „Sincronizat” poate fi încă eticheta de dinainte de clic; așteptăm o tragere reală de pe server.
  const pulled = page.waitForResponse((r) => r.url().includes("/rest/v1/") && r.request().method() === "GET");
  await page.getByRole("button", { name: /Sincronizează acum/ }).click();
  await pulled;
  await expect(page.getByRole("button", { name: /^Sincronizat/ })).toBeVisible();
}

