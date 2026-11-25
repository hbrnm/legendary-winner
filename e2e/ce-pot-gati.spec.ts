import { expect, test, type Page } from "@playwright/test";
import { start } from "./helpers";

const recipe = "Omletă cu spanac și brânză feta";

async function addStock(page: Page, text: string) {
  await page.getByRole("button", { name: "Adaugă în cămară", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Adaugă în cămară" });
  const product = sheet.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await product.fill(text);
  await expect(sheet.getByRole("listbox")).toBeVisible();
  await product.press("Enter");
  await sheet.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(sheet).not.toBeVisible();
}

async function openReadyRecipes(page: Page) {
  await page.goto("/retete/");
  await page.getByRole("button", { name: "Gata de gătit", exact: true }).click();
  await page.getByRole("textbox", { name: "Caută rețete" }).fill(recipe);
}

test("Azi recomandă o singură rețetă din stoc și lasă prioritate reluării", async ({ page }) => {
  await start(page, "/camara/");
  for (const product of ["150 g ouă", "50 g spanac", "5 g ulei de măsline"]) await addStock(page, product);
  const suggestion = page.getByRole("link", { name: /^Gata de gătit/ });
  await page.goto("/");
  await expect(page.getByTestId("home-meal")).toBeVisible();
  await expect(suggestion).toHaveCount(0);

  await page.goto("/camara/");
  await addStock(page, "50 g feta");
  await page.goto("/");
  await expect(suggestion).toHaveCount(1);
  await expect(suggestion).toContainText(recipe);
  await expect(suggestion).toContainText("10 min");
  await expect.poll(() => suggestion.evaluate((link) => {
    const meal = document.querySelector('[data-testid="home-meal"]');
    return Boolean(meal && meal.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await suggestion.click();
  const cooking = page.getByRole("dialog", { name: "Mod de gătit" });
  await expect(cooking.getByRole("heading", { name: "Ingrediente" })).toBeVisible();
  await cooking.getByRole("button", { name: "Începe prepararea" }).click();
  await cooking.getByRole("button", { name: "Închide" }).click();
  await page.goto("/");
  const resume = page.getByRole("link", { name: /^Reia gătitul/ });
  await expect(resume).toContainText(recipe);
  await expect.poll(() => resume.evaluate((link) => {
    const meal = document.querySelector('[data-testid="home-meal"]');
    return Boolean(meal && meal.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING);
  })).toBe(true);
  await expect(suggestion).toHaveCount(0);
});

test("arată necesarul de feta înainte de cumpărături și pornește gătitul când stocul e complet", async ({ page }) => {
  await start(page, "/camara/");
  for (const product of ["150 g ouă", "50 g spanac", "5 g ulei de măsline"]) await addStock(page, product);
  await openReadyRecipes(page);

  const near = page.getByRole("region", { name: "Îți mai lipsesc câteva ingrediente" });
  const row = near.getByRole("listitem").filter({ hasText: recipe });
  await expect(row).toContainText("Lipsesc: Brânză feta");
  const previewButton = row.getByRole("button", { name: "Adaugă ce lipsește pe listă" });
  await previewButton.click();
  const preview = page.getByRole("dialog", { name: "Ce lipsește" });
  await expect(preview.getByRole("listitem")).toHaveCount(1);
  await expect(preview.getByRole("listitem")).toContainText(/Brânză feta.*50 g/);
  await preview.getByRole("button", { name: "Închide", exact: true }).click();
  await expect(previewButton).toBeFocused();
  await previewButton.click();
  await preview.getByRole("button", { name: "Adaugă pe listă", exact: true }).click();
  await page.getByRole("button", { name: "Vezi lista", exact: true }).click();
  const shoppingItems = page.getByRole("checkbox", { name: /^Bifează/ });
  await expect(shoppingItems).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ has: shoppingItems })).toContainText("50 g");

  await page.goto("/camara/");
  await addStock(page, "50 g feta");
  await openReadyRecipes(page);
  await expect(page.getByRole("heading", { name: "Ai toate ingredientele" })).toBeVisible();
  await expect(near).toHaveCount(0);
  const startCooking = page.getByRole("link", { name: "Începe să gătești " + recipe });
  await expect(page.getByRole("listitem").filter({ has: startCooking })).toContainText("10 min");
  await startCooking.click();
  const cooking = page.getByRole("dialog", { name: "Mod de gătit" });
  await expect(cooking.getByRole("heading", { name: "Ingrediente" })).toBeVisible();
  await expect(cooking).toContainText("1 porție");
});
