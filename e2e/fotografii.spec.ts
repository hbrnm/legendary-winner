import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { start } from "./helpers";

// Fotografia gospodăriei la o rețetă (.tasks/008, etapa 5), în modul
// demonstrativ: poza rămâne pe telefon, fără Storage.
const JPEG = readFileSync("e2e/fixtures/ciorba-1600x1200.jpg");

test("fotografia ta: adaugi, se micșorează, apare în listă, rămâne după reîncărcare, o ștergi", async ({ page }) => {
  await start(page, "/retete/reteta/?id=ciorba-de-perisoare");
  const big = page.locator("main img").first();
  await expect(big).toHaveAttribute("src", "/retete/ciorba-de-perisoare.webp");
  await expect(page.getByText(/^Foto: .+ \/ Wikimedia Commons/)).toBeVisible();

  // O poză care nu se poate citi.
  await page.getByTestId("fotografie-fisier").setInputFiles({ name: "nu-e-poza.jpg", mimeType: "image/jpeg", buffer: Buffer.from("nu e o poză") });
  await expect(page.getByText("Nu am putut folosi această fotografie. Încearcă alta.")).toBeVisible();

  await page.getByTestId("fotografie-fisier").setInputFiles({ name: "ciorba.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.getByText("Am pus fotografia.")).toBeVisible();
  await expect(big).toHaveAttribute("src", /^blob:/);
  // Latura mare max. 1280 px.
  await expect.poll(() => big.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1280, 960]);
  await expect(page.getByText(/^Foto: /)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Schimbă fotografia" })).toBeVisible();
  // În modul demonstrativ nu e nimic de urcat.
  await expect(page.getByText(/Se încarcă/)).toHaveCount(0);

  await page.reload();
  await expect(big).toHaveAttribute("src", /^blob:/);

  await page.goto("/retete/");
  await page.getByLabel("Caută rețete").fill("perisoare");
  await expect(page.getByRole("link", { name: /Ciorbă de perișoare/ }).locator("img")).toHaveAttribute("src", /^blob:/);

  await page.goto("/retete/reteta/?id=ciorba-de-perisoare");
  await page.getByRole("button", { name: "Șterge fotografia" }).click();
  await expect(page.getByText("Fotografia dispare de pe telefoanele tuturor membrilor.")).toBeVisible();
  await page.getByRole("button", { name: "Șterge", exact: true }).click();
  await expect(big).toHaveAttribute("src", "/retete/ciorba-de-perisoare.webp");
  await expect(page.getByRole("button", { name: "Adaugă fotografia ta" })).toBeVisible();
});
