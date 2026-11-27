import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { FIXED_NOW } from "./helpers";

const STUFFED_PEPPERS = "Ardei umpluți cu orez, ciuperci și legume (de post)";
const OMELETTE = "Omletă cu spanac și brânză feta";
const TURKEY_SOUP = "Ciorbă de perișoare de curcan";

async function searchRecipe(page: Page, query: string, name: string) {
  await page.goto("/retete/");
  await page.getByLabel("Caută rețete").fill(query);
  const recipe = page.getByRole("link", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
  await expect(recipe).toBeVisible();
  return recipe;
}

// Modul demonstrativ pornește cu gospodăria model (fără `camara-demo-gol`).
async function startModel(page: Page, path = "/") {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(path);
  await expect(page.getByText("Mod demonstrativ")).toBeVisible();
}

/** Elementele vizibile care ies din ecran în dreapta (în afara rândurilor care se derulează singure). */
async function offscreen(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.right <= w + 1) return false;
        for (let p = el.parentElement; p; p = p.parentElement) if (["auto", "scroll"].includes(getComputedStyle(p).overflowX)) return false;
        return true;
      })
      .map((el) => `${el.tagName.toLowerCase()} „${(el.textContent ?? "").trim().slice(0, 30)}”`)
      .slice(0, 5);
  });
}

