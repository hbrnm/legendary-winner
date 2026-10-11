import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("lista: adăugare rapidă, cantități, preț, total, sursă piață", async ({ page }) => {
  await start(page);
  await createList(page, "Piața de sâmbătă");
  await quickAdd(page, "2 kg roșii");
  await quickAdd(page, "lapte 2 l");
  await quickAdd(page, "pâine");
  await quickAdd(page, "Cozonacul bunicii");
  await quickAdd(page, "1 kg roșii"); // același produs: se adună

  await expect(page.getByText("3 kg")).toBeVisible();
  await expect(page.getByText("Cozonacul bunicii")).toBeVisible(); // produs personalizat

  // Prețul la piață.
  await page.getByRole("button", { name: /^Roșii/ }).click();
  await page.getByRole("radio", { name: "Piață" }).click();
  await page.getByLabel("Preț plătit").fill("15");
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByText("15,00 RON").first()).toBeVisible();
  await expect(page.getByText("Piață", { exact: false }).first()).toBeVisible();

  // Gruparea pe magazine.
  await page.getByRole("radio", { name: "Pe magazine" }).click();
  await expect(page.getByRole("heading", { name: "Piață" })).toBeVisible();

  // Bifare și debifare.
  await page.getByRole("checkbox", { name: /Bifează Pâine albă/ }).click();
  await expect(page.getByText(/2 din 4 luate/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Debifează Pâine albă/ }).click();
  await expect(page.getByText(/1 din 4 luate/)).toBeVisible();
});

test("lista: duplicare, arhivare, ștergere cu anulare", async ({ page }) => {
  await start(page);
  await createList(page, "Weekend");
  await quickAdd(page, "6 bere");
  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Duplică lista" }).click();
  await expect(page.getByRole("heading", { name: "Weekend (copie)" })).toBeVisible();
  await expect(page.getByText("Bere", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: /^Bere/ }).click();
  await page.getByRole("button", { name: "Șterge din listă" }).click();
  await expect(page.getByText("Lista e goală")).toBeVisible();
  await page.getByRole("button", { name: "Anulează" }).click();
  await expect(page.getByText("Lista e goală")).toHaveCount(0);

  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Arhivează" }).click();
  // Așteptăm salvarea înainte de navigare, altfel ea se poate pierde pe o mașină lentă.
  await expect(page.getByText("Lista a fost arhivată.")).toBeVisible();
  await page.goto("/cumparaturi/");
  await page.getByRole("button", { name: /Arată \(1\)/ }).click();
  await expect(page.getByText("Weekend (copie)")).toBeVisible();
});

test("lista recurentă rămâne pentru data viitoare", async ({ page }) => {
  await start(page, "/cumparaturi/");
  await page.getByText("Cumpărături săptămânale").click();
  await quickAdd(page, "detergent vase");
  await page.getByRole("checkbox", { name: /Bifează Detergent de vase/ }).click();
  await page.getByRole("button", { name: "Gata", exact: true }).click();
  await page.getByRole("button", { name: "Finalizează" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Detergent de vase/ })).toBeVisible();
});
