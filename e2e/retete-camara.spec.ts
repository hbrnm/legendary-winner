import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("rețetă: porții, cost incomplet, alergeni, favorite, ingrediente în listă", async ({ page }) => {
  await start(page, "/retete/");
  await page.getByLabel("Caută rețete").fill("omletă cu spanac");
  await page.getByRole("link", { name: /Omletă cu spanac/ }).click();
  await expect(page.getByRole("heading", { name: /Omletă cu spanac/ })).toBeVisible();
  await expect(page.getByText(/Conține: .*lapte/)).toBeVisible();
  await expect(page.getByText("150 g", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await page.getByRole("button", { name: "Mai multe porții" }).click();
  await expect(page.getByText("600 g", { exact: true })).toBeVisible(); // 1 → 4 porții
  await expect(page.getByText(/Costul apare după ce introduci prețuri/)).toBeVisible();

  // Valorile declarate de sursă rămân afișate ca reper și când se schimbă numărul de porții.
  const nutrition = page.getByRole("region", { name: "Valori nutriționale" });
  await expect(nutrition.getByText("365 kcal")).toBeVisible();
  await expect(nutrition.getByText("Sursa declară 365 kcal pentru o porție din rețeta originală.")).toBeVisible();

  await page.getByRole("button", { name: "Adaugă la favorite" }).click();
  await expect(page.getByRole("button", { name: "Scoate de la favorite" })).toBeVisible();

  await page.getByRole("button", { name: "În listă" }).click();
  await page.getByRole("button", { name: "Adaugă pentru 4 porții" }).click();
  await page.getByRole("button", { name: "Vezi lista" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Brânză feta/ })).toBeVisible();

  await page.goto("/retete/");
  await page.getByRole("button", { name: "Filtre", exact: true }).click();
  await page.getByRole("button", { name: "Favorite", exact: true }).click();
  await expect(page.getByRole("link", { name: /Omletă cu spanac/ })).toBeVisible();
});

test("cămara: expirare, „ce pot găti”, doar ingredientele lipsă", async ({ page }) => {
  await start(page, "/camara/");
  for (const [text, expires] of [
    ["10 ouă", "2026-03-09"],
    ["500 g spanac", "2026-03-20"],
    ["20 g ulei de măsline", ""],
  ]) {
    await page.getByRole("button", { name: "Adaugă în cămară", exact: true }).click();
    const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
    await box.fill(text);
    await expect(page.getByRole("listbox")).toBeVisible();
    await box.press("Enter");
    if (expires) { await page.getByText("Detalii opționale (expirare, observații)", {exact:true}).click(); await page.getByLabel("Expiră pe").fill(expires); }
    await page.getByRole("button", { name: "Salvează" }).click();
    // Fișa se închide după salvare; abia apoi căutăm produsul următor.
    await expect(page.getByRole("button", { name: "Salvează" })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Expiră curând (1)" }).click();
  await expect(page.getByText("expiră mâine", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Scade Ouă de găină" }).click();
  await expect(page.getByText("9 buc")).toBeVisible();

  await page.goto("/retete/");
  await page.getByRole("button", { name: "Filtre", exact: true }).click();
  await page.getByRole("button", { name: "Ce pot găti", exact: true }).click();
  await page.getByLabel("Caută rețete").fill("omletă cu spanac");
  await expect(page.getByRole("link", { name: /Omletă cu spanac/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Omletă cu spanac/ })).toContainText("Îți lipsesc 2 ingrediente");
  await page.getByRole("link", { name: /Omletă cu spanac/ }).click();
  await page.getByRole("button", { name: "În listă" }).click();
  await page.getByRole("button", { name: /Adaugă pentru/ }).click();
  await page.getByRole("button", { name: "Vezi lista" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează / }).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Bifează Spanac/ })).toHaveCount(0); // îi ai deja
  await expect(page.getByRole("checkbox", { name: /Bifează Ulei de măsline/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Bifează Brânză feta/ })).toBeVisible();

  // Confirmarea de gătit folosește porțiile alese și scade stocul disponibil.
  await page.goto("/retete/reteta/?id=omleta-spanac-feta");
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  const cook = page.getByRole("dialog", { name: "Ai gătit rețeta?" });
  await expect(cook).toContainText(/pentru 1 porți/);
  await cook.getByRole("button", { name: "Mai multe porții gătite" }).click();
  await expect(cook).toContainText("pentru 2 porții");
  await cook.getByRole("button", { name: "Am gătit", exact: true }).click();
  await expect(cook).not.toBeVisible();
  await page.goto("/camara/");
  const search = page.getByRole("searchbox", { name: "Caută în cămară" });
  await search.fill("Spanac");
  await expect(page.getByRole("listitem").filter({ hasText: "Spanac" })).toContainText("400 g");
  await search.fill("Ulei de măsline");
  await expect(page.getByRole("listitem").filter({ hasText: "Ulei de măsline" })).toContainText("10 g");
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

  // Lista comparată pe magazine, doar cu prețurile fiecăruia.
  await createList(page, "Comparație");
  await quickAdd(page, "2 kg roșii");
  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Unde iese mai ieftin" }).click();
  await expect(page.getByRole("heading", { name: "Cât ar costa lista" })).toBeVisible();
  const rows = page.locator("li").filter({ hasText: "preț aici" });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Piața Obor");
  await expect(rows.nth(0)).toContainText("~16,00 RON");
  await expect(rows.nth(1)).toContainText("Lidl");
  await expect(rows.nth(1)).toContainText("~24,00 RON");
});

test("prima pagină: o sugestie de cel mult 30 minute, cu alegerea mesei", async ({ page }) => {
  await start(page);
  await expect(page.getByRole("heading", { name: "Azi la masă" })).toBeVisible();
  const recipes = page.locator('main a[href*="/retete/reteta"]');
  await expect(recipes).toHaveCount(1);
  for (const recipe of await recipes.all()) {
    const minutes = (await recipe.innerText()).match(/(\d+) min/);
    expect(minutes).not.toBeNull();
    expect(Number(minutes![1])).toBeGreaterThan(0);
    expect(Number(minutes![1])).toBeLessThanOrEqual(30);
  }
  await expect(page.getByRole("button", { name: "Adaugă în plan", exact: true })).toHaveCount(1);
});

test("Prețuri: un produs care nu e în catalog primește un mesaj, nu „ca produs nou”", async ({ page }) => {
  await start(page, "/buget/preturi/");
  const box = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await box.fill("zzqx produs inexistent");
  await expect(page.getByRole("status").filter({ hasText: "Nu am găsit „zzqx produs inexistent” în catalog." })).toBeVisible();
  await expect(page.getByText("ca produs nou")).toHaveCount(0);
  await box.press("Enter");
  await expect(box).toHaveValue("zzqx produs inexistent");
});
