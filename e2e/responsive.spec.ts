import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

const PAGES = [
  "/",
  "/cumparaturi/",
  "/retete/",
  "/retete/import/",
  "/retete/editare/",
  "/cumparaturi/bon/",
  "/buget/diverse/",
  "/autentificare/",
  "/invitatie/",
  "/offline/",
  "/plan/",
  "/buget/",
  "/buget/tranzactii/",
  "/buget/preturi/",
  "/camara/",
  "/gospodarie/",
  "/admin/",
  "/cumparaturi/istoric/",
  "/confidentialitate/",
  "/termeni/",
];

test("lista activă păstrează plata accesibilă pe mobil îngust și desktop", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await start(page);
  await createList(page, "Cumpărături săptămânale");
  await quickAdd(page, "2 kg roșii");
  await page.getByRole("checkbox", { name: /^Bifează Roșii/ }).click();
  const checkout = page.getByRole("button", { name: "Am plătit", exact: true });
  const actions = page.getByRole("button", { name: "Acțiuni cumpărături", exact: true });

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 640 });
    await page.getByRole("heading", { name: "Cumpărături săptămânale" }).scrollIntoViewIfNeeded();
    await expect(actions).toBeInViewport();
    await expect(checkout).toBeInViewport();
    const actionBox = (await actions.boundingBox())!;
    const checkoutBox = (await checkout.boundingBox())!;
    expect(actionBox.y + actionBox.height).toBeLessThan(checkoutBox.y);
  }

  await checkout.focus();
  await checkout.press("Enter");
  await expect(page.getByRole("dialog", { name: "Am plătit" })).toBeVisible();
});

for (const width of [360, 390, 600, 768, 1024, 1440]) {
  test(`fără derulare orizontală la ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await start(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("navigația principală are cele cinci secțiuni", async ({ page }) => {
  await start(page);
  const nav = page.locator('nav[aria-label="Navigare principală"]:visible');
  for (const label of ["Acasă", "Cumpărături", "Rețete", "Buget", "Cămară"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
});

test("pe telefon, antetul arată doar numele gospodăriei, fără iconiță", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await start(page);
  const name = page.getByRole("banner").getByRole("link").first();
  await expect(name).toBeVisible();
  await expect(name.locator("svg")).toHaveCount(0);
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

// Tablet navigation keeps all destinations and settings reachable without a bottom bar.
test("pe tabletă, navigația laterală permite deschiderea setărilor", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await start(page);
  const nav = page.locator('nav[aria-label="Navigare principală"]:visible');
  await expect(nav).toHaveCount(1);
  expect((await nav.boundingBox())?.width).toBe(96);
  await nav.getByRole("link", { name: "Setări", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gospodărie și setări" })).toBeVisible();
  await page.getByRole("radio", { name: "Întunecat", exact: true }).click();
  const colors = page.locator('meta[name="theme-color"]');
  await expect(colors.first()).toHaveAttribute("content", "#191410");
  await expect(colors.first()).toHaveAttribute("id", "camara-theme-override");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "intunecat");
  await expect(page.getByRole("radio", { name: "Întunecat", exact: true })).toBeChecked();
  await expect(colors.first()).toHaveAttribute("id", "camara-theme-override");
  await expect(colors).toHaveCount(3);
  await page.getByRole("radio", { name: "Automat", exact: true }).click();
  await expect(colors).toHaveCount(2);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect.poll(() => page.locator("html").evaluate(node => getComputedStyle(node).colorScheme)).toBe(scheme);
  }
});

test("planul și catalogul păstrează aceeași destinație principală", async ({ page }) => {
  await start(page, "/retete/");
  const section = page.getByRole("navigation", { name: "Rețete și plan" });
  await section.getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Planul meselor" })).toBeVisible();
  await expect(section.getByRole("link", { name: "Plan", exact: true })).toHaveAttribute("aria-current", "page");
  const nav = page.locator('nav[aria-label="Navigare principală"]:visible');
  await expect(nav.getByRole("link", { name: "Rețete", exact: true })).toHaveAttribute("aria-current", "page");
  await section.getByRole("link", { name: "Colecție", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rețete", exact: true })).toBeVisible();
});

test("la 360px, comenzile săptămânii rămân în zona de conținut", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page, "/plan/");
  const copy = page.getByRole("button", { name: "Copiază mesele în săptămâna următoare" });
  await expect(copy).toBeVisible();
  const rightEdge = await page.locator("main").evaluate(el => el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight));
  const box = (await copy.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(rightEdge + 1);
});

test("la 360px, etichetele surselor de preț nu se suprapun", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page, "/buget/preturi/");
  await page.getByRole("combobox").fill("roșii");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Preț", exact: true }).click();
  const radios = page.getByRole("dialog").getByRole("radiogroup", { name: "De unde" }).getByRole("radio");
  await expect(radios).toHaveCount(4);
  const overlaps = await radios.evaluateAll(nodes => nodes.flatMap(el => {
    const bounds = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].some(r => r.left < bounds.left - 1 || r.right > bounds.right + 1) ? [el.textContent] : [];
  }));
  expect(overlaps).toEqual([]);
});
