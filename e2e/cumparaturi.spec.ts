import { expect, test } from "@playwright/test";
import { createList, openBasket, quickAdd, start } from "./helpers";

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
  // Cu prețul plătit, roșiile s-au bifat singure și au coborât în „În coș”.
  await openBasket(page);
  await expect(page.getByRole("region", { name: "În coș" }).getByText("Piață", { exact: false })).toBeVisible();

  // Gruparea pe magazine, pentru ce mai e de luat.
  await page.getByRole("radio", { name: "Pe magazine" }).click();
  await expect(page.getByRole("heading", { name: "Oriunde" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Piață" })).toHaveCount(0);

  // Bifare și debifare.
  await page.getByRole("checkbox", { name: /Bifează Pâine albă/ }).click();
  await expect(page.getByText(/2 din 4 în coș/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Debifează Pâine albă/ }).click();
  await expect(page.getByText(/1 din 4 în coș/)).toBeVisible();
});

test("lista: duplicare, arhivare, ștergere cu anulare", async ({ page }) => {
  await start(page);
  await createList(page, "Weekend");
  await quickAdd(page, "6 bere");
  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Fă o copie" }).click();
  await expect(page.getByRole("heading", { name: "Weekend (copie)" })).toBeVisible();
  await expect(page.getByText("Bere", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: /^Bere/ }).click();
  await page.getByRole("button", { name: "Șterge din listă" }).click();
  await expect(page.getByText("Foaia e albă")).toBeVisible();
  await page.getByRole("button", { name: "Anulează" }).click();
  await expect(page.getByText("Foaia e albă")).toHaveCount(0);

  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Pune deoparte" }).click();
  // Așteptăm salvarea înainte de navigare, altfel ea se poate pierde pe o mașină lentă.
  await expect(page.getByText("Am pus-o deoparte.")).toBeVisible();
  await page.goto("/cumparaturi/");
  await page.getByRole("button", { name: /Arată-le \(1\)/ }).click();
  await expect(page.getByText("Weekend (copie)")).toBeVisible();
});

test("lista recurentă rămâne pentru data viitoare", async ({ page }) => {
  await start(page, "/cumparaturi/");
  await page.getByText("Cumpărături săptămânale").click();
  await quickAdd(page, "detergent vase");
  await page.getByRole("checkbox", { name: /Bifează Detergent de vase/ }).click();
  await page.getByRole("button", { name: "Gata", exact: true }).click();
  await page.getByRole("button", { name: "Gata, am terminat" }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Detergent de vase/ })).toBeVisible();
});

test("prețul de la raft: 300 g la 7,99 lei/100 g, apoi 312 g la cântar", async ({ page }) => {
  await start(page);
  await createList(page, "Galantar");
  await quickAdd(page, "300 g șuncă");
  await page.getByRole("button", { name: /^Șuncă/ }).click();
  await page.getByRole("radio", { name: "Preț la raft" }).click();
  await expect(page.getByLabel("Baza prețului la raft")).toHaveValue("100g");
  await page.getByLabel("Preț la raft").fill("7,99");
  await expect(page.getByLabel("Preț plătit")).toHaveValue("23,97");
  await expect(page.getByText("Calculat: 300 g × 7,99 lei/100 g. Îl poți corecta.")).toBeVisible();

  // La cântar iese altă cantitate: totalul se recalculează.
  await page.getByLabel("Cantitate").fill("312");
  await expect(page.getByLabel("Preț plătit")).toHaveValue("24,93");

  // O bază care nu se potrivește cu cantitatea.
  await page.getByLabel("Unitate").selectOption("buc");
  await page.getByLabel("Baza prețului la raft").selectOption("kg");
  await expect(page.getByText("Prețul pe kg nu se potrivește cu bucățile. Alege altă bază sau scrie totalul.")).toBeVisible();
  await expect(page.getByLabel("Preț plătit")).toHaveValue("");
  await page.getByLabel("Unitate").selectOption("g");
  await page.getByLabel("Baza prețului la raft").selectOption("100g");
  await expect(page.getByLabel("Preț plătit")).toHaveValue("24,93");

  // Înapoi la total și iar la raft: totalul se calculează din nou.
  await page.getByRole("radio", { name: "Total plătit" }).click();
  await page.getByLabel("Preț plătit").fill("30");
  await page.getByRole("radio", { name: "Preț la raft" }).click();
  await expect(page.getByLabel("Preț plătit")).toHaveValue("24,93");

  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByText("24,93 RON").first()).toBeVisible();
});

test("„În coș”: bifatele coboară strânse, „Ai tot!” la final, „Anulează” după ștergere", async ({ page }) => {
  await start(page);
  await createList(page, "Seara");
  await quickAdd(page, "pâine");
  await quickAdd(page, "lapte");

  await page.getByRole("checkbox", { name: /Bifează Pâine albă/ }).click();
  const basket = page.getByRole("button", { name: "În coș (1)" });
  await expect(basket).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("checkbox", { name: /Debifează Pâine albă/ })).toHaveCount(0);
  await expect(page.getByText("Ai tot!", { exact: false })).toHaveCount(0);

  await page.getByRole("checkbox", { name: /Bifează Lapte/ }).click();
  await expect(page.getByText("Ai tot! Apasă „Gata” la casă.")).toBeVisible();
  await page.getByRole("button", { name: "În coș (2)" }).click();
  await page.getByRole("checkbox", { name: /Debifează Pâine albă/ }).click();
  await expect(page.getByRole("checkbox", { name: /Bifează Pâine albă/ })).toBeVisible();
  await expect(page.getByText("Ai tot!", { exact: false })).toHaveCount(0);

  await page.getByRole("button", { name: "Opțiunile listei" }).click();
  await page.getByRole("button", { name: "Șterge lista" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Șterge", exact: true }).click();
  await page.waitForURL(/\/cumparaturi\/$/);
  await expect(page.getByText("Seara")).toHaveCount(0);
  await page.getByRole("status").getByRole("button", { name: "Anulează" }).click();
  await expect(page.getByText("Seara")).toBeVisible();
});
