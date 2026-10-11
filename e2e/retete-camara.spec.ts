import { expect, test } from "@playwright/test";
import { start } from "./helpers";

test("rețetă: porții, cost incomplet, alergeni, favorite, ingrediente în listă", async ({ page }) => {
  await start(page, "/retete/");
  await page.getByLabel("Caută rețete").fill("papanasi");
  await page.getByRole("link", { name: /Papanași/ }).click();
  await expect(page.getByRole("heading", { name: /Papanași/ })).toBeVisible();
  await expect(page.getByText(/Conține: .*gluten/)).toBeVisible();
  await expect(page.getByText("500 g")).toBeVisible();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await expect(page.getByText("750 g")).toBeVisible(); // 6 → 9 porții
  await expect(page.getByText(/Costul apare după ce introduci prețuri/)).toBeVisible();

  await page.getByRole("button", { name: "Adaugă la favorite" }).click();
  await expect(page.getByRole("button", { name: "Scoate de la favorite" })).toBeVisible();

  await page.getByRole("button", { name: "În listă" }).click();
  await page.getByRole("button", { name: "Adaugă pentru 9 porții" }).click();
  await page.getByRole("button", { name: "Vezi lista" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Brânză de vaci/ })).toBeVisible();

  await page.goto("/retete/");
  await page.getByRole("radio", { name: "Favorite" }).click();
  await expect(page.getByRole("link", { name: /Papanași/ })).toBeVisible();
});

test("cămara: expirare, „ce pot găti”, doar ingredientele lipsă", async ({ page }) => {
  await start(page, "/camara/");
  for (const [text, expires] of [
    ["10 ouă", "2026-03-09"],
    ["1 kg dovlecei", "2026-03-20"],
    ["500 g făină albă", ""],
  ]) {
    const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
    await box.fill(text);
    await expect(page.getByRole("listbox")).toBeVisible();
    await box.press("Enter");
    if (expires) await page.getByLabel("Expiră pe").fill(expires);
    await page.getByRole("button", { name: "Salvează" }).click();
  }
  await expect(page.getByText("Un produs expiră curând")).toBeVisible();
  await expect(page.getByText("expiră mâine")).toBeVisible();

  await page.getByRole("button", { name: "Scade Ouă de găină" }).click();
  await expect(page.getByText("9 buc")).toBeVisible();

  await page.goto("/retete/");
  await page.getByRole("radio", { name: "Ce pot găti?" }).click();
  await expect(page.getByRole("link", { name: /Dovlecei pane/ })).toBeVisible();
  await expect(page.getByText("Îți lipsesc 2 ingrediente")).toBeVisible();
  await page.getByRole("link", { name: /Dovlecei pane/ }).click();
  await page.getByRole("button", { name: "În listă" }).click();
  await page.getByRole("button", { name: /Adaugă pentru/ }).click();
  await page.getByRole("button", { name: "Vezi lista" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează / }).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Bifează Dovlecei/ })).toHaveCount(0); // îi ai deja
  await expect(page.getByRole("checkbox", { name: /Bifează Ouă de găină/ })).toHaveCount(0);
});

test("prețuri de la piață și comparație", async ({ page }) => {
  await start(page, "/buget/preturi/");
  const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await box.fill("rosii");
  await expect(page.getByRole("listbox")).toBeVisible();
  await box.press("Enter");
  await page.getByRole("button", { name: "Preț", exact: true }).click();
  await page.getByLabel("Prețul (lei)").fill("8");
  await expect(page.getByRole("radio", { name: "Piață" })).toBeChecked(); // roșiile se cumpără des la piață
  await page.getByLabel("Piața").selectOption("_nou");
  await page.getByLabel("Numele").fill("Piața Obor");
  await page.getByRole("button", { name: "Salvează prețul" }).click();

  await page.getByRole("button", { name: "Preț", exact: true }).click();
  await page.getByLabel("Prețul (lei)").fill("6");
  await page.getByLabel("pentru", { exact: true }).fill("0,5");
  await page.getByRole("radio", { name: "Supermarket" }).click();
  await page.getByLabel("Magazinul").selectOption({ label: "Lidl" });
  await page.getByRole("button", { name: "Salvează prețul" }).click();

  await expect(page.getByText("Piața Obor").first()).toBeVisible();
  await expect(page.getByText("8,00 RON/kg")).toBeVisible();
  await expect(page.getByText("12,00 RON/kg")).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Piața Obor" }).getByText("cel mai bun")).toBeVisible();
});
