import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

const PAGES = ["/", "/cumparaturi/", "/retete/", "/plan/", "/buget/", "/buget/preturi/", "/camara/", "/gospodarie/", "/admin/", "/cumparaturi/istoric/"];

for (const width of [360, 1280]) {
  test(`fără derulare orizontală la ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await start(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("navigația principală are cele cinci secțiuni", async ({ page }) => {
  await start(page);
  const nav = page.getByRole("navigation", { name: "Navigare principală" }).last();
  for (const label of ["Acasă", "Cumpărături", "Rețete", "Buget", "Cămară"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
});

// Pe iPhone, Safari mărește pagina când atingi un câmp cu litera sub 16 px,
// iar după mărire pagina se poate trage stânga-dreapta.
async function smallFields(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ name: el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.id, size: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((f) => f.size < 16),
  );
}

test("câmpurile au litera de cel puțin 16px, ca iPhone să nu mărească pagina", async ({ page }) => {
  await start(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await smallFields(page), path).toEqual([]);
  }
  await createList(page, "Test câmpuri");
  await quickAdd(page, "roșii");
  await page.getByRole("button", { name: /^Roșii/ }).click();
  await expect(page.getByLabel("Cantitate")).toBeVisible();
  expect(await smallFields(page), "fișa produsului").toEqual([]);
});

test("pagina nu se poate derula orizontal, nici când ceva iese din ecran", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await start(page);
  await page.evaluate(() => {
    const wide = document.createElement("div");
    wide.style.width = "2000px";
    wide.style.height = "10px";
    document.querySelector("main")!.appendChild(wide);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
