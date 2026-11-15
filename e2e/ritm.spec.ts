import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("Ritm: cardul listei urmărește adăugarea, bifarea și salvarea după reîncărcare", async ({ page }) => {
  await start(page);
  const list = page.getByRole("link", { name: "Cumpărături", exact: true }).filter({ has: page.locator("[data-dashboard-count]") });
  await expect(list.locator("[data-dashboard-count]")).toHaveText("0");
  await quickAdd(page, "roșii");
  await expect(list.locator("[data-dashboard-count]")).toHaveText("1");
  await list.click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Bifează Roșii", exact: true }).click();
  await expect(page.getByText("Ai tot! Apasă „Gata” la casă.")).toBeVisible();
  await page.goto("/");
  await expect(list.locator("[data-dashboard-count]")).toHaveText("0");
  await page.reload();
  await expect(list.locator("[data-dashboard-count]")).toHaveText("0");
});

test("Ritm: bara plutitoare lasă spațiu conținutului și toate destinațiile sunt accesibile", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await start(page);
  const nav = page.locator(".app-mobile-nav");
  const bounds = (await nav.boundingBox())!;
  expect(bounds.x).toBeGreaterThan(0);
  expect(bounds.width).toBeLessThan(393);
  const paths: [string, RegExp][] = [["Cumpărături", /\/cumparaturi\/$/], ["Rețete", /\/retete\/$/], ["Buget", /\/buget\/$/], ["Cămară", /\/camara\/$/], ["Acasă", /\/$/]];
  for (const [name, path] of paths) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(path);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const padding = await page.locator("main").evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  expect(padding).toBeGreaterThanOrEqual(100);
});

test("Ritm: numele lung al listei rămâne în card pe telefon", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page);
  await createList(page, "Cumpărăturilesăptămânalepentrufamiliameaextinsă");
  await quickAdd(page, "roșii");
  await page.goto("/");
  const list = page.locator("main").getByRole("link", { name: "Cumpărături", exact: true });
  await expect(list).toContainText("Cumpărăturilesăptămânalepentrufamiliameaextinsă");
  expect(await list.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
});
