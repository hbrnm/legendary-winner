import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

// Bonul fiscal (.tasks/005, etapa 4), cu textul OCR simulat (fără motorul real).
const BON = `KAUFLAND ROMANIA SCS
1,000 BUC x 5,29
VDR.LAP.3,5%1L 5,29 C
1,014 KG x 2,29
CEAPA GALBENA KG 2,32 C
TOTAL 7,61
DATA:05/03/2026`;

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
  await expect(page.getByLabel("Data")).toHaveValue("2026-03-05");
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

test("cititorul adevărat: fotografia cu orientarea în EXIF (ca pe iPhone) se citește întoarsă corect", async ({ page }) => {
  test.setTimeout(120_000);
  // Bonul sintetic e stocat culcat, cu „rotește 90°” în EXIF, cum salvează camera telefonului.
  await start(page);
  await page.goto("/cumparaturi/bon/");
  await page.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/bon-exif-rotit.jpg");
  const img = page.getByRole("img", { name: "Fotografia bonului" });
  await expect(img).toBeVisible();
  const box = (await img.boundingBox())!;
  expect(box.width).toBeGreaterThan(box.height); // bonul sintetic e lat; stocat e înalt
  await page.getByRole("button", { name: "Citește bonul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică bonul" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Magazinul")).toHaveValue("kaufland");
  await expect(page.getByText(/pe bon: CEAPA GALBENA/)).toBeVisible();
});

test("fără bon: scrii cumpărăturile, le verifici, intră în istoric", async ({ page }) => {
  await start(page);
  await page.goto("/cumparaturi/bon/");
  await page.getByRole("button", { name: "Scrie sau dictează" }).click();
  await expect(page.getByRole("heading", { name: "Scrie cumpărăturile" })).toBeVisible();

  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Scrie" })).toHaveText("Scrie cel puțin un produs, de exemplu „pâine 5,50”.");

  await page.getByLabel("Scrie cumpărăturile").fill("ceapă galbenă 1 kg 2,32, lapte integral 2 buc 10,58");
  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page.getByRole("heading", { name: "Verifică produsele" })).toBeVisible();
  await expect(page.getByText("Am găsit 2 produse.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Suma pentru Ceapă galbenă")).toHaveValue("2,32");
  await expect(page.getByText(/ai scris: lapte integral · 2 buc/)).toBeVisible();

  // „Înapoi” păstrează textul scris.
  await page.getByRole("button", { name: "Înapoi" }).click();
  await expect(page.getByLabel("Scrie cumpărăturile")).toHaveValue(/lapte integral 2 buc 10,58/);
  await page.getByRole("button", { name: "Continuă" }).click();

  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await page.waitForURL(/\/cumparaturi\/istoric\//);
  await expect(page.getByText(/12,90/).first()).toBeVisible();
});
