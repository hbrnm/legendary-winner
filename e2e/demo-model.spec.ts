import { expect, test, type Page } from "@playwright/test";
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

test("gospodăria model: cămară, listă, buget, plan", async ({ page }) => {
  await startModel(page, "/camara/");
  await expect(page.getByText("14 produse acasă")).toBeVisible();
  await expect(page.getByText("expiră în 2 zile")).toBeVisible();
  await expect(page.getByText("Un produs expiră curând")).toBeVisible();

  await page.goto("/cumparaturi/");
  await expect(page.getByText(/3 din 10 luate · ~/)).toBeVisible();
  await page.getByText("Cumpărături săptămânale").click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale" })).toBeVisible();
  const quick = page.getByRole("region", { name: "Adăugare rapidă" });
  await expect(quick).toBeVisible();
  const first = quick.getByRole("button").first();
  const name = ((await first.getAttribute("aria-label")) ?? "").replace(/^Adaugă /, "");
  await first.click();
  await expect(page.getByText(/3 din 11 luate/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Bifează ${name}` })).toBeVisible();

  await page.goto("/buget/");
  await expect(page.getByText("din 2.500,00 RON").or(page.getByText("din 2500,00 RON"))).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /cheltuit și coșul de acum/ })).toBeVisible();
  await expect(page.getByText("Graficul se umple după primele cumpărături.")).toHaveCount(0);

  await page.goto("/plan/");
  await expect(page.getByText("Sarmale în foi de varză murată")).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`la 360 px, în modul ${scheme === "light" ? "luminos" : "întunecat"}, nimic nu iese din ecran și nimic nu e turtit`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 360, height: 780 });
    await startModel(page);
    for (const path of ["/", "/cumparaturi/", "/retete/", "/buget/", "/camara/", "/plan/"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Se încarcă" })).toHaveCount(0);
      expect(await offscreen(page), path).toEqual([]);
      expect(await short(page), path).toEqual([]);
      await info.attach(`${scheme}${path.replace(/\//g, "-")}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }

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

    await page.goto("/retete/");
    await expect(page.getByTestId("avatar-reteta").first()).toBeVisible();
    const avatar = await page.getByTestId("avatar-reteta").first().boundingBox();
    expect([avatar?.width, avatar?.height]).toEqual([64, 64]);
  });
}
