import { expect,test } from '@playwright/test';
import { start, createList } from './helpers';

test('recipe FAB owns creation/import and pantry FAB opens a single compact form',async({page})=>{
 await start(page,'/retete/');
 await expect(page.locator('main').getByRole('link',{name:'Importă',exact:true})).toHaveCount(0);
 await page.locator('main header').getByRole('button',{name:'Acțiuni rețete',exact:true}).click();
 const recipes=page.getByRole('dialog',{name:'Rețete',exact:true});
 await expect(recipes.getByRole('button',{name:'Adaugă rețetă nouă'})).toBeVisible();
 await recipes.getByRole('button',{name:'Importă rețetă',exact:true}).click();
 await expect(page).toHaveURL(/\/retete\/import\//);
 await expect(page.getByRole('button',{name:'Acțiuni rețete',exact:true})).toHaveCount(0);
 await page.goto('/camara/');
 await expect(page.getByRole('button',{name:'Adaugă în cămară',exact:true})).toHaveCount(1);
 await page.locator('main header').getByRole('button',{name:'Adaugă în cămară',exact:true}).click();
 const pantry=page.getByRole('dialog',{name:'Adaugă în cămară',exact:true});
 await expect(pantry.getByLabel('Cantitate',{exact:true})).toBeVisible();
 await expect(pantry.getByLabel('Expiră pe')).not.toBeVisible();
 const search=pantry.getByRole('combobox',{name:'Caută sau adaugă un produs'});
 await expect(search).toBeFocused();
 await search.fill('500 g făină albă');await expect(pantry.getByRole('listbox')).toBeVisible();await search.press('Enter');
 await expect(pantry.getByLabel('Cantitate',{exact:true})).toHaveValue('500');
 await pantry.getByRole('button',{name:'Salvează',exact:true}).click();
 await expect(pantry).not.toBeVisible();
 await page.getByRole('searchbox',{name:'Caută în cămară'}).fill('Făină albă');
 await expect(page.getByText('500 g',{exact:true})).toBeVisible();
});

test('home camera selection reads immediately, supports reframe and keeps the picker reusable',async({page})=>{
 await page.addInitScript(()=>{(globalThis as typeof globalThis & {__camaraOcrText?:string}).__camaraOcrText='KAUFLAND ROMANIA SCS\n1,000 BUC x 5,29\nVDR.LAP.3,5%1L 5,29 C\nTOTAL 5,29';});
 await start(page);
 await page.getByRole('button',{name:'Adaugă rapid',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Scanează bon',exact:true}).click();
 await (await chooser).setFiles('e2e/fixtures/bon-exif-rotit.jpg');
 await expect(page.getByText(/^Am citit/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Citește bonul',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Reîncadrează bonul',exact:true}).click();
 await expect(page.getByRole('button',{name:'Citește bonul',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Citește bonul',exact:true}).click();
 await expect(page.getByText(/^Am citit/)).toBeVisible();
 await page.getByRole('dialog',{name:'Cheltuială',exact:true}).getByRole('button',{name:'Închide',exact:true}).click();
 await expect(page.getByRole('button',{name:'Adaugă rapid',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Adaugă rapid',exact:true}).click();
 const second=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Scanează bon',exact:true}).click();
 await (await second).setFiles('e2e/fixtures/bon-exif-rotit.jpg');
 await expect(page.getByText(/^Am citit/)).toBeVisible();
});

for(const theme of ['luminos','intunecat'])test(`home prioritizes the meal card and keeps the other sections reachable, ${theme}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(theme=>localStorage.setItem('camara-tema',theme),theme);
 // Seeded demo exercises the budget and recent transaction states as well.
 await page.clock.setFixedTime(new Date('2026-03-08T09:00:00+02:00'));await page.goto('/');
 const safeBottom=await page.locator('.app-mobile-nav').evaluate(el=>el.getBoundingClientRect().top);
 const fab=page.getByRole('button',{name:'Adaugă rapid',exact:true});
 await expect(fab).toHaveCSS('position','fixed');
 const before=await fab.boundingBox();
 expect(before!.y+before!.height).toBeLessThanOrEqual(safeBottom);
 for(const id of ['home-meal','home-shopping-pantry','home-budget']){
  const card=page.getByTestId(id);await expect(card).toBeVisible();const box=(await card.boundingBox())!;if(id==='home-meal') expect(box.y+box.height).toBeLessThanOrEqual(safeBottom);
  else { await card.scrollIntoViewIfNeeded(); await expect(card).toBeInViewport(); }
 }
 expect(await fab.boundingBox()).toEqual(before);
 await expect(page.locator('main').getByRole('button',{name:'Scanează bon',exact:true})).toHaveCount(0);
 await page.screenshot({path:`test-results/lot1-home-${theme}.png`,fullPage:true});
});

test('ready-only excludes partial stock and reacts to stock changes offline',async({page,context})=>{
 await start(page,'/retete/');
 await page.getByRole('button',{name:'Gata de gătit',exact:true}).click();
 await expect(page.getByText('Cămara e goală',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.ready).active)).toBe(true);
 await context.setOffline(true);
 await page.goto('/camara/');
 // The catalog recipe requires eggs, spinach, feta and oil.
 for(const text of ['150 g ouă','50 g spanac','50 g feta','5 g ulei de măsline']){
  await page.getByRole('button',{name:'Adaugă în cămară',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'Adaugă în cămară',exact:true});
  const box=sheet.getByRole('combobox',{name:'Caută sau adaugă un produs'});await box.fill(text);await expect(sheet.getByRole('listbox')).toBeVisible();await box.press('Enter');
  await sheet.getByRole('button',{name:'Salvează',exact:true}).click();await expect(sheet).not.toBeVisible();
 }
 await page.goto('/retete/');await page.getByRole('button',{name:'Gata de gătit',exact:true}).click();
 await expect(page.getByRole('link',{name:'Începe să gătești Omletă cu spanac și brânză feta',exact:true})).toBeVisible();
 await page.goto('/camara/');
 await page.getByRole('searchbox',{name:'Caută în cămară'}).fill('Spanac');
 await page.getByRole('button',{name:'Acțiuni pentru Spanac',exact:true}).click();
 await page.getByRole('button',{name:'S-a terminat → Pe listă',exact:true}).click();
 await expect(page.getByRole('button',{name:'Acțiuni pentru Spanac',exact:true})).toHaveCount(0);
 await page.goto('/retete/');await page.getByRole('button',{name:'Gata de gătit',exact:true}).click();
 await expect(page.getByRole('link',{name:'Începe să gătești Omletă cu spanac și brânză feta',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Îți mai lipsesc câteva ingrediente'}).getByRole('link',{name:/Omletă cu spanac și brânză feta/})).toContainText('Lipsesc: Spanac');
});

test('shopping FAB creates a new list even when already on the lists route',async({page})=>{
 await start(page,'/cumparaturi/?toate=1');
 await page.getByRole('button',{name:'Acțiuni cumpărături',exact:true}).click();
 await page.getByRole('dialog',{name:'Cumpărături',exact:true}).getByRole('button',{name:'Listă nouă',exact:true}).click();
 await expect(page).toHaveURL(/\/cumparaturi\/lista\/\?id=/);
 await expect(page.getByRole('heading',{name:/^Cumpărături/})).toBeVisible();
});

test('income opened by contextual FAB returns keyboard focus to that FAB on close',async({page})=>{
 await start(page,'/buget/');
 await page.getByRole('button',{name:'Acțiuni buget',exact:true}).click();
 await page.getByRole('dialog',{name:'Buget',exact:true}).getByRole('button',{name:'Adaugă venit',exact:true}).click();
 const income=page.getByRole('dialog',{name:'Venituri și alocare',exact:true});await expect(income).toBeVisible();
 await income.getByRole('button',{name:'Închide',exact:true}).click();
 await expect(page.getByRole('button',{name:'Acțiuni buget',exact:true})).toBeFocused();
});

test('detail FAB adds to the viewed list rather than a different preferred list',async({page})=>{
 await start(page);await createList(page,'Lista A');const a=page.url();
 await createList(page,'Lista B');const b=page.url();const id=new URL(b).searchParams.get('id')!;
 await page.goto('/cumparaturi/?toate=1');await page.getByRole('link').filter({hasText:'Lista A'}).click();
 await page.goto(b);
 await page.getByRole('button',{name:'Acțiuni cumpărături',exact:true}).click();
 await page.getByRole('dialog',{name:'Cumpărături',exact:true}).getByRole('button',{name:'Adaugă pe listă',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Adaugă pe listă',exact:true}).getByLabel('Lista de cumpărături',{exact:true})).toHaveValue(id);
 const target=page.getByRole('dialog',{name:'Adaugă pe listă',exact:true});
 const box=target.getByRole('combobox',{name:'Caută sau adaugă un produs'});
 await box.fill('1 kg roșii');await expect(target.getByRole('listbox')).toBeVisible();await box.press('Enter');
 await expect(target).not.toBeVisible();await expect(page).toHaveURL(b);
 await expect(page.getByRole('checkbox',{name:/^Bifează /})).toHaveCount(1);
 await page.goto(a);await expect(page.getByRole('checkbox',{name:/^Bifează /})).toHaveCount(0);
});
