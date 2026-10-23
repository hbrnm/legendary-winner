import { expect, test } from "@playwright/test";
import { createList, openBasket, quickAdd, start } from "./helpers";

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
  // Așteptăm un produs din catalog: până se încarcă, singura opțiune e „ca produs nou”.
  await page.getByRole("dialog").getByRole("option").filter({ hasNotText: "ca produs nou" }).first().click();
  await expect(lapte).toContainText("Lapte integral");
  await expect(page.getByText("Suma produselor")).toBeVisible();

  await page.getByRole("button", { name: "Salvează bonul" }).click();
  await page.waitForURL(/\/cumparaturi\/lista\//);
  await openBasket(page);
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
  // În istoric, linia are numele de pe bon, cu produsul din catalog dedesubt (.tasks/016).
  await page.getByRole("button", { name: /7,61/ }).first().click();
  await expect(page.getByRole("listitem").filter({ hasText: "VDR.LAP.3,5%1L" })).toContainText("Lapte integral ·");
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

  await page.getByLabel("Scrie cumpărăturile").fill("ceapă galbenă 1 kg 2,32, lapte integral 2 buc 10,58, unt de arahide 24,99");
  await page.getByRole("button", { name: "Continuă" }).click();
  await expect(page.getByRole("heading", { name: "Verifică produsele" })).toBeVisible();
  await expect(page.getByText("Am găsit 3 produse.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Suma pentru Ceapă galbenă")).toHaveValue("2,32");
  await expect(page.getByText(/ai scris: lapte integral · 2 buc/)).toBeVisible();

  // „Înapoi” păstrează textul scris.
  await page.getByRole("button", { name: "Înapoi" }).click();
  await expect(page.getByLabel("Scrie cumpărăturile")).toHaveValue(/lapte integral 2 buc 10,58/);
  await page.getByRole("button", { name: "Continuă" }).click();

  // Ce nu e în catalog devine produs nou, cu numele pe care îl corectez.
  const unt = page.getByRole("listitem").filter({ hasText: "ai scris: unt de arahide" });
  await expect(unt.getByText("produs nou")).toBeVisible();
  await unt.getByLabel("Numele în catalog").fill("Unt de arahide");
  // Categoria e propusă după catalog (.tasks/016); o las în „Diverse”, ca s-o mut din Buget.
  await expect(unt.getByLabel("Categoria")).toHaveValue("lactate");
  await unt.getByLabel("Categoria").selectOption("diverse");

  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  // Fără listă, alimentele intră și în cămară (setarea „întreabă”, comutatorul pornit; .tasks/016).
  await expect(page.getByText("Am pus cumpărăturile. Am adăugat un produs nou în catalog. 2 produse au intrat în cămară.")).toBeVisible();
  await page.waitForURL(/\/cumparaturi\/istoric\//);
  await expect(page.getByText(/37,89/).first()).toBeVisible();

  await page.goto("/buget/");
  await page.getByRole("link", { name: "Mută din Diverse (1)" }).click();
  await expect(page.getByRole("heading", { name: "Produse din Diverse" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Unt de arahide" }).getByLabel("Categoria").selectOption("dulciuri-gustari");
  await expect(page.getByText("Am mutat „Unt de arahide” la Dulciuri și gustări.")).toBeVisible();
  await expect(page.getByText("Nu mai ai nimic în Diverse.")).toBeVisible();

  // În cămară, produsul venit din cumpărături are ziua de „consumat”.
  await page.goto("/camara/");
  await page.getByRole("button", { name: /Ceapă galbenă/ }).first().click();
  await expect(page.getByLabel("Consumat până pe")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
});

test("bonul lung: „Citește bonul” rămâne deasupra meniului de jos", async ({ page }) => {
  await start(page, "/cumparaturi/bon/");
  await page.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/bon-lung-600x1800.jpg");
  const read = page.getByRole("button", { name: "Citește bonul" });
  await expect(read).toBeVisible();
  // Fără derulare: butonul e în ecran și nu stă sub meniu.
  const button = (await read.boundingBox())!;
  const nav = (await page.getByRole("navigation", { name: "Navigare principală" }).last().boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(nav.y);
  expect(button.y).toBeGreaterThanOrEqual(0);
});

test("pe bon, fereastra „Alege produsul” arată rezultatele pe ecran și poate face din rând un produs nou", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await start(page);
  await page.goto("/cumparaturi/bon/");
  await page.getByRole("button", { name: "Scrie sau dictează" }).click();
  await page.getByLabel("Scrie cumpărăturile").fill("ceapă galbenă 1 kg 2,32, lapte integral 2 buc 10,58");
  await page.getByRole("button", { name: "Continuă" }).click();
  const lapte = page.getByRole("listitem").filter({ hasText: "ai scris: lapte integral" });
  await lapte.getByRole("button", { name: "Alt produs" }).click();

  const dialog = page.getByRole("dialog", { name: "Alege produsul" });
  await dialog.getByRole("combobox").fill("iaurt");
  // Rezultatele apar cât tastezi, în fereastră, nu tăiate sub ea.
  await expect(dialog.getByRole("option").filter({ hasNotText: "ca produs nou" }).first()).toBeInViewport();

  await dialog.getByRole("combobox").fill("smântână de casă");
  const nou = dialog.getByRole("option", { name: "Adaugă „smântână de casă” ca produs nou" });
  await expect(nou).toBeInViewport();
  await nou.click();
  await expect(dialog).toBeHidden();
  const rand = page.getByRole("listitem").filter({ hasText: "ai scris: lapte integral" });
  await expect(rand.getByText("produs nou")).toBeVisible();
  await expect(rand.getByLabel("Numele în catalog")).toHaveValue("smântână de casă");
});
