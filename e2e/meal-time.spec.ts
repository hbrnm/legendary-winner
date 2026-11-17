import { expect, test } from "@playwright/test";
import { RECIPE_SEEDS } from "../src/data/recipes";
import { start } from "./helpers";

test("sugestiile urmează ora locală și alegerea mesei, chiar dacă altă masă este deja planificată", async ({ page }) => {
  await start(page);
  for (const [hour, label, slot, category] of [
    [9, "Mic dejun", "mic_dejun", "mic_dejun"],
    [12, "Prânz", "pranz", "pranz"],
    [16, "Gustare", "gustare", "gustari"],
    [19, "Cină", "cina", "cina"],
  ] as const) {
    await page.clock.setFixedTime(new Date(`2026-03-08T${String(hour).padStart(2,"0")}:00:00+02:00`));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText(`Sugestii · ${label}`, { exact: true })).toBeVisible();
    const choices = page.getByRole("button", {name:"Alege",exact:true});
    await expect(choices).toHaveCount(3);
    // Verificăm categoria reală, nu doar eticheta afișată în interfață.
    for (const choice of await choices.all()) {
      const href = await choice.locator("..").getByRole("link").getAttribute("href");
      const id = new URL(href!, "http://localhost").searchParams.get("id");
      const recipe = RECIPE_SEEDS.find(r => r.id === id)!;
      expect(recipe.categories).toContain(category);
      expect(recipe.prep + recipe.cook).toBeLessThanOrEqual(30);
    }
    await choices.first().click();
    const sheet = page.getByRole("dialog",{name:"Alege masa de azi"});
    await expect(sheet.getByLabel("Masa",{exact:true})).toHaveValue(slot);
    await expect(sheet.getByLabel("Masa",{exact:true}).locator("option")).toHaveCount(4);
    if (slot === "mic_dejun") {
      await sheet.getByRole("button",{name:"Programează azi"}).click();
      await expect(sheet).not.toBeVisible();
      await expect(page.getByText("Sugestii · Mic dejun",{exact:true})).not.toBeVisible();
    } else {
      await sheet.getByRole("button",{name:"Închide",exact:true}).click();
      await expect(page.getByRole("button",{name:"Am gătit",exact:true})).toHaveCount(1);
    }
  }
});
