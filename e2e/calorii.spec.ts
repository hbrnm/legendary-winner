import { expect, test } from "@playwright/test";
import { start } from "./helpers";

test("jurnalul păstrează jumătatea de porție și editarea offline după reîncărcare", async ({ page, context }) => {
  await start(page, "/retete/reteta/?id=omleta-spanac-feta");
  const nutrition = page.getByRole("region", { name: "Valori nutriționale" });
  await expect(nutrition).toContainText("Valori declarate");
  await expect(nutrition).toContainText("365 kcal");
  await nutrition.getByText("Contribuția estimată pe ingredient").click();
  await expect(nutrition.getByText("Brânză feta", { exact: true })).toBeVisible();
  await nutrition.getByRole("button", { name: "Adaugă în jurnal" }).click();
  const add = page.getByRole("dialog", { name: "Adaugă în jurnal" });
  await expect(add.getByText(/acest dispozitiv/)).toBeVisible();
  await add.getByRole("button", { name: "Activează jurnalul" }).click();
  await add.getByRole("button", { name: "½", exact: true }).click();
  await expect(add.getByText("182,5 kcal", { exact: true })).toBeVisible();
  await add.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(add).toHaveCount(0);
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await expect(nutrition.getByText("Valori declarate de sursă pentru rețeta originală")).toHaveCount(0);

  await page.goto("/");
  const card = page.getByRole("button", { name: /Calorii azi/ });
  await expect(card).toContainText("182,5 kcal");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await card.click();
  const journal = page.getByRole("dialog", { name: "Jurnal calorii" });
  await journal.getByRole("button", { name: "Editează" }).click();
  const edit = page.getByRole("dialog", { name: "Editează intrarea" });
  await edit.getByLabel("Număr de porții").fill("1,5");
  await edit.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(journal.getByText("547,5 kcal", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(card).toContainText("547,5 kcal");
  await card.click();
  await journal.getByRole("button", { name: "Adaugă mâncare" }).click();
  const addFood = page.getByRole("dialog", { name: "Adaugă mâncare" });
  await addFood.getByRole("radio", { name: "Scrie manual" }).click();
  await addFood.getByLabel("Data", { exact: true }).fill("2026-03-07");
  await addFood.getByLabel("Calorii (kcal)").fill("40");
  await addFood.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(journal.getByLabel("Ziua jurnalului")).toHaveValue("2026-03-07");
  await expect(journal.getByText("40 kcal", { exact: true }).first()).toBeVisible();
  await journal.getByRole("button", { name: "Șterge", exact: true }).click();
  await page.getByRole("dialog", { name: "Ștergi intrarea?" }).getByRole("button", { name: "Șterge", exact: true }).click();
  await expect(journal.getByText("Nu ai intrări pentru ziua aleasă.")).toBeVisible();
});

async function importRecipeWithCustomProduct(page: import("@playwright/test").Page, lines: string[], productName: string) {
  await page.getByRole("radio", { name: "Text" }).click();
  await page.getByLabel("Textul rețetei").fill(lines.join("\n"));
  await page.getByRole("button", { name: "Citește rețeta" }).click();
  await page.getByLabel("Porții", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Cină", exact: true }).click();
  await page.getByRole("button", { name: "Nu e în catalog? Creează produsul" }).click();
  await page.getByLabel("Numele produsului nou").fill(productName);
  await page.getByLabel("Categoria produsului nou").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Adaugă produsul" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Salvează rețeta" }).click();
}

test("jurnalul semnalează caloriile parțiale și necunoscute", async ({ page }) => {
  await start(page, "/retete/import/");
  await importRecipeWithCustomProduct(page, [
    "Gustare parțială",
    "Ingrediente",
    "100 g ouă de găină",
    "100 g cremă de yuzu",
    "Mod de preparare",
    "1. Amestecă.",
  ], "Cremă de yuzu");

  const nutrition = page.getByRole("region", { name: "Valori nutriționale" });
  await expect(nutrition).toContainText("Calcul parțial · 1 ingredient necalculat");
  await nutrition.getByRole("button", { name: "Adaugă în jurnal" }).click();
  const add = page.getByRole("dialog", { name: "Adaugă în jurnal" });
  await add.getByRole("button", { name: "Activează jurnalul" }).click();
  await expect(add).toContainText("140 kcal · Total incomplet");
  await add.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(add).toHaveCount(0);

  await page.goto("/retete/import/");
  await importRecipeWithCustomProduct(page, [
    "Gustare fără valori",
    "Ingrediente",
    "100 g pudră de guarana",
    "Mod de preparare",
    "1. Servește.",
  ], "Pudră de guarana");

  await expect(nutrition).toContainText("Calorii necunoscute");
  await nutrition.getByRole("button", { name: "Adaugă în jurnal" }).click();
  await expect(add).toContainText("Calorii necunoscute");
  await add.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(add).toHaveCount(0);

  await page.goto("/");
  const card = page.getByRole("button", { name: /Calorii azi/ });
  await expect(card).toContainText("140 kcal · Total incomplet");
  await card.click();
  const journal = page.getByRole("dialog", { name: "Jurnal calorii" });
  const unknown = journal.getByRole("listitem").filter({ hasText: "Gustare fără valori" });
  await expect(unknown).toContainText("Calorii necunoscute");
  await unknown.getByRole("button", { name: "Editează" }).click();
  const edit = page.getByRole("dialog", { name: "Editează intrarea" });
  await edit.getByLabel("Calorii pentru intrare (opțional)").fill("100");
  await edit.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(journal).toContainText("240 kcal · Total incomplet");
});

test("eticheta produsului propriu se aplică ingredientului exact, la 100 ml", async ({ page }) => {
  await start(page, "/retete/import/");
  await importRecipeWithCustomProduct(page, [
    "Băutură pentru test",
    "Ingrediente",
    "200 ml pastă de chipotle",
    "Mod de preparare",
    "1. Amestecă bine.",
  ], "Pastă de chipotle");
  const nutrition = page.getByRole("region", { name: "Valori nutriționale" });
  await expect(nutrition).toContainText("Calorii necunoscute");
  await nutrition.getByText("Contribuția estimată pe ingredient").click();
  await nutrition.getByRole("button", { name: "Valori de pe etichetă" }).click();
  const label = page.getByRole("dialog", { name: "Valori de pe etichetă" });
  await label.getByLabel("Baza de calcul").selectOption("ml");
  await label.getByLabel("Energie (kcal)").fill("50,5");
  await label.getByLabel("Proteine (g)").fill("3");
  await label.getByLabel("Carbohidrați (g)").fill("5");
  await label.getByLabel("Grăsimi (g)").fill("2");
  await label.getByRole("button", { name: "Salvează valorile" }).click();
  await expect(nutrition).toContainText("101 kcal");
  await expect(nutrition).toContainText("Eticheta produsului");
  await page.reload();
  await expect(nutrition).toContainText("101 kcal");
});

test("jurnalul permite căutarea alimentelor, mesele, alimentele recente și obiectivul zilnic", async ({ page }) => {
  await start(page, "/");
  await page.getByRole("button", { name: "Jurnal calorii" }).click();
  await page.getByRole("dialog", { name: "Jurnal calorii" }).getByRole("button", { name: "Activează jurnalul" }).click();

  const journal = page.getByRole("dialog", { name: "Jurnal calorii" });
  await journal.getByRole("button", { name: "Setează obiectiv" }).click();
  const goalDialog = page.getByRole("dialog", { name: "Obiectiv zilnic" });
  await goalDialog.getByLabel("Calorii (kcal / zi)").fill("500");
  await goalDialog.getByLabel("Proteine (g / zi, opțional)").fill("30");
  await goalDialog.getByRole("button", { name: "Salvează obiectivul" }).click();

  await journal.getByRole("button", { name: "Adaugă mâncare" }).click();
  const add = page.getByRole("dialog", { name: "Adaugă mâncare" });
  await add.getByLabel("Caută un aliment sau o rețetă").fill("oua");
  await add.getByRole("button", { name: /^Ouă de găină/ }).first().click();
  await add.getByRole("button", { name: "2", exact: true }).click();
  await expect(add.getByText(/kcal/)).toBeVisible();
  await expect(add.getByText(/^P .* g · C .* g · G .* g$/)).toBeVisible();
  await add.getByRole("button", { name: "Salvează intrarea" }).click();

  await expect(journal.getByText(/^2 buc ·/)).toBeVisible();
  await expect(journal.getByText(/Rămase:/)).toBeVisible();
  await journal.getByRole("button", { name: "Editează" }).click();
  const edit = page.getByRole("dialog", { name: "Editează intrarea" });
  await edit.getByLabel("Unitate").selectOption("g");
  await edit.getByLabel("Cantitate").fill("100");
  await edit.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(journal.getByText(/^100 g ·/)).toBeVisible();

  await journal.getByRole("button", { name: "Adaugă mâncare" }).click();
  await expect(add.getByText("Adăugate recent")).toBeVisible();
  await add.getByLabel("Caută un aliment sau o rețetă").fill("omleta");
  await add.getByRole("button", { name: /Omletă cu spanac și brânză feta/ }).click();
  await add.getByLabel("Masă").selectOption("pranz");
  await add.getByRole("button", { name: "½", exact: true }).click();
  await add.getByRole("button", { name: "Salvează intrarea" }).click();
  await expect(journal.getByRole("region", { name: "Prânz" })).toContainText("Omletă cu spanac și brânză feta");
  await expect(journal.getByText(/^Proteine .* g · Carbohidrați .* g · Grăsimi .* g$/)).toBeVisible();

  await journal.getByRole("button", { name: "Închide" }).click();
  await expect(page.getByRole("button", { name: /Calorii azi/ })).toContainText("/ 500 kcal");
});
