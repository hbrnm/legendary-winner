import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("copia de siguranță: descarci datele și le readuci pe un dispozitiv gol", async ({ page, browser }) => {
  await start(page);
  await createList(page, "Lista de păstrat");
  await quickAdd(page, "pâine");

  await page.goto("/gospodarie/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descarcă datele" }).click()]);
  const file = await download.path();

  // Alt dispozitiv: browser fără date.
  const context = await browser.newContext();
  const other = await context.newPage();
  await start(other, "/gospodarie/");
  await other.getByLabel("Încarcă o copie").setInputFiles(file);
  await expect(other.getByText(/^Gata\. Am adăugat \d+/)).toBeVisible();

  // Al doilea import nu aduce nimic nou.
  await other.getByLabel("Încarcă o copie").setInputFiles(file);
  await expect(other.getByText("Copia nu are nimic nou. Datele tale erau deja la zi.")).toBeVisible();

  await other.goto("/cumparaturi/");
  await expect(other.getByText("Lista de păstrat")).toBeVisible();
  await context.close();
});
