import { expect, test } from "@playwright/test";
import { quickAdd, start } from "./helpers";

// Variantele comerciale (.tasks/007): „Cum verific la final”, în modul demonstrativ.
test("varianta Sissi 300 g: 21 lei → 70 lei/kg în Prețuri, iar data viitoare linia e estimată la 21 lei", async ({ page }) => {
  await start(page, "/cumparaturi/");
  await page.getByText("Cumpărături săptămânale").click();
  await quickAdd(page, "șuncă");

  await page.getByRole("button", { name: /^Șuncă/ }).click();
  await page.getByLabel("Marca și ambalajul").selectOption({ label: "+ Variantă nouă" });
  await page.getByLabel("Marca", { exact: true }).fill("Sissi");
  await page.getByLabel("Numele de pe ambalaj").fill("Șuncă de pui");
  await page.getByLabel("Cantitatea netă").fill("300");
  await page.getByRole("button", { name: "Adaugă varianta" }).click();
  await expect(page.getByText("Am adăugat varianta.")).toBeVisible();
  await expect(page.getByLabel("Marca și ambalajul")).toHaveValue(/.+/);

  await page.getByLabel("Cantitate", { exact: true }).fill("1");
  await page.getByLabel("Unitate", { exact: true }).selectOption("pachet");
  await page.getByLabel("Preț plătit").fill("21");
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByText("1 pachet · Sissi, Șuncă de pui, 300 g")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Gata", exact: true }).click();
  await page.getByRole("button", { name: "Gata, am terminat" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Șuncă/ })).toBeVisible();

  // Data viitoare, linia cu aceeași variantă e estimată la 21 lei.
  await page.getByRole("button", { name: /^Șuncă/ }).click();
  await expect(page.getByText(/Din prețuri: 21,00\sRON/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/buget/preturi/");
  const search = page.getByRole("combobox");
  await search.fill("șuncă");
  await page.getByRole("option").first().click();
  await expect(page.getByText("Prețul pe kg, pe mărci")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Sissi, Șuncă de pui, 300 g" }).first()).toContainText(/70,00\sRON\/kg/);
});
