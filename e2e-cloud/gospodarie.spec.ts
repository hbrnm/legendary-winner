import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { quickAdd, signUp, syncNow } from "./helpers";

test("cont, gospodărie, invitație, listă comună sincronizată, gospodării izolate", async ({ browser }) => {
  // Ana își face cont și gospodărie.
  const ana = await signUp(browser, "Ana");
  await ana.waitForURL(/gospodarie/);
  await ana.getByLabel("Numele gospodăriei").fill("Familia Popescu");
  await ana.getByRole("button", { name: "Creează gospodăria" }).click();
  await expect(ana.getByText("Familia Popescu").first()).toBeVisible();

  // Ana o invită pe Bogdan.
  await ana.getByRole("button", { name: "Invită pe cineva" }).click();
  await ana.getByRole("button", { name: "Creează linkul de invitație" }).click();
  const link = (await ana.locator("p.font-mono").textContent())!.trim();
  expect(link).toContain("/invitatie/?token=");
  await ana.keyboard.press("Escape");

  // Bogdan deschide linkul, își face cont și acceptă.
  const bogdan = await signUp(browser, "Bogdan", new URL(link).pathname + new URL(link).search);
  await bogdan.waitForURL(/invitatie/);
  await expect(bogdan.getByRole("heading", { name: "Intră în „Familia Popescu”" })).toBeVisible();
  await bogdan.getByRole("button", { name: "Accept invitația" }).click();
  await bogdan.waitForURL((u) => u.pathname === "/");
  await expect(bogdan.getByText("Familia Popescu").first()).toBeVisible();

  // Ana vede noul membru.
  await ana.goto("/gospodarie/");
  await expect(ana.getByText("Bogdan")).toBeVisible();

  // Ana face o listă; Bogdan o vede.
  await ana.goto("/cumparaturi/");
  await ana.getByRole("button", { name: "Listă nouă" }).click();
  await ana.getByLabel("Numele listei").fill("Săptămâna asta");
  await ana.getByRole("button", { name: "Creează lista" }).click();
  await ana.waitForURL(/lista/);
  await quickAdd(ana, "lapte", "Lapte integral");
  await quickAdd(ana, "2 kg cartofi", "Cartofi albi");
  await syncNow(ana);

  await bogdan.goto("/cumparaturi/");
  await syncNow(bogdan);
  await bogdan.getByText("Săptămâna asta").click();
  await expect(bogdan.getByText("Lapte integral")).toBeVisible();

  // Bogdan e în magazin fără semnal: bifează și pune prețul. Între timp Ana schimbă cantitatea.
  await bogdan.context().setOffline(true);
  await bogdan.getByRole("button", { name: "Prețul pentru Lapte integral" }).click();
  await bogdan.getByLabel("Preț plătit").fill("8,90");
  await bogdan.getByRole("button", { name: "Salvează" }).click();
  await expect(bogdan.getByRole("checkbox", { name: /Debifează Lapte integral/ })).toBeVisible();

  await ana.getByRole("button", { name: /^Lapte integral/ }).click();
  await ana.getByLabel("Cantitate", { exact: true }).fill("2");
  await ana.getByRole("button", { name: "Salvează" }).click();
  await syncNow(ana);

  // Revine semnalul: modificările amândurora se păstrează.
  await bogdan.context().setOffline(false);
  await syncNow(bogdan);
  await expect(bogdan.getByText("2 buc", { exact: true })).toBeVisible();
  await syncNow(ana);
  await expect(ana.getByRole("checkbox", { name: /Debifează Lapte integral/ })).toBeVisible();
  await expect(ana.getByText("8,90 RON").first()).toBeVisible();

  // Ana pune fotografia ei la o rețetă din catalog; ajunge în Storage, iar Bogdan o vede.
  const recipe = "/retete/reteta/?id=ciorba-de-perisoare";
  await ana.goto(recipe);
  await syncNow(ana);
  // Încărcarea poate porni singură, imediat după salvare: o așteptăm de dinainte să alegem fișierul.
  const uploaded = ana.waitForResponse((r) => r.url().includes("/storage/v1/object/recipe-photos/") && r.request().method() === "POST" && r.ok());
  await ana.getByTestId("fotografie-fisier").setInputFiles({ name: "ciorba.jpg", mimeType: "image/jpeg", buffer: readFileSync("e2e/fixtures/ciorba-1600x1200.jpg") });
  await expect(ana.getByText("Am pus fotografia.")).toBeVisible();
  await syncNow(ana);
  await uploaded;
  await expect(ana.getByText(/Se încarcă/)).toHaveCount(0);

  await bogdan.goto(recipe);
  const downloaded = bogdan.waitForResponse((r) => r.url().includes("/storage/v1/object/recipe-photos/") && r.request().method() === "GET" && r.ok());
  await syncNow(bogdan);
  await downloaded;
  await expect(bogdan.locator("main img").first()).toHaveAttribute("src", /^blob:/);
  await expect(bogdan.getByRole("button", { name: "Schimbă fotografia" })).toBeVisible();

  // Carmen, din altă gospodărie, nu vede nimic din ale lor.
  const carmen = await signUp(browser, "Carmen");
  await carmen.waitForURL(/gospodarie/);
  await carmen.getByLabel("Numele gospodăriei").fill("Familia Ionescu");
  await carmen.getByRole("button", { name: "Creează gospodăria" }).click();
  await carmen.goto("/cumparaturi/");
  await syncNow(carmen);
  await expect(carmen.getByText("Săptămâna asta")).toHaveCount(0);
  await expect(carmen.getByText("Încă n-ai nicio listă")).toBeVisible();
  // Și vede la rețetă fotografia din catalog, nu pe cea a Anei.
  await carmen.goto(recipe);
  await syncNow(carmen);
  await expect(carmen.locator("main img").first()).toHaveAttribute("src", "/retete/ciorba-de-perisoare.webp");
  await expect(carmen.getByRole("button", { name: "Adaugă fotografia ta" })).toBeVisible();

  // Deconectarea șterge datele gospodăriei de pe dispozitiv.
  await bogdan.goto("/gospodarie/");
  await bogdan.getByRole("button", { name: "Ieși din cont" }).click();
  await bogdan.goto("/cumparaturi/");
  await bogdan.waitForURL(/autentificare/);
});
