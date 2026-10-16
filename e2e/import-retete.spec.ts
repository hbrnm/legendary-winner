import { expect, test } from "@playwright/test";
import { start } from "./helpers";

// Importul rețetelor (.tasks/009, etapa 3), în modul demonstrativ: fără server,
// deci linkul cere cont, iar textul lipit se citește în telefon.

const TEXT = `Ciorbă rapidă de legume
Bună și ieftină, gata într-o oră.
Ingrediente
2 morcovi
1 ceapă
1 lingură pastă de chipotle
sare după gust
Mod de preparare
1. Taie legumele mărunt.
2. Fierbe totul 30 de minute.`;

test("import din text: ciorna, ingredientul de ales, produsul nou, salvarea", async ({ page }) => {
  await start(page, "/retete/");
  await page.getByRole("link", { name: "Importă" }).click();
  await expect(page.getByRole("heading", { name: "Importă rețetă" })).toBeVisible();

  // Fără cont, linkul nu se poate citi.
  await expect(page.getByText(/Importul din link merge când ești conectat cu cont/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Citește rețeta" })).toBeDisabled();

  await page.getByRole("radio", { name: "Text" }).click();
  await page.getByLabel("Textul rețetei").fill(TEXT);
  await page.getByRole("button", { name: "Citește rețeta" }).click();

  await expect(page.getByRole("heading", { name: "Verifică rețeta" })).toBeVisible();
  await expect(page.getByLabel("Numele rețetei")).toHaveValue("Ciorbă rapidă de legume");
  await expect(page.getByText("din rețetă: 2 morcovi")).toBeVisible();
  await expect(page.getByLabel("Pasul 2", { exact: true })).toHaveValue("Fierbe totul 30 de minute.");
  await expect(page.getByRole("status")).toHaveText("Un ingredient nu are încă produsul ales.");

  // Nu se salvează cu un ingredient fără produs.
  await page.getByRole("button", { name: "Cină" }).click();
  await page.getByRole("button", { name: "Salvează rețeta" }).click();
  await expect(page.getByText("Alege produsul pentru fiecare ingredient sau scoate-l din rețetă.")).toBeVisible();

  // Produs nou al gospodăriei, din rândul de ales.
  await page.getByRole("button", { name: "Nu e în catalog? Creează produsul" }).click();
  await expect(page.getByLabel("Numele produsului nou")).toHaveValue("pastă de chipotle");
  await page.getByLabel("Numele produsului nou").fill("Pastă de chipotle");
  await page.getByLabel("Categoria produsului nou").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Adaugă produsul" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("din rețetă: 1 lingură pastă de chipotle")).toBeVisible();

  await page.getByRole("button", { name: "Salvează rețeta" }).click();
  await expect(page.getByRole("heading", { name: "Ciorbă rapidă de legume" })).toBeVisible();
  await expect(page.getByText("Pastă de chipotle")).toBeVisible();
  await expect(page.getByText("Fierbe totul 30 de minute.")).toBeVisible();
});

test("partajare (Android): textul ajunge la „Text”; linkul, fără cont, rămâne în câmp", async ({ page }) => {
  await start(page, `/retete/import/?title=${encodeURIComponent("Ciorbă rapidă de legume")}&text=${encodeURIComponent(TEXT.split("\n").slice(1).join("\n"))}`);
  await expect(page.getByRole("radio", { name: "Text" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Textul rețetei")).toHaveValue(TEXT);
  await expect(page).toHaveURL(/\/retete\/import\/$/);
  await page.getByRole("button", { name: "Citește rețeta" }).click();
  await expect(page.getByLabel("Numele rețetei")).toHaveValue("Ciorbă rapidă de legume");

  await page.goto(`/retete/import/?text=${encodeURIComponent("Ciorbă de perișoare https://exemplu.ro/ciorba")}&title=${encodeURIComponent("Ciorbă de perișoare")}`);
  await expect(page.getByLabel("Linkul rețetei")).toHaveValue("https://exemplu.ro/ciorba");
  await expect(page.getByText(/Importul din link merge când ești conectat cu cont/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Importă rețetă" })).toBeVisible();
});

test("după autentificare se revine doar la o pagină a aplicației (cu parametri), nu la alt site", async ({ page }) => {
  await start(page, `/autentificare/?inapoi=${encodeURIComponent("//exemplu.invalid/capcana")}`);
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/$/);
  await page.goto(`/autentificare/?inapoi=${encodeURIComponent("/retete/import/?text=1 kg carne")}`);
  await expect(page.getByLabel("Textul rețetei")).toHaveValue("1 kg carne");
});
