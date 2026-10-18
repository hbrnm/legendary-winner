import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

// Bonul fiscal (.tasks/005, etapa 4), cu textul OCR simulat (fără motorul real).
const BON = `KAUFLAND ROMANIA SCS
1,000 BUC x 5,29
VDR.LAP.3,5%1L 5,29 C
1,014 KG x 2,29
CEAPA GALBENA KG 2,32 C
TOTAL 7,61
DATA:12/10/2026`;

test("bonul pe o listă: propune, confirmi, bifează cu prețul; al doilea bon știe singur", async ({ page }) => {
  await page.addInitScript((text) => ((globalThis as { __camaraOcrText?: string }).__camaraOcrText = text), BON);
  await start(page);
  await createList(page, "Săptămâna");
  await quickAdd(page, "1 kg ceapă galbenă");

  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Adaugă bon" }).click();
  await page.waitForURL(/\/cumparaturi\/bon\//);
  await page.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/ciorba-1600x1200.jpg");
  await page.getByRole("button", { name: "Citește bonul" }).click();

  await expect(page.getByRole("heading", { name: "Verifică bonul" })).toBeVisible();
  await expect(page.getByLabel("Magazinul")).toHaveValue("kaufland");
  await expect(page.getByLabel("Data")).toHaveValue("2026-10-12");
  await expect(page.getByText(/pe bon: CEAPA GALBENA/)).toBeVisible();
  await expect(page.getByText(/Ceapă galbenă/).first()).toBeVisible();

  // Laptele nu se recunoaște din „VDR.LAP”: îl aleg eu.
  const lapte = page.getByRole("listitem").filter({ hasText: "pe bon: VDR.LAP.3,5%1L" });
  await lapte.getByRole("button", { name: /Alege produsul|Alt produs/ }).click();
  const box = page.getByRole("dialog").getByRole("combobox");
  await box.fill("lapte integral");
  await page.getByRole("dialog").getByRole("option").first().click();
  await expect(lapte).toContainText("Lapte integral");
  await expect(page.getByText("Suma produselor")).toBeVisible();

  await page.getByRole("button", { name: "Salvează bonul" }).click();
  await page.waitForURL(/\/cumparaturi\/lista\//);
  await expect(page.getByRole("checkbox", { name: /Debifează Ceapă galbenă/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Debifează Lapte integral/ })).toBeVisible();
  await expect(page.getByText("2,32 RON").first()).toBeVisible();

  // Al doilea bon de la același magazin: laptele e propus din ce a învățat.
  await page.goto("/cumparaturi/bon/");
  await page.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/ciorba-1600x1200.jpg");
  await page.getByRole("button", { name: "Citește bonul" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "pe bon: VDR.LAP.3,5%1L" })).toContainText("Lapte integral");
  await page.getByRole("button", { name: "Salvează bonul" }).click();
  await page.waitForURL(/\/cumparaturi\/istoric\//);
  await expect(page.getByText(/7,61/).first()).toBeVisible();
});
