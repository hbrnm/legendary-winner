import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

// Citirea bonului pe server (.tasks/015, etapa 2), cu funcția Edge read-receipt
// simulată (Supabase-ul local nu are funcțiile Edge și nici Gemini).
const BON = `KAUFLAND ROMANIA SCS
1,000 BUC x 5,29
VDR.LAP.3,5%1L 5,29 C
1,014 KG x 2,29
CEAPA GALBENA KG 2,32 C
TOTAL 7,61
DATA:05/03/2026`;

test("cu cont, bonul decupat se citește pe server; dacă serverul nu merge, pe telefon, cu atenționare", async ({ browser }) => {
  const ana = await signUp(browser, "Irina");
  await ana.waitForURL(/gospodarie/);
  await ana.getByLabel("Numele gospodăriei").fill("Familia Ionescu");
  await ana.getByRole("button", { name: "Creează gospodăria" }).click();
  await expect(ana.getByText("Familia Ionescu").first()).toBeVisible();

  const sent: { mimeType: string; data: string }[] = [];
  await ana.route("**/functions/v1/read-receipt", async (route) => {
    sent.push(route.request().postDataJSON().image);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: BON }) });
  });

  await ana.goto("/cumparaturi/bon/");
  await ana.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/ciorba-1600x1200.jpg");
  await expect(ana.getByText("Cu internet, bonul decupat se citește pe server și nu se păstrează. Fără internet, îl citesc pe telefon.")).toBeVisible();
  await ana.getByRole("button", { name: "Citește bonul" }).click();
  await expect(ana.getByRole("heading", { name: "Verifică bonul" })).toBeVisible();
  await expect(ana.getByText(/pe bon: CEAPA GALBENA/)).toBeVisible();
  await expect(ana.getByText(/Nu am putut citi bonul pe server/)).toHaveCount(0);
  // Pleacă doar bonul decupat, ca JPEG, cu latura mare de cel mult 2400 px.
  expect(sent).toHaveLength(1);
  expect(sent[0].mimeType).toBe("image/jpeg");
  const size = await ana.evaluate(async (data) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob());
    return [bmp.width, bmp.height];
  }, sent[0].data);
  expect(Math.max(...size)).toBeLessThanOrEqual(2400);

  // Serverul nu merge (limita, eroare): citește telefonul (aici, cu text simulat).
  await ana.unroute("**/functions/v1/read-receipt");
  await ana.route("**/functions/v1/read-receipt", (route) => route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"failed"}' }));
  await ana.evaluate((text) => ((globalThis as { __camaraOcrText?: string }).__camaraOcrText = text), BON);
  await ana.getByRole("button", { name: "Alt bon" }).click();
  await ana.getByTestId("bon-fisier").setInputFiles("e2e/fixtures/ciorba-1600x1200.jpg");
  await ana.getByRole("button", { name: "Citește bonul" }).click();
  await expect(ana.getByText("Nu am putut citi bonul pe server, așa că l-am citit pe telefon. Verifică liniile cu atenție.")).toBeVisible();
  await expect(ana.getByText(/pe bon: CEAPA GALBENA/)).toBeVisible();
});
