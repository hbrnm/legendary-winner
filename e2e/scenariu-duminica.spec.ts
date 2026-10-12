import { expect, test } from "@playwright/test";
import { start } from "./helpers";

// Experiența centrală: plan → listă consolidată → cumpărături cu prețuri reale → buget → istoric.
test("de la planul săptămânii la buget", async ({ page }) => {
  await start(page, "/buget/");

  // Bugetul lunii.
  await page.getByRole("button", { name: "Setează bugetul lunar" }).click();
  await page.getByLabel("Suma (lei)").fill("2000");
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByText("Mai ai 2.000,00 RON.")).toBeVisible();

  // Două rețete cu piept de pui în plan.
  for (const [name, day] of [
    ["Ciorbă de pui a la grec", "luni"],
    ["Ciulama de pui cu ciuperci", "marți"],
  ] as const) {
    await page.goto("/plan/");
    await page.getByRole("button", { name: "Săptămâna viitoare" }).click();
    const dayCard = page.getByRole("region", { name: new RegExp(`^${day}`) });
    await dayCard.getByRole("button", { name: /Adaugă la Prânz/ }).click();
    await page.getByLabel("Caută rețeta").fill(name.split(" ").slice(0, 3).join(" "));
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
    await expect(dayCard.getByText(name)).toBeVisible();
  }

  await page.getByRole("button", { name: "Generează lista de cumpărături" }).click();
  await page.getByRole("button", { name: "Generează lista", exact: true }).click();
  await page.waitForURL(/\/cumparaturi\/lista\//);

  // Ingredientele comune apar o singură dată.
  await expect(page.getByRole("checkbox", { name: /Bifează Ceapă galbenă/ })).toHaveCount(1);
  await expect(page.getByText("Morcovi", { exact: true })).toHaveCount(1);

  // În magazin: bifează și introduce prețul real.
  await page.getByRole("button", { name: "Prețul pentru Ceapă galbenă" }).click();
  await page.getByLabel("Preț plătit").fill("4,50");
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByRole("checkbox", { name: /Debifează Ceapă galbenă/ })).toBeVisible();
  await expect(page.getByText("4,50 RON").first()).toBeVisible();
  await expect(page.getByText(/Rămân .* din buget/)).toBeVisible();

  await page.getByRole("checkbox", { name: /Bifează Morcovi/ }).click();
  await page.getByRole("button", { name: "Gata", exact: true }).click();
  await expect(page.getByText("produs bifat nu are preț")).toBeVisible();
  await page.getByRole("button", { name: "Finalizează" }).click();
  await page.waitForURL(/\/cumparaturi\/$/);

  // Bugetul reflectă cheltuiala reală, o singură dată.
  await page.goto("/buget/");
  await expect(page.getByText("Mai ai 1.995,50 RON.")).toBeVisible();
  await expect(page.getByText("Un produs cumpărat nu are preț")).toBeVisible();

  // Istoricul păstrează cumpărătura; prețul lipsă se poate completa.
  await page.goto("/cumparaturi/istoric/");
  await page.getByRole("button", { name: /Săptămâna/ }).click();
  // Câmpul sumei are lățime fixă, ca numele produsului să încapă pe rând alături (pe telefon, la 412 px).
  const box = await page.getByLabel("Suma pentru Morcovi").boundingBox();
  expect(box!.width).toBeLessThan(150);
  await page.getByLabel("Suma pentru Morcovi").fill("3");
  await page.getByLabel("Suma pentru Morcovi").blur();
  await expect(page.getByText("7,50 RON").last()).toBeVisible();
});
