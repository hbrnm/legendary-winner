import { expect, test } from "@playwright/test";
import { quickAdd, signUp, syncNow } from "./helpers";

// Variantele comerciale (.tasks/007) prin Supabase-ul local: varianta și linia
// cu ea ajung la celălalt membru, iar prețul plătit intră pe variantă.
test("varianta pusă de un membru ajunge la celălalt, cu prețul pe kg", async ({ browser }) => {
  const dana = await signUp(browser, "Dana");
  await dana.waitForURL(/gospodarie/);
  await dana.getByLabel("Numele gospodăriei").fill("Familia Dobre");
  await dana.getByRole("button", { name: "Creează gospodăria" }).click();
  await expect(dana.getByText("Familia Dobre").first()).toBeVisible();
  await dana.getByRole("button", { name: "Invită pe cineva" }).click();
  await dana.getByRole("button", { name: "Creează linkul de invitație" }).click();
  const link = new URL((await dana.locator("p.font-mono").textContent())!.trim());
  await dana.keyboard.press("Escape");

  const emil = await signUp(browser, "Emil", link.pathname + link.search);
  await emil.waitForURL(/invitatie/);
  await emil.getByRole("button", { name: "Accept invitația" }).click();
  await emil.waitForURL((u) => u.pathname === "/");

  // Dana: listă, linia de șuncă, varianta nouă și prețul.
  await dana.goto("/cumparaturi/");
  await dana.getByRole("button", { name: "Listă nouă" }).click();
  await dana.getByLabel("Numele listei").fill("Mezeluri");
  await dana.getByRole("button", { name: "Creează lista" }).click();
  await dana.waitForURL(/lista/);
  // Ecranul variantelor apare după ce serverul a confirmat tabelul (prima sincronizare).
  await syncNow(dana);
  await quickAdd(dana, "șuncă", "Șuncă");
  await dana.getByRole("button", { name: /^Șuncă/ }).click();
  await dana.getByLabel("Marca și ambalajul").selectOption({ label: "+ Variantă nouă" });
  await dana.getByLabel("Marca", { exact: true }).fill("Sissi");
  await dana.getByLabel("Numele de pe ambalaj").fill("Șuncă de pui");
  await dana.getByLabel("Cantitatea netă").fill("300");
  await dana.getByRole("button", { name: "Adaugă varianta" }).click();
  await expect(dana.getByText("Am adăugat varianta.")).toBeVisible();
  await dana.getByLabel("Cantitate", { exact: true }).fill("1");
  await dana.getByLabel("Unitate", { exact: true }).selectOption("pachet");
  await dana.getByLabel("Preț plătit").fill("21");
  await dana.getByRole("button", { name: "Salvează" }).click();
  await expect(dana.getByText("1 pachet · Sissi, Șuncă de pui, 300 g")).toBeVisible();
  await expect(dana.getByRole("dialog")).toHaveCount(0);
  await dana.getByRole("button", { name: "Gata", exact: true }).click();
  await dana.getByRole("button", { name: "Finalizează" }).click();
  await expect(dana.getByText(/Gata! Ai cheltuit 21,00/)).toBeVisible();
  await syncNow(dana);
  await expect(dana.getByRole("button", { name: /Sincronizează acum/ })).not.toContainText(/refuz/i);

  // Emil vede prețul pe kg al variantei, adus de pe server.
  await emil.goto("/buget/preturi/");
  await syncNow(emil);
  await emil.getByRole("combobox").fill("șuncă");
  await emil.getByRole("option").first().click();
  await expect(emil.getByText("Prețul pe kg, pe mărci")).toBeVisible();
  await expect(emil.getByRole("listitem").filter({ hasText: "Sissi, Șuncă de pui, 300 g" }).first()).toContainText(/70,00\sRON\/kg/);
});
