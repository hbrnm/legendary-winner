import {expect,test} from "@playwright/test";
import {start} from "./helpers";

test("editarea bugetului: salvarea rămâne accesibilă cu tastatura deschisă",async({page})=>{
  await page.setViewportSize({width:360,height:780});
  await start(page,"/buget/");
  await page.getByRole("button",{name:"Setează bugetul lunar",exact:true}).click();
  let sheet=page.getByRole("dialog",{name:"Buget nou",exact:true});
  await sheet.getByLabel("Suma (lei)",{exact:true}).fill("5000");
  await sheet.getByRole("button",{name:"Salvează",exact:true}).click();
  await expect(sheet).not.toBeVisible();
  await page.getByRole("button",{name:"Modifică bugetul Bugetul lunii",exact:true}).click();
  sheet=page.getByRole("dialog",{name:"Modifică bugetul",exact:true});
  await sheet.getByLabel("Suma (lei)",{exact:true}).fill("4000");
  await page.evaluate(()=>{
    Object.defineProperty(window.visualViewport!,"height",{value:360,configurable:true});
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  const save=sheet.getByRole("button",{name:"Salvează",exact:true});
  await expect(save).toBeEnabled();
  await expect(async()=>{
    const box=(await save.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height).toBeLessThanOrEqual(360);
  }).toPass();
  await save.click();
  await expect(sheet).not.toBeVisible();
  await page.reload();
  await expect(page.getByText(/din 4[.]?000,00/)).toBeVisible();
});