/** Butoanele vizibile mai joase de 44 px (zona minimă de atins pe telefon). */
async function short(page: Page) {
  return page.locator("main button, header button").evaluateAll((els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map((el) => `„${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)} px`),
  );
}

/** Paginile redesenate (inclusiv o listă și o rețetă): nimic în afara ecranului, butoane de 44 px, câte o captură. */
async function checkScreens(page: Page, info: TestInfo, prefix: string) {
  const screens: [string, string | (() => Promise<void>)][] = [
    ...["/", "/cumparaturi/", "/cumparaturi/istoric/", "/retete/", "/plan/", "/buget/", "/buget/tranzactii/", "/buget/preturi/", "/camara/", "/gospodarie/"].map((p): [string, string] => [p, p]),
    ["/cumparaturi/lista/", async () => {
      await page.goto("/cumparaturi/");
      await page.getByText("Cumpărături săptămânale").click();
    }],
    ["/retete/reteta/", async () => {
      await (await searchRecipe(page, "ardei umpluți", STUFFED_PEPPERS)).click();
    }],
  ];
  for (const [path, open] of screens) {
    if (typeof open === "string") await page.goto(open);
    else await open();
    await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Se încarcă" })).toHaveCount(0);
    expect(await offscreen(page), path).toEqual([]);
    expect(await short(page), path).toEqual([]);
    // Captura doar a ecranului vizibil: verificările de mai sus acoperă toată pagina, iar lista de rețete e foarte lungă.
    await info.attach(`${prefix}${path.replace(/\//g, "-")}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
}

/** Elementele al căror text trece pe mai multe rânduri. */
async function wrapped(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1;
      })
      .map((el) => el.textContent),
  );
}

/** Butoanele al căror text e tăiat. */
async function clipped(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
}

test("Acasă, în gospodăria model: ultima tranzacție și rezumatul stocului păstrează detaliile accesibile", async ({ page }) => {
  await startModel(page);
  // Home keeps one latest transaction; the complete register retains all three trips.
  await expect(page.locator("main p").filter({ hasText: /^Kaufland ·/ })).toHaveCount(1);
  const pantry = page.getByRole("link", { name: /^Cămară 14 în stoc.*1 expiră curând/ });
  await expect(pantry).toHaveAttribute("href", "/camara/");
  await page.getByRole("link", { name: "Istoric →" }).click();
  const recent = page.locator("main a[href^='/cumparaturi/istoric']").filter({ hasText: /RON/ });
  await expect(recent).toHaveCount(3);
  await expect(recent.nth(0)).toContainText("Kaufland");
  await expect(recent.nth(1)).toContainText("Piață");
  await expect(recent.nth(2)).toContainText("Lidl");
  await page.goto("/camara/");
  await page.getByRole("button", { name: /Expiră curând/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Iaurt natural" })).toContainText(/în 2 zile/i);
  const noPhoto = await searchRecipe(page, "omletă cu spanac", OMELETTE);
  await expect(noPhoto.getByTestId("avatar-reteta")).toHaveCount(0);
  await expect(noPhoto.locator("img")).toHaveCount(0);
});

test("adăugarea rapidă pune produsele terminate în cămară sub titlul lor", async ({ page }) => {
  await startModel(page, "/camara/");
  await page.getByRole("searchbox", { name: "Caută în cămară" }).fill("Unt");
  await page.getByRole("button", { name: /^Scade Unt/ }).click();
  // La zero, produsul trece la „terminate”, ascunse implicit.
  await expect(page.getByRole("button", { name: /^Scade Unt/ })).toHaveCount(0);
  await page.goto("/cumparaturi/");
  await page.getByText("Cumpărături săptămânale").click();
  const quick = page.getByRole("region", { name: "Poate-ți mai trebuie" });
  await quick.locator("summary").click();
  await expect(quick.getByRole("heading", { name: "S-a terminat în cămară" })).toBeVisible();
  const finished = quick.locator("div").filter({ has: page.getByRole("heading", { name: "S-a terminat în cămară" }) });
  await expect(finished.getByRole("button", { name: /^Adaugă Unt/ })).toBeVisible();
});

test("istoricul ca registru: magazinul pe rândul principal, lista dedesubt", async ({ page }) => {
  await startModel(page, "/cumparaturi/istoric/");
  // The register preserves all three completed trips in date order.
  const trips = page.locator("main li button");
  await expect(trips.nth(0).locator("span").first()).toHaveText(/^Kaufland/);
  await expect(trips.nth(1).locator("span").first()).toHaveText(/^Piață/);
  await expect(trips.nth(2).locator("span").first()).toHaveText(/^Lidl/);
  await trips.nth(0).click();
  await expect(page.getByRole("dialog", { name: /^Kaufland/ })).toBeVisible();
});

test("istoricul are și lista în curs, cu aceeași sumă a lunii ca bugetul", async ({ page }) => {
  await startModel(page, "/cumparaturi/istoric/");
  // Laptele și pâinea bifate pe listă, înainte de „Gata” (.tasks/016, auditul din 23 oct. 2026).
  const current = page.getByRole("link", { name: /În curs: Cumpărături săptămânale/ });
  await expect(current).toContainText("18,79 RON");
  await expect(page.getByText("256,91 RON").first()).toBeVisible();
  await current.click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale" })).toBeVisible();
  await page.goto("/buget/");
  await expect(page.getByText("256,91 RON").first()).toBeVisible();
});

test("gospodăria model: cămară, listă, buget, plan", async ({ page }) => {
  await startModel(page, "/camara/");
  await expect(page.getByText("14 produse acasă")).toBeVisible();
  await page.getByRole("button", { name: "Expiră curând (1)" }).click();
  await expect(page.getByText("expiră în 2 zile", { exact: true })).toBeVisible();

  await page.goto("/cumparaturi/?toate=1");
  await expect(page.getByText(/3 din 10 în coș · ~/)).toBeVisible();
  await page.getByText("Cumpărături săptămânale").click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale" })).toBeVisible();
  const quick = page.getByRole("region", { name: "Poate-ți mai trebuie" });
  await expect(quick).toBeVisible();
  await quick.locator("summary").click();
  // Sugestiile stau sub titluri, fără „des” / „s-a terminat” lipit de fiecare produs
  // (în gospodăria model nimic nu s-a terminat, deci apare doar grupul „Cumperi des”).
  await expect(quick.getByRole("heading", { name: "Cumperi des" })).toBeVisible();
  for (const text of await quick.getByRole("button").allTextContents()) expect(text).not.toMatch(/\bdes$|s-a terminat$/);
  const first = quick.getByRole("button").first();
  const name = ((await first.getAttribute("aria-label")) ?? "").replace(/^Adaugă /, "");
  await first.click();
  await expect(page.getByText(/3 din 11 în coș/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Bifează ${name}` })).toBeVisible();

  await page.goto("/buget/");
  await expect(page.getByText("din 2.500,00 RON").or(page.getByText("din 2500,00 RON"))).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /cheltuit și coșul de acum/ })).toBeVisible();
  await expect(page.getByText("Graficul se umple după primele cumpărături.")).toHaveCount(0);
  await expect(page.getByText(/Sold după (costurile cunoscute|cumpărăturile planificate)/)).toBeVisible();
  await page.getByRole("radio", { name: "Săptămâni", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Cheltuieli pe săptămână/ })).toBeVisible();
  await page.getByRole("link", { name: "Deschide cumpărăturile" }).click();
  await expect(page).toHaveURL(/\/cumparaturi\/($|lista\/)/);

  await page.goto("/plan/");
  await expect(page.getByRole("button", { name: /^Ardei umpluți cu orez, ciuperci și legume/ })).toBeVisible();
  // Sub 80% din ingrediente cu preț, nu apare suma, ci pentru câte ingrediente avem preț.
  await expect(page.getByText(/· preț pentru 7 din 29 de ingrediente/)).toBeVisible();

  const ardei = await searchRecipe(page, "ardei umpluți", STUFFED_PEPPERS);
  const partialPrice = /preț pentru (\d+) din (\d+) ingrediente/i;
  await expect(ardei).toContainText(partialPrice);
  const coverage = (await ardei.innerText()).match(partialPrice)!;
  expect(Number(coverage[1]) / Number(coverage[2])).toBeLessThan(0.8);
  await expect(page.getByText(/\(parțial\)/)).toHaveCount(0);
  await ardei.click();
  await expect(page).toHaveURL(/\/retete\/reteta\/\?id=ardei-umpluti-orez-ciuperci-legume$/);
  await expect(page.getByRole("heading", { name: STUFFED_PEPPERS, exact: true })).toBeVisible();
  await expect(page.getByText(`Preț pentru ${coverage[1]} din ${coverage[2]} ingrediente`, { exact: true })).toBeVisible();
  await expect(page.getByText("pe porție", { exact: true })).toHaveCount(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`la 360 px, în modul ${scheme === "light" ? "luminos" : "întunecat"}, nimic nu iese din ecran și nimic nu e turtit`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 360, height: 780 });
    await startModel(page);
    await checkScreens(page, info, scheme);

    await page.goto("/buget/");
    for (const name of ["Prețuri și comparații", "Exportă luna", "Exportă tot"]) {
      const box = await page.getByRole(name === "Prețuri și comparații" ? "link" : "button", { name }).boundingBox();
      expect(box?.height, name).toBeGreaterThanOrEqual(44);
    }

    await page.goto("/camara/");
    const locations = page.locator("details[name='pantry-locations']");
    await expect(locations.locator("summary").first()).toBeVisible();
    await expect(page.locator("details[name='pantry-locations'][open]")).toHaveCount(0);
    expect(await clipped(page, "details[name='pantry-locations'] summary")).toEqual([]);

    await page.goto("/cumparaturi/");
    await page.getByText("Cumpărături săptămânale").click();
    await page.getByRole("button", { name: "Filtre" }).click();
    await expect(page.getByRole("radiogroup", { name: "Grupare" })).toBeVisible();
    expect(await wrapped(page, "[aria-label='Grupare'] button")).toEqual([]);
    await page.getByRole("dialog", { name: "Detaliile listei" }).getByRole("button", { name: "Închide" }).click();
    // În fereastra produsului, selectoarele (inclusiv „Sursa”, cu 4 variante) nu ies din ecran.
    await page.getByText("Mere").first().click();
    const groups = page.getByRole("dialog").getByRole("radiogroup");
    await expect(groups.first()).toBeVisible();
    expect(await groups.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.getAttribute("aria-label")))).toEqual([]);
    await page.keyboard.press("Escape");

    const noPhoto = await searchRecipe(page, "omletă cu spanac", OMELETTE);
    await expect(noPhoto.getByTestId("avatar-reteta")).toHaveCount(0);
    await expect(noPhoto.locator("img")).toHaveCount(0);
    const soup = await searchRecipe(page, "ciorbă de perișoare", TURKEY_SOUP);
    await soup.click();
    await page.getByTestId("fotografie-fisier").setInputFiles("e2e/fixtures/ciorba-1600x1200.jpg");
    await expect(page.getByText("Am pus fotografia.")).toBeVisible();
    const photo = (await searchRecipe(page, "ciorbă de perișoare", TURKEY_SOUP)).locator("img");
    await expect(photo).toHaveAttribute("src", /^blob:/);
    await expect(photo).toBeVisible();
    const bounds = await photo.boundingBox();
    expect([bounds?.width, bounds?.height]).toEqual([64, 64]);
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`pe desktop, în modul ${scheme === "light" ? "luminos" : "întunecat"}, nimic nu iese din ecran`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 800 });
    await startModel(page);
    await checkScreens(page, info, `desktop-${scheme}`);
  });
}

test("la Prețuri, cantitățile cu zecimale se scriu cu virgulă", async ({ page }) => {
  await startModel(page, "/buget/preturi/");
  await expect(page.getByText("16,80 RON").first()).toBeVisible();
  await expect(page.getByText(/0,5 kg/).first()).toBeVisible();
  await expect(page.getByText(/\d\.\d+ (kg|l)\b/)).toHaveCount(0);
});

test("alergenii ca etichetă de borcan, numele gospodăriei în DM Sans pe desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startModel(page, "/retete/");
  await (await searchRecipe(page, "clatite americane", "Clătite americane cu banane")).click();
  const allergens = page.getByTestId("alergeni");
  await expect(allergens).toContainText("lapte");
  await expect(allergens).toContainText("ouă");
  await expect(allergens).toContainText("Verifică și eticheta produselor folosite.");
  await expect(allergens).toHaveCSS("border-top-style", "dashed");
  const name = page.locator("header").getByText("Gospodăria mea", { exact: true }).filter({ visible: true });
  await expect(name).toBeVisible();
  expect(await name.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^-apple-system, BlinkMacSystemFont, "?dmSans/);
});
