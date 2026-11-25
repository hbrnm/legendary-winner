import { expect, test } from "@playwright/test";
import { start } from "./helpers";

test("Azi reia gătitul la pasul salvat și actualizează stocul offline", async ({ page, context }) => {
  await start(page, "/camara/");
  await page.getByRole("button", { name: "Adaugă în cămară", exact: true }).click();
  const product = page.getByRole("combobox", { name: "Caută sau adaugă un produs" });
  await product.fill("200 g feta");
  await expect(page.getByRole("listbox")).toBeVisible();
  await product.press("Enter");
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const route = "/retete/reteta/?id=omleta-spanac-feta";
  await page.goto(route);
  const launch = page.getByRole("button", { name: "Începe să gătești", exact: true });
  await expect(launch).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole("button", { name: "Mai multe porții", exact: true }).click();
  await launch.click();

  const mode = page.getByRole("dialog", { name: "Mod de gătit" });
  const feta = mode.getByRole("listitem").filter({ hasText: "Brânză feta" });
  await expect(feta).toContainText("100 g");
  await mode.getByRole("button", { name: "Începe prepararea" }).click();
  await expect(mode.getByRole("heading", { name: "Pasul 1 din 3" })).toBeFocused();
  await mode.getByRole("button", { name: "Următorul" }).click();
  await expect(mode.getByRole("heading", { name: "Pasul 2 din 3" })).toBeVisible();
  await mode.getByRole("button", { name: "Vezi ingredientele" }).click();
  await expect(feta).toContainText("100 g");
  await mode.getByRole("button", { name: "Continuă prepararea" }).click();
  await expect(mode.getByRole("heading", { name: "Pasul 2 din 3" })).toBeVisible();
  await mode.getByRole("button", { name: "Închide" }).click();

  const resume = page.getByRole("button", { name: "Reia gătitul", exact: true });
  await expect(resume).toBeFocused();
  await page.goto("/");
  const homeResume = page.getByRole("link", { name: /^Reia gătitul/ });
  await expect(homeResume).toContainText("Omletă cu spanac și brânză feta");
  await expect(homeResume).toContainText("Pasul 2 din 3");
  await context.setOffline(true);
  await page.reload();
  await homeResume.click();
  await expect(mode).toContainText("2 porții");
  await expect(mode.getByRole("heading", { name: "Pasul 2 din 3" })).toBeVisible();
  await mode.getByRole("button", { name: "Următorul" }).click();
  await mode.getByRole("button", { name: "Am gătit" }).click();

  const confirm = page.getByRole("dialog", { name: "Ai gătit rețeta?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Închide" }).click();
  await expect(mode.getByRole("heading", { name: "Pasul 3 din 3" })).toBeVisible();
  await mode.getByRole("button", { name: "Am gătit" }).click();
  await confirm.getByRole("button", { name: "Am gătit" }).click();
  await expect(launch).toBeVisible();

  await page.goto("/camara/");
  await page.getByRole("searchbox", { name: "Caută în cămară" }).fill("Brânză feta");
  await expect(page.getByRole("listitem").filter({ hasText: "Brânză feta" })).toContainText("100 g");
  await page.goto(route);
  await expect(launch).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /^(Bună dimineața|Bună ziua|Bună seara)/ })).toBeVisible();
  await expect(homeResume).toHaveCount(0);
});
