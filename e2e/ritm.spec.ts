import { expect, test } from "@playwright/test";
import { createList, quickAdd, start } from "./helpers";

test("Azi: acțiunea principală urmărește adăugarea și bifarea după reîncărcare", async ({ page }) => {
  await start(page);
  const search = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  const list = page.getByRole("link", { name: /^Deschide lista/ });
  await expect(search).toBeVisible();
  await expect(page.getByRole("link", { name: "Planul săptămânii" })).toBeVisible();
  await search.fill("roșii");
  await expect(page.getByRole("listbox")).toBeVisible();
  await search.press("Enter");
  await expect(list).toContainText(/1\s*de luat/);
  await expect(list).toBeFocused();
  await list.click();
  await expect(page.getByRole("heading", { name: "Cumpărături săptămânale", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Bifează Roșii", exact: true }).click();
  await expect(page.getByText("Ai tot! Poți înregistra plata.")).toBeVisible();
  await page.goto("/");
  await expect(search).toBeVisible();
  await expect(page.getByRole("link", { name: "Vezi lista" })).toBeVisible();
  await page.reload();
  await expect(search).toBeVisible();
});

test("Ritm: bara plutitoare lasă spațiu conținutului și toate destinațiile sunt accesibile", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await start(page);
  const nav = page.locator(".app-mobile-nav");
  const bounds = (await nav.boundingBox())!;
  expect(bounds.x).toBeGreaterThan(0);
  expect(bounds.width).toBeLessThan(393);
  const paths: [string, RegExp][] = [["Cumpărături", /\/cumparaturi\/(\$|lista\/)/], ["Rețete", /\/retete\/$/], ["Buget", /\/buget\/$/], ["Cămară", /\/camara\/$/], ["Acasă", /\/$/]];
  for (const [name, path] of paths) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(path);
    await expect(link).toHaveAttribute("aria-current", "page");
    if (name === "Acasă") {
      await expect(page.getByRole("heading", { level: 1, name: "Azi" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Azi la masă" })).toBeVisible();
    } else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const padding = await page.locator("main").evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  expect(padding).toBeGreaterThanOrEqual(100);
});

test("Ritm: cardul compact păstrează accesul la lista cu nume lung pe telefon", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page);
  await createList(page, "Cumpărăturilesăptămânalepentrufamiliameaextinsă");
  await quickAdd(page, "roșii");
  // Câmpul se golește înainte să se încheie scrierea în IndexedDB.
  // Navigăm abia după afișarea produsului salvat în listă.
  await expect(page.getByRole("checkbox", { name: "Bifează Roșii", exact: true })).toBeVisible();
  await page.goto("/");
  const list = page.getByRole("link", { name: /^Deschide lista/ });
  await expect(list).toContainText(/1\s*de luat/);
  expect(await list.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await list.click();
  const heading = page.getByRole("heading", { name: "Cumpărăturilesăptămânalepentrufamiliameaextinsă" });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
});
