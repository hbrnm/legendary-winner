import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("manifestul și service worker-ul permit instalarea", async ({ page }) => {
  await start(page);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "Cămara", display: "standalone", lang: "ro" });
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active))).toBe(true);
});

test("lista funcționează fără internet, iar modificările rămân", async ({ page, context }) => {
  await start(page);
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active))).toBe(true);
  await createList(page, "Magazin cu semnal slab");
  await quickAdd(page, "lapte");
  const url = page.url();
  // Încarcă o dată cu service worker-ul activ, ca pagina să fie în cache.
  await page.reload();
  await expect(page.getByText("Lapte integral")).toBeVisible();

  await context.setOffline(true);
  await page.goto(url);
  await expect(page.getByText("Lapte integral")).toBeVisible();
  await quickAdd(page, "2 kg cartofi");
  await page.getByRole("checkbox", { name: /Bifează Lapte integral/ }).click();
  // Reîncarcă abia după ce lista arată schimbările, adică după ce au ajuns în baza locală.
  await expect(page.getByText("Cartofi albi")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Debifează Lapte integral/ })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cartofi albi")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Debifează Lapte integral/ })).toBeVisible();
  await context.setOffline(false);
});

test("fotografia din catalog are autorul și rămâne vizibilă fără internet", async ({ page, context }) => {
  await start(page);
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active))).toBe(true);
  await page.goto("/retete/reteta/?id=sarmale");
  const photo = page.locator('img[src="/retete/sarmale.webp"]');
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(/^Foto: .+ \/ Wikimedia Commons · CC BY-SA 4\.0$/)).toBeVisible();
  // A doua încărcare trece prin service worker, care pune fotografia în cache.
  await page.reload();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await context.setOffline(false);
});
