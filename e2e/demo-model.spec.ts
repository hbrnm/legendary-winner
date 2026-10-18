import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { FIXED_NOW } from "./helpers";

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
    ...["/", "/cumparaturi/", "/cumparaturi/istoric/", "/retete/", "/plan/", "/buget/", "/buget/preturi/", "/camara/"].map((p): [string, string] => [p, p]),
    ["/cumparaturi/lista/", async () => {
      await page.goto("/cumparaturi/");
      await page.getByText("Cumpărături săptămânale").click();
    }],
    ["/retete/reteta/", async () => {
      await page.goto("/retete/");
      await page.getByRole("link", { name: /^Ardei umpluți/ }).click();
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
    await info.attach(`${prefix}${path.replace(/\//g, "-")}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
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

test("Acasă, în gospodăria model: magazinele la cheltuieli, eticheta de expirare, inițiala rețetei", async ({ page }) => {
  await startModel(page);
  // Cheltuieli recente: magazinul (sau piața) pe rândul principal, nu „Cumpărături” repetat.
  const recent = page.locator("main a[href='/cumparaturi/istoric/']").filter({ hasText: /RON/ });
  await expect(recent).toHaveCount(3);
  await expect(recent.nth(0)).toContainText("Kaufland");
  await expect(recent.nth(1)).toContainText("Piață");
  await expect(recent.nth(2)).toContainText("Lidl");
  // Expiră curând: termenul ca ștampilă lângă produs.
  await expect(page.getByRole("listitem").filter({ hasText: "Iaurt natural" })).toContainText(/în 2 zile/i);
  // Rețetele fără fotografie au inițiala în locul pictogramei.
  const avatars = page.getByTestId("avatar-reteta");
  for (const el of await avatars.all()) expect(await el.textContent()).toMatch(/^\p{Lu}$/u);
});

test("adăugarea rapidă pune produsele terminate în cămară sub titlul lor", async ({ page }) => {
  await startModel(page, "/camara/");
  await page.getByRole("button", { name: /^Scade Unt/ }).click();
  // La zero, produsul trece la „terminate”, ascunse implicit.
  await expect(page.getByRole("button", { name: /^Scade Unt/ })).toHaveCount(0);
  await page.goto("/cumparaturi/");
  await page.getByText("Cumpărături săptămânale").click();
  const quick = page.getByRole("region", { name: "Adăugare rapidă" });
  await expect(quick.getByRole("heading", { name: "S-a terminat în cămară" })).toBeVisible();
  const finished = quick.locator("div").filter({ has: page.getByRole("heading", { name: "S-a terminat în cămară" }) });
  await expect(finished.getByRole("button", { name: /^Adaugă Unt/ })).toBeVisible();
});

test("istoricul ca registru: magazinul pe rândul principal, lista dedesubt", async ({ page }) => {
  await startModel(page, "/cumparaturi/istoric/");
  // Aceleași trei cumpărături, în aceeași ordine, ca la Cheltuieli recente pe Acasă.
  const trips = page.locator("main li button");
  await expect(trips.nth(0).locator("span").first()).toHaveText(/^Kaufland/);
  await expect(trips.nth(1).locator("span").first()).toHaveText(/^Piață/);
  await expect(trips.nth(2).locator("span").first()).toHaveText(/^Lidl/);
  await trips.nth(0).click();
  await expect(page.getByRole("dialog", { name: /^Kaufland/ })).toBeVisible();
});

test("gospodăria model: cămară, listă, buget, plan", async ({ page }) => {
  await startModel(page, "/camara/");
  await expect(page.getByText("14 produse acasă")).toBeVisible();
  await expect(page.getByText("expiră în 2 zile", { exact: true })).toBeVisible();
  await expect(page.getByText("Un produs expiră curând")).toBeVisible();

  await page.goto("/cumparaturi/");
  await expect(page.getByText(/3 din 10 luate · ~/)).toBeVisible();
  await page.getByText("Cumpărături săptămânale").click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale" })).toBeVisible();
  const quick = page.getByRole("region", { name: "Adăugare rapidă" });
  await expect(quick).toBeVisible();
  // Sugestiile stau sub titluri, fără „des” / „s-a terminat” lipit de fiecare produs
  // (în gospodăria model nimic nu s-a terminat, deci apare doar grupul „Cumperi des”).
  await expect(quick.getByRole("heading", { name: "Cumperi des" })).toBeVisible();
  for (const text of await quick.getByRole("button").allTextContents()) expect(text).not.toMatch(/\bdes$|s-a terminat$/);
  const first = quick.getByRole("button").first();
  const name = ((await first.getAttribute("aria-label")) ?? "").replace(/^Adaugă /, "");
  await first.click();
  await expect(page.getByText(/3 din 11 luate/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Bifează ${name}` })).toBeVisible();

  await page.goto("/buget/");
  await expect(page.getByText("din 2.500,00 RON").or(page.getByText("din 2500,00 RON"))).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /cheltuit și coșul de acum/ })).toBeVisible();
  await expect(page.getByText("Graficul se umple după primele cumpărături.")).toHaveCount(0);
  // „Înainte de cumpărături” duce la liste.
  await page.getByRole("link", { name: /Înainte de cumpărături/ }).click();
  await expect(page).toHaveURL(/\/cumparaturi\/$/);

  await page.goto("/plan/");
  await expect(page.getByText("Sarmale în foi de varză murată")).toBeVisible();
  // Sub 80% din ingrediente cu preț, nu apare suma, ci pentru câte ingrediente avem preț.
  await expect(page.getByText(/· preț pentru 13 din 33 de ingrediente/)).toBeVisible();

  await page.goto("/retete/");
  const ardei = page.getByRole("link", { name: /^Ardei umpluți/ });
  await expect(ardei).toContainText("preț pentru 6 din 10 ingrediente");
  await expect(page.getByText(/\(parțial\)/)).toHaveCount(0);
  await ardei.click();
  await expect(page.getByText("Preț pentru 6 din 10 ingrediente")).toBeVisible();
  await expect(page.getByText("pe porție")).toHaveCount(0);
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
    const filters = page.getByRole("group", { name: "Unde caut" }).getByRole("button");
    await expect(filters).toHaveText(["Toate", "Frigider", "Congelator", "Cămară"]);
    expect(await clipped(page, "[aria-label='Unde caut'] button")).toEqual([]);

    await page.goto("/cumparaturi/");
    await page.getByText("Cumpărături săptămânale").click();
    await expect(page.getByRole("radiogroup", { name: "Grupare" })).toBeVisible();
    expect(await wrapped(page, "[aria-label='Grupare'] button")).toEqual([]);
    // În fereastra produsului, selectoarele (inclusiv „Sursa”, cu 4 variante) nu ies din ecran.
    await page.getByText("Mere").first().click();
    const groups = page.getByRole("dialog").getByRole("radiogroup");
    await expect(groups.first()).toBeVisible();
    expect(await groups.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.getAttribute("aria-label")))).toEqual([]);
    await page.keyboard.press("Escape");

    await page.goto("/retete/");
    await expect(page.getByTestId("avatar-reteta").first()).toBeVisible();
    const avatar = await page.getByTestId("avatar-reteta").first().boundingBox();
    expect([avatar?.width, avatar?.height]).toEqual([64, 64]);
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
  await expect(page.getByText("16,80 RON / 0,5 kg")).toBeVisible();
  await expect(page.getByText(/\d\.\d+ (kg|l)\b/)).toHaveCount(0);
});
