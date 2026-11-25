import { expect, test } from "@playwright/test";
import { FIXED_NOW } from "../e2e/helpers";

// Aceste scenarii au nevoie de build cu Supabase configurat, dar nu de un cont sau de scrieri pe server.
test("demo înainte de cont: explorare, salvare locală, reîncărcare și revenire la autentificare", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/");
  await expect(page).toHaveURL(/autentificare/);
  const enter = page.getByRole("link", { name: "Încearcă fără cont", exact: true });
  await expect(enter).toBeVisible();
  const cloudRequests: string[] = [];
  page.on("request", request => {
    if (/\/auth\/v1\/|\/rest\/v1\/|\/storage\/v1\/|\/functions\/v1\//.test(request.url())) cloudRequests.push(request.url());
  });
  await enter.click();
  await expect(page.getByText("Mod demonstrativ", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Azi la masă", exact: true })).toBeVisible();
  const nav = page.locator('nav[aria-label="Navigare principală"]:visible');
  await nav.getByRole("link", { name: "Rețete", exact: true }).click();
  await expect(page).toHaveURL(/\/retete\/$/);
  await expect(page.getByRole("heading", { name: "Rețete", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rețete", exact: true })).toBeVisible();
  await expect(page.getByText("Mod demonstrativ", { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Acasă", exact: true }).click();
  const count = page.getByRole("link", { name: /^Deschide lista/ });
  await expect(count).toContainText(/7\s*de luat/);
  await count.click();
  const search = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await expect(page).toHaveURL(/\/cumparaturi\/lista\//);
  await search.click();
  await expect(search).toBeFocused();
  await search.pressSequentially("Produs pentru explorarea demo");
  await page.getByRole("option", { name: /Adaugă .*Produs pentru explorarea demo.* ca produs nou/ }).click();
  await expect(page.getByRole("checkbox", { name: "Bifează Produs pentru explorarea demo" })).toBeVisible();
  await page.goto("/");
  await expect(count).toContainText(/8\s*de luat/);
  await page.reload();
  await expect(count).toContainText(/8\s*de luat/);
  expect(cloudRequests).toEqual([]);
  await page.getByRole("link", { name: "Intră în cont", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByText("Mod demonstrativ", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Încearcă fără cont", exact: true }).click();
  await expect(count).toContainText(/8\s*de luat/);
});

test("în demo, o invitație nu pornește operații pe server", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/autentificare/?demo=1");
  await expect(page.getByRole("heading", { name: "Azi la masă", exact: true })).toBeVisible();
  const requests: string[] = [];
  page.on("request", req => { if (req.url().includes("/rest/v1/")) requests.push(req.url()); });
  await page.goto("/invitatie/?token=invitat-demo");
  await expect(page.getByRole("heading", { name: "Invitațiile cer un cont" })).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole("link", { name: "Intră în cont", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("inapoi")).toBe("/invitatie/?token=invitat-demo");
});
